const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole, TEST_ACCOUNTS } = require('./testAuth');

/**
 * Lecture Progress API Tests
 * Tests auto-tracking progress when watching lectures
 */
describe('Lecture Progress API', () => {
  let studentToken;
  let teacherToken;
  let courseId;
  let lectureId;
  let studentId;
  let teacherId;
  let chapterId;

  beforeAll(async () => {
    // Use standard test accounts from testAuth
    studentToken = await loginByRole('student');
    teacherToken = await loginByRole('teacher');

    // Get user IDs from database using emails from testAuth
    const { User } = db.models;
    const student = await User.findOne({ where: { email: 'student@gmail.com' } });
    const teacher = await User.findOne({ where: { email: 'teacher@gmail.com' } });
    
    if (!student || !teacher) {
      throw new Error('Test accounts not found in database');
    }
    
    studentId = student.id;
    teacherId = teacher.id;

    // Create course as teacher
    const courseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Progress Test Course',
        description: 'Test Description',
        price: 0,
      });

    courseId = courseRes.body.data.course.id;

    // Publish the course
    await request(app)
      .put(`/api/teacher/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ published: true });

    // Verify course ownership
    const course = await db.models.Course.findByPk(courseId);
    
    // Create chapter
    const chapterRes = await request(app)
      .post(`/api/teacher/courses/${courseId}/chapters`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Progress Test Chapter',
        order: 1,
      });

    chapterId = chapterRes.body.data.chapter.id;

    // Create lecture
    const lectureRes = await request(app)
      .post(`/api/teacher/chapters/${chapterId}/lectures`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Progress Test Lecture',
        content: 'Test content',
        type: 'video',
        duration: 600,
        order: 1,
      });

    lectureId = lectureRes.body.data.lecture.id;

    // Enroll student
    await request(app)
      .post(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  describe('PUT /api/student/lectures/:lectureId/progress', () => {
    it('should update lecture progress with 50% watched', async () => {
      const res = await request(app)
        .put(`/api/student/lectures/${lectureId}/progress`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ watchedPercent: 50 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.progress.watchedPercent).toBeDefined();
      expect(res.body.data.progress.isCompleted).toBe(false);
    });

    it('should auto-mark lecture as completed when watched 80%+', async () => {
      const res = await request(app)
        .put(`/api/student/lectures/${lectureId}/progress`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ watchedPercent: 85 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.progress.isCompleted).toBe(true);
      expect(res.body.data.progress.completedAt).toBeDefined();
    });

    it('should auto-update course progress percentage', async () => {
      // First check course progress
      const progressRes = await request(app)
        .get(`/api/student/student-courses/${courseId}/progress`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(progressRes.status).toBe(200);
      expect(progressRes.body.data.courseProgress).toBe(100); // 1/1 lectures completed = 100%
    });

    it('should fail if not enrolled', async () => {
      // Create another course without enrollment
      const otherCourse = await request(app)
        .post('/api/teacher/courses')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Other Course', price: 0 });

      const otherChapter = await request(app)
        .post(`/api/teacher/courses/${otherCourse.body.data.course.id}/chapters`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Chapter', order: 1 });

      const otherLecture = await request(app)
        .post(`/api/teacher/chapters/${otherChapter.body.data.chapter.id}/lectures`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Other Lecture',
          content: 'content',
          type: 'video',
          order: 1,
        });

      const res = await request(app)
        .put(`/api/student/lectures/${otherLecture.body.data.lecture.id}/progress`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ watchedPercent: 50 });

      expect(res.status).toBe(403);
    });

    it('should validate watchedPercent range', async () => {
      const res = await request(app)
        .put(`/api/student/lectures/${lectureId}/progress`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ watchedPercent: 150 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/student/student-courses/:courseId/progress', () => {
    it('should get student course progress with lecture details', async () => {
      const res = await request(app)
        .get(`/api/student/student-courses/${courseId}/progress`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.course).toBeDefined();
      expect(res.body.data.lecturesProgress).toBeDefined();
      expect(Array.isArray(res.body.data.lecturesProgress)).toBe(true);
    });

    it('should fail if not enrolled', async () => {
      const res = await request(app)
        .get('/api/student/student-courses/99999/progress')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/teacher/courses/:courseId/progress', () => {
    it('should get all students progress for course', async () => {
      const res = await request(app)
        .get(`/api/teacher/courses/${courseId}/progress`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalStudents).toBeGreaterThanOrEqual(1);
      expect(res.body.data.studentsProgress).toBeDefined();
      expect(Array.isArray(res.body.data.studentsProgress)).toBe(true);
    });

    it('should fail if teacher does not own the course', async () => {
      // Use Admin to create another teacher because public registration is student-only
      const adminToken = await loginByRole('admin');
      
      const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const uniqueUsername = `teacher_${uniqueSuffix}`;
      const uniqueEmail = `teacher_${uniqueSuffix}@test.com`;
      
      const otherTeacherRes = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: uniqueUsername,
          email: uniqueEmail,
          password: 'Password123@',
          name: 'Other Teacher',
          role: 'teacher',
        });

      expect(otherTeacherRes.status).toBe(201);
      
      // Login as the new teacher to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: uniqueEmail,
          password: 'Password123@'
        });
        
      const otherTeacherToken = loginRes.body.data.token;

      const res = await request(app)
        .get(`/api/teacher/courses/${courseId}/progress`)
        .set('Authorization', `Bearer ${otherTeacherToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/teacher/courses/:courseId/students/:studentId/progress', () => {
    it('should get specific student progress detail', async () => {
      const res = await request(app)
        .get(`/api/teacher/courses/${courseId}/students/${studentId}/progress`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.student).toBeDefined();
      expect(res.body.data.enrollment).toBeDefined();
    });

    it('should include last accessed timestamp', async () => {
      const res = await request(app)
        .get(`/api/teacher/courses/${courseId}/students/${studentId}/progress`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.lastAccessed).toBeDefined();
    });
  });
});
