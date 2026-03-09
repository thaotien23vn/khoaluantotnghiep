const db = require('../models');
const aiPolicy = require('../services/aiPolicy.service');
const aiPrompt = require('../services/aiPrompt.service');
const aiRag = require('../services/aiRag.service');
const aiGateway = require('../services/aiGateway.service');
const aiAudit = require('../services/aiAudit.service');

const { Enrollment, Course, Chapter, Lecture, AiConversation, AiMessage, AiSetting, AiRolePolicy, AiPromptTemplate } = db.models;

async function requireAiEnabled(req, res) {
  const setting = await aiPolicy.getAiSetting();
  if (!setting?.enabled) {
    res.status(503).json({ success: false, message: 'AI đang tạm tắt' });
    return null;
  }
  return setting;
}

async function requireRoleAllowed(req, res) {
  const role = req.user?.role;
  const policy = await aiPolicy.getRolePolicy(role);
  if (!policy?.enabled) {
    res.status(403).json({ success: false, message: 'Role không được phép sử dụng AI' });
    return null;
  }
  return policy;
}

async function ensureStudentEnrolled(userId, courseId) {
  const row = await Enrollment.findOne({ where: { userId, courseId, status: 'enrolled' } });
  return !!row;
}

async function ensureTeacherOwnsCourseOrAdmin(reqUser, course) {
  if (!course) return false;
  if (reqUser?.role === 'admin') return true;
  if (reqUser?.role !== 'teacher') return false;
  if (!course.createdBy) return false;
  return Number(course.createdBy) === Number(reqUser.id);
}

