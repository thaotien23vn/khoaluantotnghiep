const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { Op } = require('sequelize');
const { loginByRole } = require('./testAuth');

describe('Security Fixes Regression Tests', () => {
  let studentToken;
  let studentId;
  let courseId;

  beforeAll(async () => {
    // Force cleanup if needed
    try {
      await db.models.Course.destroy({ 
        where: { 
          title: { [Op.like]: 'Security Test Course%' } 
        } 
      });
    } catch (e) {
      // Ignore if table doesn't exist yet
    }

    studentToken = await loginByRole('student');
    const userRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${studentToken}`);
    
    if (!userRes.body.data) {
      console.error('Auth check failed:', userRes.statusCode, JSON.stringify(userRes.body));
    }
    studentId = userRes.body.data?.id;

    // Create a dummy published course
    const teacherToken = await loginByRole('teacher');
    const courseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: `Security Test Course ${Date.now()}`,
        description: 'Testing security fixes',
        price: 100,
        published: true
      });
    
    if (!courseRes.body.data || !courseRes.body.data.course) {
      console.error('Course creation failed:', courseRes.statusCode, JSON.stringify(courseRes.body));
    }
    courseId = courseRes.body.data?.course?.id;

    const adminToken = await loginByRole('admin');
    await request(app)
      .put(`/api/teacher/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });
  });

  afterAll(async () => {
    if (courseId) {
      await db.models.Enrollment.destroy({ where: { courseId: Number(courseId) } });
      await db.models.Payment.destroy({ where: { courseId: Number(courseId) } });
      await db.models.Course.destroy({ where: { id: Number(courseId) } });
    }
  });

  describe('1. Status Injection Lockdown', () => {
    it('should NOT grant enrollment when status="completed" is sent to /verify', async () => {
      const res = await request(app)
        .post('/api/student/payments/verify')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ courseId: Number(courseId), status: 'completed' });

      // Verification: Check if enrollment exists
      const enrollment = await db.models.Enrollment.findOne({
        where: { userId: studentId, courseId: Number(courseId) }
      });
      expect(enrollment).toBeNull();
    });

    it('should NOT grant enrollment when status="completed" is sent to /process', async () => {
      const res = await request(app)
        .post('/api/student/payments/process')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ courseId: Number(courseId), status: 'completed' });

      const enrollment = await db.models.Enrollment.findOne({
        where: { userId: studentId, courseId: Number(courseId) }
      });
      expect(enrollment).toBeNull();
    });
  });

  describe('2. Legacy Enrollment Bypass Lockdown', () => {
    it('should block access for null-status records that are past expiration', async () => {
      // Create a legacy-style enrollment record
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      await db.models.Enrollment.create({
        userId: studentId,
        courseId: Number(courseId),
        status: 'enrolled',
        enrollmentStatus: null, // Legacy null
        expiresAt: expiredDate,
        progressPercent: 0
      });

      // We hit the enrolled content endpoint which uses checkAccess internally
      const accessRes = await request(app)
        .get(`/api/student/enrolled-courses/${courseId}/content`)
        .set('Authorization', `Bearer ${studentToken}`);

      // Expect a 403 Forbidden because of expiration
      expect(accessRes.statusCode).toBe(403);
      expect(accessRes.body.success).toBe(false);
      expect(accessRes.body.message).toContain('hết hạn');

      // Cleanup
      await db.models.Enrollment.destroy({ where: { userId: studentId, courseId: Number(courseId) } });
    });
  });
});
