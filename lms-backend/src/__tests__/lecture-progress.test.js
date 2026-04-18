const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole, TEST_ACCOUNTS } = require('./testAuth');

describe('Lecture Progress API', () => {
  let studentToken;
  let teacherToken;
  let adminToken;
  let studentId;
  let courseId;
  let chapterId;
  let lectureId;
  const createdCourseIds = [];
  const createdChapterIds = [];
  const createdLectureIds = [];

  beforeAll(async () => {
    studentToken = await loginByRole('student');
    teacherToken = await loginByRole('teacher');
    adminToken = await loginByRole('admin');

    const { User } = db.models;
    const student = await User.findOne({ where: { email: TEST_ACCOUNTS.student.email } });
    const teacher = await User.findOne({ where: { email: TEST_ACCOUNTS.teacher.email } });
    expect(student).toBeTruthy();
    expect(teacher).toBeTruthy();

    studentId = student.id;

    const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const courseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: `Progress Test Course ${suffix}`,
        description: 'Deterministic progress test',
        price: 0,
      });
    expect(courseRes.status).toBe(201);
    courseId = courseRes.body.data.course.id;
    createdCourseIds.push(courseId);

    // Route requires admin role in current codebase.
    const publishRes = await request(app)
      .put(`/api/teacher/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });
    expect(publishRes.status).toBe(200);

    const chapterRes = await request(app)
      .post('/api/teacher/chapters')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        courseId,
        title: `Progress Chapter ${suffix}`,
        order: 1,
      });
    expect(chapterRes.status).toBe(201);
    chapterId = chapterRes.body.data.chapter.id;
    createdChapterIds.push(chapterId);

    const lectureRes = await request(app)
      .post(`/api/teacher/chapters/${chapterId}/lectures`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: `Progress Lecture ${suffix}`,
        content: 'Progress test content',
        type: 'video',
        duration: 600,
        order: 1,
      });
    expect(lectureRes.status).toBe(201);
    lectureId = lectureRes.body.data.lecture.id;
    createdLectureIds.push(lectureId);

    const enrollRes = await request(app)
      .post(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(enrollRes.status).toBe(201);
  });

  afterAll(async () => {
    const { Lecture, Chapter, Course, Enrollment } = db.models;
    await Enrollment.destroy({ where: { userId: studentId, courseId } });
    await Lecture.destroy({ where: { id: createdLectureIds } });
    await Chapter.destroy({ where: { id: createdChapterIds } });
    await Course.destroy({ where: { id: createdCourseIds } });
  });

  it('updates lecture progress with valid watchedPercent', async () => {
    const res = await request(app)
      .put(`/api/student/lectures/${lectureId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ watchedPercent: 50 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.progress.isCompleted).toBe(false);
  });

  it('marks lecture as completed at >= 80%', async () => {
    const res = await request(app)
      .put(`/api/student/lectures/${lectureId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ watchedPercent: 85 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.progress.isCompleted).toBe(true);
    expect(res.body.data.progress.completedAt).toBeTruthy();
  });

  it('rejects invalid watchedPercent range', async () => {
    const res = await request(app)
      .put(`/api/student/lectures/${lectureId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ watchedPercent: 150 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns student course progress after completion', async () => {
    const res = await request(app)
      .get(`/api/progress/courses/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.courseProgress).toBe(100);
    expect(Array.isArray(res.body.data.lecturesProgress)).toBe(true);
  });

  it('allows course owner teacher to read all students progress', async () => {
    const res = await request(app)
      .get(`/api/teacher/courses/${courseId}/progress`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.studentsProgress)).toBe(true);
  });

  it('allows course owner teacher to read a specific student progress', async () => {
    const res = await request(app)
      .get(`/api/teacher/courses/${courseId}/students/${studentId}/progress`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.student).toBeDefined();
    expect(res.body.data.enrollment).toBeDefined();
  });

  it('rejects non-owner teacher from reading another teacher course progress', async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const email = `other_teacher_${suffix}@test.com`;
    const password = 'Password123@';

    const createTeacherRes = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: `other_teacher_${suffix}`,
        email,
        password,
        name: 'Other Teacher',
        role: 'teacher',
      });
    expect(createTeacherRes.status).toBe(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    expect(loginRes.status).toBe(200);
    const otherTeacherToken = loginRes.body.data.token;

    const res = await request(app)
      .get(`/api/teacher/courses/${courseId}/progress`)
      .set('Authorization', `Bearer ${otherTeacherToken}`);

    expect(res.status).toBe(403);
  });
});
