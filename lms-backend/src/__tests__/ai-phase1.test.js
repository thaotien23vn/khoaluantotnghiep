const request = require('supertest');
const app = require('../app');
const { loginByRole } = require('./testAuth');

jest.mock('../services/aiGateway.service', () => ({
  generateText: jest.fn(async () => ({ text: 'MOCK_AI_ANSWER' })),
  embedText: jest.fn(async () => ({ embedding: [0.1, 0.2, 0.3] })),
}));

jest.mock('../services/aiAnalytics.service', () => ({
  getSystemHealth: jest.fn(async () => ({
    health: {
      aiEnabled: true,
      aiGatewayStatus: 'operational',
      model: 'gemini-flash-latest',
      provider: 'gemini',
      timestamp: '2026-01-01T00:00:00.000Z',
    },
  })),
}));

describe('Phase 1 - AI Enhancement APIs', () => {
  let studentToken;
  let teacherToken;
  let adminToken;

  beforeAll(async () => {
    studentToken = await loginByRole('student');
    teacherToken = await loginByRole('teacher');
    adminToken = await loginByRole('admin');
  });

  describe('Student AI enhancement validation', () => {
    it('returns 401 for learning path without authentication', async () => {
      const res = await request(app).get('/api/student/ai/learning-path').query({ courseId: 1 });
      expect(res.status).toBe(401);
    });

    it('returns 400 for learning path without courseId', async () => {
      const res = await request(app)
        .get('/api/student/ai/learning-path')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for recommendations with invalid type', async () => {
      const res = await request(app)
        .get('/api/student/ai/recommendations')
        .set('Authorization', `Bearer ${studentToken}`)
        .query({ type: 'invalid-type' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for tracking with invalid event type', async () => {
      const res = await request(app)
        .post('/api/student/ai/track-event')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ courseId: 1, eventData: { eventType: 'invalid_event' } });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Teacher AI enhancement validation', () => {
    it('returns 401 for generate-content without authentication', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/generate-content')
        .send({ courseId: 1, chapterId: 1, outlineData: { title: 'a', outline: 'valid outline text' } });
      expect(res.status).toBe(401);
    });

    it('returns 400 for generate-content with missing required fields', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/generate-content')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ courseId: 1 });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for generate-quiz with invalid difficulty', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/generate-quiz')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ lectureId: 1, options: { difficulty: 'invalid' } });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Admin AI enhancement validation and access control', () => {
    it('returns 403 for platform analytics when role is not admin', async () => {
      const res = await request(app)
        .get('/api/admin/ai/platform-analytics')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 400 for platform analytics with invalid groupBy', async () => {
      const res = await request(app)
        .get('/api/admin/ai/platform-analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ groupBy: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 and health payload for admin system health', async () => {
      const res = await request(app)
        .get('/api/admin/ai/system-health')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('health');
      expect(res.body.data.health).toHaveProperty('timestamp');
    });
  });
});