exports.createStudentConversation = async (req, res) => {
  const setting = await requireAiEnabled(req, res);
  if (!setting) return;
  const policy = await requireRoleAllowed(req, res);
  if (!policy) return;

  try {
    const userId = Number(req.user.id);
    const courseId = req.body?.courseId != null ? Number(req.body.courseId) : null;
    const lectureId = req.body?.lectureId != null ? Number(req.body.lectureId) : null;

    if (!Number.isFinite(courseId)) {
      return res.status(400).json({ success: false, message: 'courseId không hợp lệ' });
    }

    const enrolled = await ensureStudentEnrolled(userId, courseId);
    if (!enrolled && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Bạn chưa đăng ký khóa học này' });
    }

    if (lectureId != null && Number.isFinite(lectureId)) {
      const lecture = await Lecture.findByPk(lectureId, {
        include: [{ model: Chapter, attributes: ['courseId'], required: true }],
      });
      if (!lecture || Number(lecture.Chapter.courseId) !== courseId) {
        return res.status(400).json({ success: false, message: 'lectureId không thuộc courseId' });
      }
    }

    const conv = await AiConversation.create({
      userId,
      role: String(req.user.role),
      courseId,
      lectureId: lectureId != null && Number.isFinite(lectureId) ? lectureId : null,
      title: req.body?.title ? String(req.body.title) : null,
    });

    res.status(201).json({ success: true, message: 'Tạo hội thoại AI', data: { conversation: conv } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.sendStudentMessage = async (req, res) => {
  const setting = await requireAiEnabled(req, res);
  if (!setting) return;
  const policy = await requireRoleAllowed(req, res);
  if (!policy) return;

  const endpoint = 'student_ai_tutor';

  try {
    const userId = Number(req.user.id);
    const convId = Number(req.params.id);
    const message = String(req.body?.message || '').trim();

    if (!Number.isFinite(convId)) {
      return res.status(400).json({ success: false, message: 'conversationId không hợp lệ' });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: 'message không được trống' });
    }

    const conv = await AiConversation.findByPk(convId);
    if (!conv) return res.status(404).json({ success: false, message: 'Không tìm thấy hội thoại' });

    if (Number(conv.userId) !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập hội thoại' });
    }

    if (!conv.courseId) {
      return res.status(400).json({ success: false, message: 'Hội thoại thiếu courseId' });
    }

    const enrolled = await ensureStudentEnrolled(userId, Number(conv.courseId));
    if (!enrolled && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Bạn chưa đăng ký khóa học này' });
    }

    await AiMessage.create({ conversationId: convId, sender: 'user', content: message });

    const topK = Number(policy.ragTopK) || Number(process.env.AI_RAG_TOP_K || 5) || 5;
    const chunks = await aiRag.retrieveTopChunks({
      courseId: Number(conv.courseId),
      lectureId: conv.lectureId != null ? Number(conv.lectureId) : null,
      query: message,
      topK,
    });

    const contextText = chunks.map((c, idx) => `#${idx + 1} (score=${c.score.toFixed(3)}):\n${c.text}`).join('\n\n');
    const system = await aiPrompt.getTemplateOrDefault('tutor');

    const prompt = [
      'CONTEXT:',
      contextText || '(no context found)',
      '',
      'QUESTION:',
      message,
    ].join('\n');

    const aiRes = await aiGateway.generateText({
      system,
      prompt,
      maxOutputTokens: Number(policy.maxOutputTokens) || Number(process.env.AI_MAX_OUTPUT_TOKENS || 1024) || 1024,
    });

    await AiMessage.create({ conversationId: convId, sender: 'ai', content: aiRes.text, tokenUsage: null });

    await aiAudit.logAiCall({
      userId,
      role: req.user?.role,
      endpoint,
      provider: setting.provider,
      model: setting.model,
      status: 'ok',
      courseId: conv.courseId,
      lectureId: conv.lectureId,
    });

    res.status(201).json({ success: true, message: 'AI trả lời', data: { answer: aiRes.text, chunks } });
  } catch (error) {
    await aiAudit.logAiCall({
      userId: req.user?.id,
      role: req.user?.role,
      endpoint,
      provider: 'gemini',
      model: process.env.AI_MODEL,
      status: 'error',
      error: error.message,
    });

    const statusCode = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
    res.status(statusCode).json({ success: false, message: 'AI error', error: error.message });
  }
};

exports.updateTeacherLectureAiNotes = async (req, res) => {
  const setting = await requireAiEnabled(req, res);
  if (!setting) return;
  const policy = await requireRoleAllowed(req, res);
  if (!policy) return;

  try {
    const lectureId = Number(req.params.id);
    if (!Number.isFinite(lectureId)) {
      return res.status(400).json({ success: false, message: 'lectureId không hợp lệ' });
    }

    const lecture = await Lecture.findByPk(lectureId, {
      include: [{ model: Chapter, attributes: ['courseId'], required: true }],
    });
    if (!lecture) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lecture' });
    }

    const course = await Course.findByPk(lecture.Chapter.courseId);
    const allowed = await ensureTeacherOwnsCourseOrAdmin(req.user, course);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật lecture này' });
    }

    const aiNotes = req.body?.aiNotes != null ? String(req.body.aiNotes) : null;
    await lecture.update({ aiNotes });

    res.json({ success: true, message: 'Cập nhật aiNotes', data: { lecture } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.ingestTeacherLecture = async (req, res) => {
  const setting = await requireAiEnabled(req, res);
  if (!setting) return;
  const policy = await requireRoleAllowed(req, res);
  if (!policy) return;

  try {
    const lectureId = Number(req.params.lectureId);
    if (!Number.isFinite(lectureId)) {
      return res.status(400).json({ success: false, message: 'lectureId không hợp lệ' });
    }

    const lecture = await Lecture.findByPk(lectureId, {
      include: [{ model: Chapter, attributes: ['courseId'], required: true }],
    });
    if (!lecture) return res.status(404).json({ success: false, message: 'Không tìm thấy lecture' });

    const course = await Course.findByPk(lecture.Chapter.courseId);
    const allowed = await ensureTeacherOwnsCourseOrAdmin(req.user, course);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền ingest lecture này' });
    }

    const result = await aiRag.ingestLecture(lectureId);
    res.json({ success: true, message: 'Ingest lecture', data: result });
  } catch (error) {
    const statusCode = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
    res.status(statusCode).json({ success: false, message: 'Lỗi ingest', error: error.message });
  }
};

exports.getAdminAiSettings = async (req, res) => {
  try {
    const row = await AiSetting.findOne({ order: [['id', 'DESC']] });
    res.json({ success: true, data: { setting: row } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.upsertAdminAiSettings = async (req, res) => {
  try {
    const enabled = req.body?.enabled;
    const provider = req.body?.provider;
    const model = req.body?.model;

    const setting = await AiSetting.create({
      enabled: enabled != null ? Boolean(enabled) : false,
      provider: provider != null ? String(provider) : 'gemini',
      model: model != null ? String(model) : 'gemini-1.5-flash',
    });

    res.status(201).json({ success: true, message: 'Cập nhật AI settings', data: { setting } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.getAdminAiPolicies = async (req, res) => {
  try {
    const rows = await AiRolePolicy.findAll({ order: [['id', 'DESC']] });
    res.json({ success: true, data: { policies: rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.createAdminAiPolicy = async (req, res) => {
  try {
    const role = String(req.body?.role || '').toLowerCase();
    if (!role) return res.status(400).json({ success: false, message: 'role không được trống' });

    const policy = await AiRolePolicy.create({
      role,
      enabled: req.body?.enabled != null ? Boolean(req.body.enabled) : true,
      dailyLimit: req.body?.dailyLimit != null ? Number(req.body.dailyLimit) : 50,
      maxOutputTokens: req.body?.maxOutputTokens != null ? Number(req.body.maxOutputTokens) : 1024,
      ragTopK: req.body?.ragTopK != null ? Number(req.body.ragTopK) : 5,
    });

    res.status(201).json({ success: true, message: 'Tạo policy', data: { policy } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.getAdminPromptTemplates = async (req, res) => {
  try {
    const rows = await AiPromptTemplate.findAll({ order: [['id', 'DESC']] });
    res.json({ success: true, data: { templates: rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.createAdminPromptTemplate = async (req, res) => {
  try {
    const key = String(req.body?.key || '').trim();
    const template = String(req.body?.template || '').trim();
    if (!key || !template) {
      return res.status(400).json({ success: false, message: 'key/template không hợp lệ' });
    }

    const row = await AiPromptTemplate.create({
      key,
      template,
      isActive: req.body?.isActive != null ? Boolean(req.body.isActive) : true,
      createdByAdminId: req.user?.id ? Number(req.user.id) : null,
    });

    res.status(201).json({ success: true, message: 'Tạo prompt template', data: { template: row } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.getAdminAiAuditLogs = async (req, res) => {
  try {
    const rows = await db.models.AiAuditLog.findAll({
      order: [['id', 'DESC']],
      limit: 200,
    });
    res.json({ success: true, data: { logs: rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};
