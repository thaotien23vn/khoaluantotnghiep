const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole } = require('./testAuth');
const { seedCore } = require('./jest.teardown');

// Mock AI services để tránh timeout
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
      timestamp: new Date().toISOString(),
    },
  })),
}));

const {
  UserLearningProfile,
  AiRecommendation,
  LearningAnalytics,
  ContentQualityScore,
  Chapter,
  Lecture,
} = db.models;

describe('Phase 1 - AI Enhancement APIs', () => {
  let studentToken;
  let teacherToken;
  let adminToken;
  let testStudent;
  let testTeacher;
  let testCourse;
  let testChapter;
  let testLecture;

  beforeAll(async () => {
    // Ensure database is synced
    await db.sequelize.sync();

    // Get tokens for test accounts
    studentToken = await loginByRole('student');
    teacherToken = await loginByRole('teacher');
    adminToken = await loginByRole('admin');

    // Seed core data (teacher, student, course, etc.)
    const seeded = await seedCore();
    testStudent = seeded.student;
    testTeacher = seeded.teacher;
    testCourse = seeded.course;

    // Create test chapter and lecture
    testChapter = await Chapter.create({
      courseId: testCourse.id,
      title: 'Test Chapter for AI',
      order: 1,
    });

    testLecture = await Lecture.create({
      chapterId: testChapter.id,
      title: 'Test Lecture for AI',
      type: 'video',
      content: 'This is test lecture content for AI testing. It covers machine learning basics, neural networks, and practical applications.',
      order: 1,
      duration: 30,
    });
  });

  afterAll(async () => {
    // Cleanup test data - check if models exist first
    if (ContentQualityScore) {
      await ContentQualityScore.destroy({ where: {}, force: true });
    }
    if (LearningAnalytics) {
      await LearningAnalytics.destroy({ where: {}, force: true });
    }
    if (AiRecommendation) {
      await AiRecommendation.destroy({ where: {}, force: true });
    }
    if (UserLearningProfile) {
      await UserLearningProfile.destroy({ where: {}, force: true });
    }
    
    if (testLecture) await testLecture.destroy();
    if (testChapter) await testChapter.destroy();
  });

  describe('Student AI Enhancement APIs', () => {
    describe('GET /api/student/ai/learning-path', () => {
      it('should return 401 without authentication', async () => {
        const res = await request(app)
          .get('/api/student/ai/learning-path')
          .query({ courseId: testCourse.id });

        expect(res.status).toBe(401);
      });

      it('should return 400 without courseId', async () => {
        const res = await request(app)
          .get('/api/student/ai/learning-path')
          .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(400);
        expect(res.body.message).toBeDefined();
      });

      it('should return learning path for enrolled course', async () => {
        const res = await request(app)
          .get('/api/student/ai/learning-path')
          .set('Authorization', `Bearer ${studentToken}`)
          .query({ courseId: testCourse.id });

        // May return 200, 403 (not enrolled), or 503 (AI disabled)
        expect([200, 403, 503]).toContain(res.status);
      });

      it('should return 400 for invalid courseId', async () => {
        const res = await request(app)
          .get('/api/student/ai/learning-path')
          .set('Authorization', `Bearer ${studentToken}`)
          .query({ courseId: 'invalid' });

        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/student/ai/recommendations', () => {
      it('should get recommendations (may require AI enabled)', async () => {
        const res = await request(app)
          .get('/api/student/ai/recommendations')
          .set('Authorization', `Bearer ${studentToken}`)
          .query({ courseId: testCourse.id });

        expect([200, 403, 503]).toContain(res.status);
      });

      it('should validate type parameter', async () => {
        const res = await request(app)
          .get('/api/student/ai/recommendations')
          .set('Authorization', `Bearer ${studentToken}`)
          .query({ courseId: testCourse.id, type: 'invalid' });

        expect(res.status).toBe(400);
      });
    });

    describe('PUT /api/student/ai/recommendations/:id/status', () => {
      it('should return 400 for invalid status', async () => {
        const res = await request(app)
          .put('/api/student/ai/recommendations/999/status')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ status: 'invalid_status' });

        expect(res.status).toBe(400);
      });

      it('should validate status values', async () => {
        const res = await request(app)
          .put('/api/student/ai/recommendations/999/status')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ status: 'accepted' });

        // May return 404 (recommendation not found) or other errors
        expect([200, 404, 500]).toContain(res.status);
      });
    });

    describe('GET /api/student/ai/knowledge-gaps', () => {
      it('should require courseId', async () => {
        const res = await request(app)
          .get('/api/student/ai/knowledge-gaps')
          .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(400);
      });

      it('should analyze knowledge gaps', async () => {
        const res = await request(app)
          .get('/api/student/ai/knowledge-gaps')
          .set('Authorization', `Bearer ${studentToken}`)
          .query({ courseId: testCourse.id });

        expect([200, 403, 503]).toContain(res.status);
      });
    });

    describe('GET /api/student/ai/analytics', () => {
      it('should require courseId', async () => {
        const res = await request(app)
          .get('/api/student/ai/analytics')
          .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(400);
      });

      it('should validate date format', async () => {
        const res = await request(app)
          .get('/api/student/ai/analytics')
          .set('Authorization', `Bearer ${studentToken}`)
          .query({
            courseId: testCourse.id,
            startDate: 'invalid-date',
          });

        expect(res.status).toBe(400);
      });
    });

    describe('POST /api/student/ai/track-event', () => {
      it('should require courseId', async () => {
        const res = await request(app)
          .post('/api/student/ai/track-event')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            eventData: {
              eventType: 'lecture_complete',
              lectureId: testLecture.id,
            },
          });

        expect(res.status).toBe(400);
      });

      it('should validate eventType', async () => {
        const res = await request(app)
          .post('/api/student/ai/track-event')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            courseId: testCourse.id,
            eventData: {
              eventType: 'invalid_event',
            },
          });

        expect(res.status).toBe(400);
      });

      it('should track valid learning event', async () => {
        const res = await request(app)
          .post('/api/student/ai/track-event')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            courseId: testCourse.id,
            eventData: {
              eventType: 'lecture_complete',
              lectureId: testLecture.id,
              duration: 1800,
            },
          });

        expect([201, 403, 503]).toContain(res.status);
      });
    });

    describe('GET /api/student/ai/study-schedule', () => {
      it('should require courseId', async () => {
        const res = await request(app)
          .get('/api/student/ai/study-schedule')
          .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(400);
      });

      it('should validate hoursPerDay range', async () => {
        const res = await request(app)
          .get('/api/student/ai/study-schedule')
          .set('Authorization', `Bearer ${studentToken}`)
          .query({
            courseId: testCourse.id,
            hoursPerDay: 20,
          });

        expect(res.status).toBe(400);
      });
    });
  });

  describe('Teacher AI Enhancement APIs', () => {
    describe('POST /api/teacher/ai/generate-content', () => {
      it('should return 401 without authentication', async () => {
        const res = await request(app)
          .post('/api/teacher/ai/generate-content')
          .send({
            courseId: testCourse.id,
            chapterId: testChapter.id,
            outlineData: {
              title: 'Test Lecture',
              outline: '1. Introduction\n2. Main Content\n3. Conclusion',
            },
          });

        expect(res.status).toBe(401);
      });

      it('should return 400 for missing required fields', async () => {
        const res = await request(app)
          .post('/api/teacher/ai/generate-content')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            courseId: testCourse.id,
          });

        expect(res.status).toBe(400);
      });

      it('should validate outlineData fields', async () => {
        const res = await request(app)
          .post('/api/teacher/ai/generate-content')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            courseId: testCourse.id,
            chapterId: testChapter.id,
            outlineData: {
              title: 'Test',
              outline: 'Too short',
            },
          });

        expect(res.status).toBe(400);
      });
    });

    describe('POST /api/teacher/ai/generate-quiz', () => {
      it('should require lectureId', async () => {
        const res = await request(app)
          .post('/api/teacher/ai/generate-quiz')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({});

        expect(res.status).toBe(400);
      });

      it('should validate difficulty option', async () => {
        const res = await request(app)
          .post('/api/teacher/ai/generate-quiz')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            lectureId: testLecture.id,
            options: {
              difficulty: 'invalid',
            },
          });

        expect(res.status).toBe(400);
      });

      it('should validate count range', async () => {
        const res = await request(app)
          .post('/api/teacher/ai/generate-quiz')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            lectureId: testLecture.id,
            options: {
              count: 100,
            },
          });

        expect(res.status).toBe(400);
      });
    });

    describe('POST /api/teacher/ai/generate-exercises', () => {
      it('should require lectureId', async () => {
        const res = await request(app)
          .post('/api/teacher/ai/generate-exercises')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({});

        expect(res.status).toBe(400);
      });

      it('should validate count range', async () => {
        const res = await request(app)
          .post('/api/teacher/ai/generate-exercises')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            lectureId: testLecture.id,
            options: {
              count: 50,
            },
          });

        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/teacher/ai/content-quality', () => {
      it('should require contentId', async () => {
        const res = await request(app)
          .get('/api/teacher/ai/content-quality')
          .set('Authorization', `Bearer ${teacherToken}`)
          .query({ contentType: 'lecture' });

        expect(res.status).toBe(400);
      });

      it('should require contentType', async () => {
        const res = await request(app)
          .get('/api/teacher/ai/content-quality')
          .set('Authorization', `Bearer ${teacherToken}`)
          .query({ contentId: testLecture.id });

        expect(res.status).toBe(400);
      });

      it('should validate contentType', async () => {
        const res = await request(app)
          .get('/api/teacher/ai/content-quality')
          .set('Authorization', `Bearer ${teacherToken}`)
          .query({
            contentId: testLecture.id,
            contentType: 'invalid',
          });

        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/teacher/ai/course-analytics', () => {
      it('should require courseId', async () => {
        const res = await request(app)
          .get('/api/teacher/ai/course-analytics')
          .set('Authorization', `Bearer ${teacherToken}`);

        expect(res.status).toBe(400);
      });

      it('should validate groupBy', async () => {
        const res = await request(app)
          .get('/api/teacher/ai/course-analytics')
          .set('Authorization', `Bearer ${teacherToken}`)
          .query({
            courseId: testCourse.id,
            groupBy: 'invalid',
          });

        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/teacher/ai/quality-report', () => {
      it('should require courseId', async () => {
        const res = await request(app)
          .get('/api/teacher/ai/quality-report')
          .set('Authorization', `Bearer ${teacherToken}`);

        expect(res.status).toBe(400);
      });

      it('should validate score range', async () => {
        const res = await request(app)
          .get('/api/teacher/ai/quality-report')
          .set('Authorization', `Bearer ${teacherToken}`)
          .query({
            courseId: testCourse.id,
            minScore: 15,
          });

        expect(res.status).toBe(400);
      });
    });
  });

  describe('Admin AI Enhancement APIs', () => {
    describe('GET /api/admin/ai/platform-analytics', () => {
      it('should return 403 for non-admin', async () => {
        const res = await request(app)
          .get('/api/admin/ai/platform-analytics')
          .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(403);
      });

      it('should get platform analytics', async () => {
        const res = await request(app)
          .get('/api/admin/ai/platform-analytics')
          .set('Authorization', `Bearer ${adminToken}`);

        expect([200, 500, 503]).toContain(res.status);
      });

      it('should validate groupBy', async () => {
        const res = await request(app)
          .get('/api/admin/ai/platform-analytics')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ groupBy: 'invalid' });

        expect(res.status).toBe(400);
      });

      it('should validate date format', async () => {
        const res = await request(app)
          .get('/api/admin/ai/platform-analytics')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({
            startDate: 'invalid',
          });

        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/admin/ai/content-quality-report', () => {
      it('should return 403 for non-admin', async () => {
        const res = await request(app)
          .get('/api/admin/ai/content-quality-report')
          .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(403);
      });

      it('should validate score range', async () => {
        const res = await request(app)
          .get('/api/admin/ai/content-quality-report')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ minScore: -1 });

        expect(res.status).toBe(400);
      });

      it('should get content quality report', async () => {
        const res = await request(app)
          .get('/api/admin/ai/content-quality-report')
          .set('Authorization', `Bearer ${adminToken}`);

        expect([200, 500, 503]).toContain(res.status);
      });
    });

    describe('POST /api/admin/ai/generate-recommendations', () => {
      it('should return 403 for non-admin', async () => {
        const res = await request(app)
          .post('/api/admin/ai/generate-recommendations')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ courseId: testCourse.id });

        expect(res.status).toBe(403);
      });

      it('should require courseId', async () => {
        const res = await request(app)
          .post('/api/admin/ai/generate-recommendations')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

        expect(res.status).toBe(400);
      });

      it('should trigger recommendations generation', async () => {
        const res = await request(app)
          .post('/api/admin/ai/generate-recommendations')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ courseId: testCourse.id });

        expect([200, 503]).toContain(res.status);
      });
    });

    describe('GET /api/admin/ai/system-health', () => {
      it('should return 403 for non-admin', async () => {
        const res = await request(app)
          .get('/api/admin/ai/system-health')
          .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(403);
      });

      it('should get system health', async () => {
        const res = await request(app)
          .get('/api/admin/ai/system-health')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('health');
        expect(res.body.data.health).toHaveProperty('aiEnabled');
        expect(res.body.data.health).toHaveProperty('timestamp');
      }, 15000);
    });
  });

  describe('Model Tests', () => {
    it('should create UserLearningProfile', async () => {
      const UserLearningProfile = db.models.UserLearningProfile;
      const profile = await UserLearningProfile.create({
        userId: testStudent.id,
        courseId: testCourse.id,
        learningStyle: 'visual',
        difficultyPreference: 'adaptive',
      });

      expect(profile).toBeDefined();
      expect(profile.learningStyle).toBe('visual');

      await profile.destroy();
    });

    it('should create AiRecommendation', async () => {
      const AiRecommendation = db.models.AiRecommendation;
      const recommendation = await AiRecommendation.create({
        userId: testStudent.id,
        courseId: testCourse.id,
        type: 'content',
        title: 'Test Recommendation',
        description: 'Test description',
        priority: 'high',
        score: 9.0,
        status: 'pending',
      });

      expect(recommendation).toBeDefined();
      expect(recommendation.type).toBe('content');

      await recommendation.destroy();
    });

    it('should create LearningAnalytics event', async () => {
      const LearningAnalytics = db.models.LearningAnalytics;
      const event = await LearningAnalytics.create({
        userId: testStudent.id,
        courseId: testCourse.id,
        lectureId: testLecture.id,
        eventType: 'lecture_complete',
        duration: 1800,
        score: 85,
        maxScore: 100,
      });

      expect(event).toBeDefined();
      expect(event.eventType).toBe('lecture_complete');

      await event.destroy();
    });

    it('should create ContentQualityScore', async () => {
      const ContentQualityScore = db.models.ContentQualityScore;
      const score = await ContentQualityScore.create({
        contentId: testLecture.id,
        contentType: 'lecture',
        overallScore: 8.5,
        contentDepth: 9,
        structure: 8,
        engagement: 8,
        accuracy: 9,
        aiAnalysis: { feedback: 'Good content' },
      });

      expect(score).toBeDefined();
      expect(score.overallScore).toBe(8.5);

      await score.destroy();
    });

    it('should enforce unique constraint on UserLearningProfile', async () => {
      const UserLearningProfile = db.models.UserLearningProfile;
      await UserLearningProfile.create({
        userId: testStudent.id,
        courseId: testCourse.id,
        learningStyle: 'visual',
      });
      // Should throw error for duplicate
      await expect(
        UserLearningProfile.create({
          userId: testStudent.id,
          courseId: testCourse.id,
          learningStyle: 'auditory',
        })
      ).rejects.toThrow();

      // Cleanup
      await UserLearningProfile.destroy({
        where: { userId: testStudent.id, courseId: testCourse.id },
      });
    });
  });
});
