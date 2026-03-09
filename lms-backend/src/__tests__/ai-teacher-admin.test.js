const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { seedCore } = require('./jest.teardown');
const { loginByRole } = require('./testAuth');

jest.mock('../services/aiGateway.service', () => ({
  generateText: jest.fn(async () => ({ text: 'MOCK_AI_ANSWER' })),
  embedText: jest.fn(async () => ({ embedding: [1, 0, 0] })),
}));

jest.mock('../services/aiRag.service', () => ({
  retrieveTopChunks: jest.fn(async () => []),
  ingestLecture: jest.fn(async () => ({ documentId: 123, chunks: 3 })),
}));

describe('Teacher/Admin AI endpoints', () => {
  it('teacher should update lecture aiNotes and ingest lecture', async () => {
    const token = await loginByRole('teacher');

    const uniq = Date.now();
    const createCourseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `it_seed_ai_course_${uniq}`, description: 'seed', price: 0, published: false });

    expect(createCourseRes.statusCode).toBe(201);
    const courseId = createCourseRes.body?.data?.course?.id;
    expect(courseId).toBeTruthy();

    const chapter = await db.models.Chapter.create({
      courseId,
      title: `it_seed_ai_chapter_${uniq}`,
      order: 1,
    });

    const lecture = await db.models.Lecture.create({
      chapterId: chapter.id,
      title: `it_seed_ai_lecture_${uniq}`,
      type: 'video',
      contentUrl: 'https://example.com/video.mp4',
      duration: null,
      order: 1,
      isPreview: false,
      aiNotes: null,
    });

    const updateRes = await request(app)
      .put(`/api/teacher/lectures/${lecture.id}/ai-notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({ aiNotes: 'seed ai notes' });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body).toHaveProperty('success', true);

    const ingestRes = await request(app)
      .post(`/api/teacher/ai/ingest/lecture/${lecture.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(ingestRes.statusCode).toBe(200);
    expect(ingestRes.body).toHaveProperty('success', true);
    expect(ingestRes.body?.data?.documentId).toBe(123);

    await db.models.Lecture.destroy({ where: { id: lecture.id } });
    await db.models.Chapter.destroy({ where: { id: chapter.id } });
    await db.models.Course.destroy({ where: { id: courseId } });
  });

  it('admin should CRUD settings/policies/templates and read audit logs', async () => {
    const adminToken = await loginByRole('admin');

    const upsertSettingsRes = await request(app)
      .put('/api/admin/ai/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, provider: 'gemini', model: 'gemini-1.5-flash' });

    expect(upsertSettingsRes.statusCode).toBe(201);
    expect(upsertSettingsRes.body).toHaveProperty('success', true);

    const getSettingsRes = await request(app)
      .get('/api/admin/ai/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getSettingsRes.statusCode).toBe(200);
    expect(getSettingsRes.body).toHaveProperty('success', true);

    const uniq = Date.now();

    const createPolicyRes = await request(app)
      .post('/api/admin/ai/policies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: `it_seed_role_${uniq}`, enabled: true, dailyLimit: 1, maxOutputTokens: 10, ragTopK: 2 });

    expect(createPolicyRes.statusCode).toBe(201);
    expect(createPolicyRes.body).toHaveProperty('success', true);

    const listPoliciesRes = await request(app)
      .get('/api/admin/ai/policies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listPoliciesRes.statusCode).toBe(200);
    expect(listPoliciesRes.body).toHaveProperty('success', true);

    const createTplRes = await request(app)
      .post('/api/admin/ai/prompt-templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: `it_seed_tpl_${uniq}`, template: 'you are a tutor', isActive: true });

    expect(createTplRes.statusCode).toBe(201);
    expect(createTplRes.body).toHaveProperty('success', true);

    const listTplRes = await request(app)
      .get('/api/admin/ai/prompt-templates')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listTplRes.statusCode).toBe(200);
    expect(listTplRes.body).toHaveProperty('success', true);

    const auditRes = await request(app)
      .get('/api/admin/ai/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.body).toHaveProperty('success', true);

    // best-effort cleanup for created governance rows
    const createdPolicyId = createPolicyRes.body?.data?.policy?.id;
    if (createdPolicyId) {
      await db.models.AiRolePolicy.destroy({ where: { id: createdPolicyId } });
    }

    const createdTplId = createTplRes.body?.data?.template?.id;
    if (createdTplId) {
      await db.models.AiPromptTemplate.destroy({ where: { id: createdTplId } });
    }

    const createdSettingId = upsertSettingsRes.body?.data?.setting?.id;
    if (createdSettingId) {
      await db.models.AiSetting.destroy({ where: { id: createdSettingId } });
    }
  });
});
