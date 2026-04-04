const crypto = require('crypto');
const db = require('../models');
const aiGateway = require('./aiGateway.service');

const { Course, Chapter, Lecture, AiDocument, AiChunk } = db.models;

function sha1(text) {
  return crypto.createHash('sha1').update(String(text || ''), 'utf8').digest('hex');
}

function normalizeText(text) {
  return String(text || '').replace(/\r\n/g, '\n').trim();
}

function chunkText(text, maxChars = 900) {
  const t = normalizeText(text);
  if (!t) return [];

  const chunks = [];
  let i = 0;
  while (i < t.length) {
    const slice = t.slice(i, i + maxChars);
    chunks.push(slice);
    i += maxChars;
  }
  return chunks;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return -1;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    const va = Number(a[i]);
    const vb = Number(b[i]);
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (na === 0 || nb === 0) return -1;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function buildLectureSourceText(lectureId, options = {}) {
  const lecture = await Lecture.findByPk(lectureId, {
    include: [{ model: Chapter, as: 'chapter', attributes: ['id', 'title', 'courseId'], required: true }],
    transaction: options.transaction,
  });
  if (!lecture) return null;

  const course = await Course.findByPk(lecture.chapter.courseId, {
    attributes: ['id', 'title', 'description'],
    transaction: options.transaction,
  });

  const parts = [];
  parts.push(`Course: ${course?.title || ''}`);
  if (course?.description) parts.push(`Course description: ${course.description}`);
  parts.push(`Chapter: ${lecture.chapter.title || ''}`);
  parts.push(`Lecture: ${lecture.title || ''}`);
  if (lecture.content) parts.push(`Content:\n${lecture.content}`);
  if (lecture.aiNotes) parts.push(`Lecture notes: ${lecture.aiNotes}`);

  return {
    courseId: Number(lecture.chapter.courseId),
    lectureId: Number(lecture.id),
    chapterId: Number(lecture.chapter.id),
    text: normalizeText(parts.join('\n')),
  };
}

async function ingestLecture(lectureId, options = {}) {
  const lectureIdNum = Number(lectureId);
  if (!Number.isFinite(lectureIdNum)) {
    const err = new Error('lectureId không hợp lệ');
    err.statusCode = 400;
    throw err;
  }

  const source = await buildLectureSourceText(lectureIdNum, options);
  if (!source || !source.text) {
    const err = new Error('Không có dữ liệu để ingest lecture');
    err.statusCode = 400;
    throw err;
  }

  const sourceHash = sha1(source.text);

  const [doc] = await AiDocument.findOrCreate({
    where: { type: 'lecture', lectureId: lectureIdNum },
    defaults: {
      type: 'lecture',
      courseId: source.courseId,
      chapterId: source.chapterId,
      lectureId: lectureIdNum,
      sourceHash,
      status: 'pending',
    },
    transaction: options.transaction,
  });

  if (doc.sourceHash === sourceHash && doc.status === 'ready') {
    return { documentId: doc.id, status: 'skipped' };
  }

  await doc.update(
    { courseId: source.courseId, chapterId: source.chapterId, sourceHash, status: 'pending' },
    { transaction: options.transaction }
  );

  await AiChunk.destroy({ where: { documentId: doc.id }, transaction: options.transaction });

  const chunks = chunkText(source.text, Number(process.env.AI_CHUNK_MAX_CHARS || 900));
  for (let i = 0; i < chunks.length; i += 1) {
    const text = chunks[i];
    const { embedding } = await aiGateway.embedText({ text });
    await AiChunk.create(
      {
        documentId: doc.id,
        courseId: source.courseId,
        chapterId: source.chapterId,
        lectureId: lectureIdNum,
        chunkIndex: i,
        text,
        embeddingJson: embedding,
        tokenCount: 0,
      },
      { transaction: options.transaction }
    );
    
    // Delay nhỏ giữa các calls để tránh rate limit
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  await doc.update({ status: 'ready' }, { transaction: options.transaction });
  return { documentId: doc.id, status: 'ready', chunks: chunks.length };
}

async function retrieveTopChunks({ courseId, lectureId, query, topK = 5, options = {} }) {
  const where = {
    courseId: Number(courseId),
  };
  if (lectureId != null) where.lectureId = Number(lectureId);

  const rows = await AiChunk.findAll({
    where,
    attributes: ['id', 'text', 'embeddingJson', 'lectureId', 'chunkIndex'],
    transaction: options.transaction,
  });

  if (!rows.length) return [];

  const { embedding: queryEmbedding } = await aiGateway.embedText({ text: String(query || '') });

  const scored = rows
    .map((r) => {
      const score = cosineSimilarity(queryEmbedding, r.embeddingJson);
      return {
        id: r.id,
        text: r.text,
        lectureId: r.lectureId,
        chunkIndex: r.chunkIndex,
        score,
      };
    })
    .filter((x) => Number.isFinite(x.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(20, Number(topK) || 5)));

  return scored;
}

/**
 * Retrieve top chunks from multiple lectures for quiz generation
 * Supports scope: 'lecture' | 'chapter' | 'course' | 'multi'
 */
async function retrieveTopChunksForQuiz({ courseId, scope, lectureIds, chapterId, query, topK = 10, options = {} }) {
  const { Op } = require('sequelize');
  
  const where = {
    courseId: Number(courseId),
  };

  // Build where clause based on scope
  if (scope === 'lecture' && lectureIds?.length === 1) {
    where.lectureId = Number(lectureIds[0]);
  } else if (scope === 'multi' && lectureIds?.length > 0) {
    where.lectureId = { [Op.in]: lectureIds.map(Number) };
  } else if (scope === 'chapter' && chapterId) {
    where.chapterId = Number(chapterId);
  }
  // scope === 'course' → no lecture/chapter filter, get all chunks in course

  const rows = await AiChunk.findAll({
    where,
    attributes: ['id', 'text', 'embeddingJson', 'lectureId', 'chapterId', 'chunkIndex'],
    transaction: options.transaction,
  });

  if (!rows.length) return [];

  // Generate query embedding for similarity search
  const searchQuery = query || 'quiz test exam important concepts knowledge key points';
  const { embedding: queryEmbedding } = await aiGateway.embedText({ text: searchQuery });

  // Score and rank chunks
  const scored = rows
    .map((r) => {
      const score = cosineSimilarity(queryEmbedding, r.embeddingJson);
      return {
        id: r.id,
        text: r.text,
        lectureId: r.lectureId,
        chapterId: r.chapterId,
        chunkIndex: r.chunkIndex,
        score,
      };
    })
    .filter((x) => Number.isFinite(x.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(50, Number(topK) || 10)));

  return scored;
}

module.exports = {
  ingestLecture,
  retrieveTopChunks,
  retrieveTopChunksForQuiz,
};
