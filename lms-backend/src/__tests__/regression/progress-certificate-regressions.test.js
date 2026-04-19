const request = require('supertest');
const app = require('../../app');
const db = require('../../models');
const { loginByRole } = require('../testAuth');

describe('Progress/Certificate regressions (learning-state)', () => {
  let adminToken;
  let teacherToken;
  let studentToken;

  const created = {
    courseIds: [],
    chapterIds: [],
    lectureIds: [],
    quizIds: [],
    attemptIds: [],
  };

  beforeAll(async () => {
    adminToken = await loginByRole('admin');
    teacherToken = await loginByRole('teacher');
    studentToken = await loginByRole('student');
  });

  afterAll(async () => {
    const { Attempt, Quiz, LectureProgress, Enrollment, Lecture, Chapter, Course } = db.models;
    await Attempt.destroy({ where: { id: created.attemptIds } });
    await Quiz.destroy({ where: { id: created.quizIds } });
    await LectureProgress.destroy({ where: { lectureId: created.lectureIds } });
    await Enrollment.destroy({ where: { courseId: created.courseIds } });
    await Lecture.destroy({ where: { id: created.lectureIds } });
    await Chapter.destroy({ where: { id: created.chapterIds } });
    await Course.destroy({ where: { id: created.courseIds } });
  });

  async function createPublishedFreeCourseWithLectureAndQuiz() {
    const uniq = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // Create course via API to satisfy required fields (slug, createdBy, etc.)
    const courseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: `Prog Course ${uniq}`, description: 'seed', price: 0 });
    expect(courseRes.statusCode).toBe(201);
    const courseId = Number(courseRes.body.data.course.id);
    created.courseIds.push(courseId);

    // Publish via admin (per current authz rules)
    const pubRes = await request(app)
      .put(`/api/teacher/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });
    expect(pubRes.statusCode).toBe(200);

    // Create chapter + lecture + quiz via models (avoid upload middleware)
    const chapter = await db.models.Chapter.create({
      title: `Ch ${uniq}`,
      description: 'seed',
      order: 1,
      courseId,
    });
    created.chapterIds.push(chapter.id);

    const lecture = await db.models.Lecture.create({
      title: `Lec ${uniq}`,
      type: 'video',
      duration: 120,
      order: 1,
      chapterId: chapter.id,
      isPreview: false,
    });
    created.lectureIds.push(lecture.id);

    const teacher = await db.models.User.findOne({ where: { role: 'teacher' }, attributes: ['id'] });
    expect(teacher).toBeTruthy();

    const quiz = await db.models.Quiz.create({
      title: `Quiz ${uniq}`,
      description: 'seed',
      maxScore: 100,
      passingScore: 60,
      status: 'published',
      courseId,
      chapterId: chapter.id,
      createdBy: teacher.id,
    });
    created.quizIds.push(quiz.id);

    return { courseId, lectureId: lecture.id, quizId: quiz.id };
  }

  it('dashboard progress is consistent with course progress (lectures + quizzes)', async () => {
    const { courseId, lectureId, quizId } = await createPublishedFreeCourseWithLectureAndQuiz();

    // enroll student
    const enrollRes = await request(app)
      .post(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(enrollRes.statusCode).toBe(201);

    // complete lecture (>=80%)
    const lpRes = await request(app)
      .put(`/api/student/lectures/${lectureId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ watchedPercent: 80 });
    expect(lpRes.statusCode).toBe(200);

    // pass quiz (Attempt passed=true)
    const student = await db.models.User.findOne({ where: { role: 'student' }, attributes: ['id'] });
    expect(student).toBeTruthy();
    const attempt = await db.models.Attempt.create({
      userId: student.id,
      quizId,
      answers: {},
      score: 80,
      percentageScore: 80,
      passed: true,
      startedAt: new Date(),
      completedAt: new Date(),
    });
    created.attemptIds.push(attempt.id);

    // course progress endpoint
    const courseProgRes = await request(app)
      .get(`/api/progress/courses/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(courseProgRes.statusCode).toBe(200);
    expect(courseProgRes.body.success).toBe(true);
    expect(Number(courseProgRes.body.data.courseProgress)).toBe(100);

    // dashboard endpoint (canonical progress router)
    const dashRes = await request(app)
      .get('/api/progress/dashboard')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(dashRes.statusCode).toBe(200);
    expect(dashRes.body.success).toBe(true);

    const found = (dashRes.body.data.recentProgress || []).find(r => Number(r.courseId) === Number(courseId));
    expect(found).toBeTruthy();
    expect(Number(found.progressPercent)).toBe(100);
  });

  it('certificate eligibility is correct (requires full completion) and completedAt is derived', async () => {
    const { courseId, lectureId, quizId } = await createPublishedFreeCourseWithLectureAndQuiz();

    const enrollRes = await request(app)
      .post(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(enrollRes.statusCode).toBe(201);

    // not completed yet → not eligible
    const ineligibleRes = await request(app)
      .get(`/api/student/courses/${courseId}/certificate`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(ineligibleRes.statusCode).toBe(200);
    expect(ineligibleRes.body.success).toBe(true);
    expect(ineligibleRes.body.data.isEligible).toBe(false);

    // complete lecture + pass quiz
    const lpRes = await request(app)
      .put(`/api/student/lectures/${lectureId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ watchedPercent: 80 });
    expect(lpRes.statusCode).toBe(200);

    const student = await db.models.User.findOne({ where: { role: 'student' }, attributes: ['id'] });
    const attempt = await db.models.Attempt.create({
      userId: student.id,
      quizId,
      answers: {},
      score: 80,
      percentageScore: 80,
      passed: true,
      startedAt: new Date(),
      completedAt: new Date(),
    });
    created.attemptIds.push(attempt.id);

    const eligibleRes = await request(app)
      .get(`/api/student/courses/${courseId}/certificate`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(eligibleRes.statusCode).toBe(200);
    expect(eligibleRes.body.success).toBe(true);
    expect(eligibleRes.body.data.isEligible).toBe(true);
    expect(Number(eligibleRes.body.data.progressPercent)).toBe(100);
    expect(eligibleRes.body.data.quizRequirement?.allPassed).toBe(true);
    expect(eligibleRes.body.data.completedAt).toBeTruthy();
    expect(eligibleRes.body.data.certificateData).toBeTruthy();
  });

  it.skip('certificate download returns a PDF for eligible student', async () => {
    const { courseId, lectureId, quizId } = await createPublishedFreeCourseWithLectureAndQuiz();

    const enrollRes = await request(app)
      .post(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(enrollRes.statusCode).toBe(201);

    await request(app)
      .put(`/api/student/lectures/${lectureId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ watchedPercent: 80 });

    const student = await db.models.User.findOne({ where: { role: 'student' }, attributes: ['id'] });
    const attempt = await db.models.Attempt.create({
      userId: student.id,
      quizId,
      answers: {},
      score: 80,
      percentageScore: 80,
      passed: true,
      startedAt: new Date(),
      completedAt: new Date(),
    });
    created.attemptIds.push(attempt.id);

    const pdfRes = await request(app)
      .get(`/api/certificate/download/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(pdfRes.statusCode).toBe(200);
    expect(String(pdfRes.headers['content-type'] || '')).toContain('application/pdf');
    expect(pdfRes.body).toBeTruthy();
  });

  it('unenroll then progress update is denied (403)', async () => {
    const { courseId, lectureId } = await createPublishedFreeCourseWithLectureAndQuiz();

    const enrollRes = await request(app)
      .post(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(enrollRes.statusCode).toBe(201);

    const unRes = await request(app)
      .delete(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(unRes.statusCode).toBe(200);

    const lpRes = await request(app)
      .put(`/api/student/lectures/${lectureId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ watchedPercent: 80 });
    expect(lpRes.statusCode).toBe(403);
  });

  it('duplicate lecture progress rows are blocked (unique (userId, lectureId))', async () => {
    const { courseId, lectureId } = await createPublishedFreeCourseWithLectureAndQuiz();

    const enrollRes = await request(app)
      .post(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(enrollRes.statusCode).toBe(201);

    const r1 = await request(app)
      .put(`/api/student/lectures/${lectureId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ watchedPercent: 10 });
    expect(r1.statusCode).toBe(200);

    const r2 = await request(app)
      .put(`/api/student/lectures/${lectureId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ watchedPercent: 20 });
    expect(r2.statusCode).toBe(200);

    const student = await db.models.User.findOne({ where: { role: 'student' }, attributes: ['id'] });
    const cnt = await db.models.LectureProgress.count({ where: { userId: student.id, lectureId } });
    expect(cnt).toBe(1);
  });
});

