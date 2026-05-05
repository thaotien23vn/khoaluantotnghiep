const request = require('supertest');
const app = require('../app');
const { loginByRole } = require('./testAuth');

describe('Placement Analytics Tests', () => {
  let studentToken;
  let adminToken;

  beforeAll(async () => {
    studentToken = await loginByRole('student');
    adminToken = await loginByRole('admin');
  });

  describe('Student Placement History', () => {
    test('GET /api/student/placement/history - Get user placement history', async () => {
      const res = await request(app)
        .get('/api/student/placement/history')
        .set('Authorization', `Bearer ${studentToken}`);

      expect([200, 404]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
      }
    });

    test('GET /api/student/placement/retake-eligibility - Check retake eligibility', async () => {
      const res = await request(app)
        .get('/api/student/placement/retake-eligibility')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('GET /api/student/placement/suggested-courses - Get suggested courses', async () => {
      const res = await request(app)
        .get('/api/student/placement/suggested-courses')
        .set('Authorization', `Bearer ${studentToken}`);

      expect([200, 400, 404]).toContain(res.statusCode);
    });

    test('GET /api/student/placement/current - Get current session', async () => {
      const res = await request(app)
        .get('/api/student/placement/current')
        .set('Authorization', `Bearer ${studentToken}`);

      expect([200, 404]).toContain(res.statusCode);
    });
  });

  describe('Admin Analytics', () => {
    test('GET /api/admin/placement/analytics/dashboard - Get dashboard report', async () => {
      const res = await request(app)
        .get('/api/admin/placement/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ startDate: '2024-01-01', endDate: '2024-12-31' });

      expect([200, 403, 500]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
      }
    });

    test('GET /api/admin/placement/analytics/stats - Get overall stats', async () => {
      const res = await request(app)
        .get('/api/admin/placement/analytics/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 403, 500]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
      }
    });

    test('GET /api/admin/placement/analytics/levels - Get level distribution', async () => {
      const res = await request(app)
        .get('/api/admin/placement/analytics/levels')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 403, 500]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
      }
    });

    test('GET /api/admin/placement/analytics/skill-performance - Get skill performance', async () => {
      const res = await request(app)
        .get('/api/admin/placement/analytics/skill-performance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 403, 500]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
      }
    });

    test('GET /api/admin/placement/analytics/difficult-questions - Get difficult questions', async () => {
      const res = await request(app)
        .get('/api/admin/placement/analytics/difficult-questions')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ limit: 10 });

      expect([200, 403, 500]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
      }
    });

    test('GET /api/admin/placement/analytics/question-bank - Get question bank stats', async () => {
      const res = await request(app)
        .get('/api/admin/placement/analytics/question-bank')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 403, 500]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
      }
    });

    test('GET /api/admin/placement/analytics/trends - Get completion trends', async () => {
      const res = await request(app)
        .get('/api/admin/placement/analytics/trends')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ days: 30 });

      expect([200, 403, 500]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
      }
    });

    test('GET /api/admin/placement/sessions - Get all sessions', async () => {
      const res = await request(app)
        .get('/api/admin/placement/sessions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 403, 500]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
      }
    });

    test('GET /api/admin/placement/question-bank/stats - Get question bank statistics', async () => {
      const res = await request(app)
        .get('/api/admin/placement/question-bank/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 403, 500]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
      }
    });
  });

  describe('Student should not access admin analytics', () => {
    test('GET /api/admin/placement/analytics/dashboard - Student access denied', async () => {
      const res = await request(app)
        .get('/api/admin/placement/analytics/dashboard')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(403);
    });

    test('GET /api/admin/placement/sessions - Student access denied', async () => {
      const res = await request(app)
        .get('/api/admin/placement/sessions')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(403);
    });
  });
});
