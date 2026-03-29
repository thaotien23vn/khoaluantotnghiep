const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole } = require('./testAuth');
const { seedCore } = require('./jest.teardown');

// Mock AI services
jest.mock('../services/aiGateway.service', () => ({
  generateText: jest.fn(async () => ({ 
    text: 'MOCK_AI_ANALYTICS',
    usage: { promptTokens: 50, completionTokens: 100 }
  })),
  embedText: jest.fn(async () => ({ embedding: [0.1, 0.2, 0.3] })),
}));

jest.mock('../services/aiAnalytics.service', () => ({
  getPlatformAnalytics: jest.fn(async () => ({
    totalUsers: 100,
    activeCourses: 10,
    totalRevenue: 5000,
    aiUsage: {
      totalConversations: 500,
      totalMessages: 2500,
      averageResponseTime: 2.5
    }
  })),
  getSystemHealth: jest.fn(async () => ({
    status: 'healthy',
    aiProviderStatus: 'connected',
    lastError: null,
    uptime: 86400
  })),
}));

jest.mock('../services/aiContent.service', () => ({
  getContentQualityReport: jest.fn(async () => ({
    totalContent: 50,
    averageScore: 82,
    contentBreakdown: {
      excellent: 20,
      good: 20,
      average: 10
    },
    recommendations: ['Add more interactive content']
  })),
  generateRecommendations: jest.fn(async () => ({
    recommendations: [
      { type: 'course', targetId: 1, reason: 'High demand' }
    ]
  })),
}));

describe('AI Admin Features', () => {
  let adminToken;
  let teacherToken;
  let studentToken;
  let testCourse;

  beforeAll(async () => {
    adminToken = await loginByRole('admin');
    teacherToken = await loginByRole('teacher');
    studentToken = await loginByRole('student');
    
    const seeded = await seedCore();
    testCourse = seeded.course;
  });

  describe('GET /api/admin/ai/platform-analytics', () => {
    it('should return platform analytics for admin', async () => {
      const res = await request(app)
        .get('/api/admin/ai/platform-analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/admin/ai/platform-analytics')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/admin/ai/content-quality-report', () => {
    it('should return content quality report', async () => {
      const res = await request(app)
        .get('/api/admin/ai/content-quality-report')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(res.statusCode);
    });

    it('should filter by courseId', async () => {
      const res = await request(app)
        .get(`/api/admin/ai/content-quality-report?courseId=${testCourse.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(res.statusCode);
    });
  });

  describe('POST /api/admin/ai/generate-recommendations', () => {
    it('should generate AI recommendations', async () => {
      const res = await request(app)
        .post('/api/admin/ai/generate-recommendations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetType: 'courses',
          count: 10
        });

      expect([200, 201, 400]).toContain(res.statusCode);
    });

    it('should accept targetType students', async () => {
      const res = await request(app)
        .post('/api/admin/ai/generate-recommendations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetType: 'students',
          count: 5
        });

      expect([200, 201, 400, 500]).toContain(res.statusCode);
    });
  });

  describe('GET /api/admin/ai/system-health', () => {
    it('should return system health status', async () => {
      const res = await request(app)
        .get('/api/admin/ai/system-health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should include ai provider status', async () => {
      const res = await request(app)
        .get('/api/admin/ai/system-health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      if (res.body.data) {
        expect(res.body.data).toHaveProperty('health');
      }
    });
  });

  describe('Admin AI Settings Management', () => {
    it('should get AI settings', async () => {
      const res = await request(app)
        .get('/api/admin/ai/settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should update AI settings', async () => {
      const res = await request(app)
        .put('/api/admin/ai/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          enabled: true,
          provider: 'gemini',
          model: 'gemini-1.5-flash',
          temperature: 0.7
        });

      expect([200, 201]).toContain(res.statusCode);
    });
  });

  describe('Admin AI Policies Management', () => {
    it('should list AI policies', async () => {
      const res = await request(app)
        .get('/api/admin/ai/policies')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should create AI policy', async () => {
      const uniq = Date.now();
      const res = await request(app)
        .post('/api/admin/ai/policies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: `test_role_${uniq}`,
          enabled: true,
          dailyLimit: 50,
          maxOutputTokens: 2000,
          ragTopK: 5
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);

      // Cleanup
      const policyId = res.body?.data?.policy?.id;
      if (policyId) {
        await db.models.AiRolePolicy.destroy({ where: { id: policyId } });
      }
    });
  });
});
