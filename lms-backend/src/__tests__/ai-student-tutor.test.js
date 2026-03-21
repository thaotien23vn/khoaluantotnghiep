const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { seedCore, TEST_PREFIX } = require('./jest.teardown');

jest.mock('../services/aiGateway.service', () => ({
  generateText: jest.fn(async () => ({ text: 'MOCK_AI_ANSWER' })),
  embedText: jest.fn(async () => ({ embedding: [1, 0, 0] })),
}));

jest.mock('../services/aiRag.service', () => ({
  retrieveTopChunks: jest.fn(async () => [
    { id: 1, text: 'MOCK_CHUNK_1', score: 0.9, lectureId: null, courseId: null },
    { id: 2, text: 'MOCK_CHUNK_2', score: 0.8, lectureId: null, courseId: null },
  ]),
  ingestLecture: jest.fn(async () => ({ documentId: 1, chunks: 2 })),
}));

async function loginSeedStudent() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: `${TEST_PREFIX}student@example.com`, password: 'Password123@' });

  expect([200, 201]).toContain(res.statusCode);
  expect(res.body).toHaveProperty('success', true);

  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Student AI tutor', () => {
  it('should create conversation and send message (enrolled student)', async () => {
    const seeded = await seedCore();
    const token = await loginSeedStudent();

    const createRes = await request(app)
      .post('/api/student/ai/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ courseId: seeded.course.id, title: 'it_seed_ai_conv' });

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body).toHaveProperty('success', true);

    const convId = createRes.body?.data?.conversation?.id;
    expect(convId).toBeTruthy();

    const msgRes = await request(app)
      .post(`/api/student/ai/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'hello ai' });

    expect(msgRes.statusCode).toBe(201);
    expect(msgRes.body).toHaveProperty('success', true);
    expect(msgRes.body?.data?.answer).toBe('MOCK_AI_ANSWER');
    expect(Array.isArray(msgRes.body?.data?.chunks)).toBe(true);

    // best-effort cleanup
    await db.models.AiMessage.destroy({ where: { conversationId: convId } });
    await db.models.AiConversation.destroy({ where: { id: convId } });
  });

  it('should forbid creating conversation if not enrolled', async () => {
    const seeded = await seedCore();
    const token = await loginSeedStudent();

    const uniq = Date.now();
    const otherCourse = await db.models.Course.create({
      title: `it_seed_other_course_${uniq}`,
      slug: `it-seed-other-course-${uniq}`,
      description: 'seed',
      imageUrl: null,
      level: 'Mọi cấp độ',
      price: 0,
      published: true,
      rating: 0,
      reviewCount: 0,
      students: 0,
      totalLessons: 0,
      duration: null,
      willLearn: [],
      requirements: [],
      tags: [],
      categoryId: seeded.category.id,
      createdBy: seeded.teacher.id,
    });

    const res = await request(app)
      .post('/api/student/ai/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ courseId: otherCourse.id, title: 'it_seed_ai_conv_forbidden' });

    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty('success', false);

    await db.models.Course.destroy({ where: { id: otherCourse.id } });
  });
});
