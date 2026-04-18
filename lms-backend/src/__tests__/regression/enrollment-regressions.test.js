const request = require('supertest');
const app = require('../../app');
const db = require('../../models');
const { loginByRole } = require('../testAuth');

describe('Enrollment regressions', () => {
  let adminToken;
  let teacherToken;
  let studentToken;

  const createdCourseIds = [];
  const createdChapterIds = [];
  const createdLectureIds = [];

  beforeAll(async () => {
    adminToken = await loginByRole('admin');
    teacherToken = await loginByRole('teacher');
    studentToken = await loginByRole('student');
  });

  afterAll(async () => {
    const { Enrollment, LectureProgress, Lecture, Chapter, Course } = db.models;
    await LectureProgress.destroy({ where: { courseId: createdCourseIds } });
    await Enrollment.destroy({ where: { courseId: createdCourseIds } });
    await Lecture.destroy({ where: { id: createdLectureIds } });
    await Chapter.destroy({ where: { id: createdChapterIds } });
    await Course.destroy({ where: { id: createdCourseIds } });
  });

  async function createTeacherCourse({ published }) {
    const uniq = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const courseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: `Enroll Regression ${uniq}`, description: 'seed', price: 0 });
    expect(courseRes.statusCode).toBe(201);
    const courseId = Number(courseRes.body.data.course.id);
    createdCourseIds.push(courseId);

    if (published) {
      const publishRes = await request(app)
        .put(`/api/teacher/courses/${courseId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ published: true });
      expect(publishRes.statusCode).toBe(200);
    }

    return courseId;
  }

  it('blocks enroll for unpublished course', async () => {
    const courseId = await createTeacherCourse({ published: false });
    const res = await request(app)
      .post(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('blocks teacher from calling student enroll endpoint', async () => {
    const courseId = await createTeacherCourse({ published: true });
    const res = await request(app)
      .post(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.statusCode).toBe(403);
  });

  it('blocks duplicate enroll (sequential)', async () => {
    const courseId = await createTeacherCourse({ published: true });

    const first = await request(app)
      .post(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(first.statusCode).toBe(201);

    const second = await request(app)
      .post(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(second.statusCode).toBe(409);
    expect(second.body.success).toBe(false);
  });

  it('prevents race-condition double insert (parallel enroll)', async () => {
    const courseId = await createTeacherCourse({ published: true });

    const [a, b] = await Promise.allSettled([
      request(app).post(`/api/student/enroll/${courseId}`).set('Authorization', `Bearer ${studentToken}`),
      request(app).post(`/api/student/enroll/${courseId}`).set('Authorization', `Bearer ${studentToken}`),
    ]);

    const statuses = [a, b].map((r) => (r.status === 'fulfilled' ? r.value.statusCode : null)).sort();
    // One should succeed (201), the other must be conflict (409)
    expect(statuses).toEqual([201, 409]);
  });

  it('student cannot view enrollment detail for a course they are not enrolled in', async () => {
    const courseId = await createTeacherCourse({ published: true });

    const res = await request(app)
      .get(`/api/student/enrollments/course/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(404);
  });

  it('unenroll removes per-course LectureProgress rows', async () => {
    const courseId = await createTeacherCourse({ published: true });

    // Create chapter + lecture
    const chapterRes = await request(app)
      .post('/api/teacher/chapters')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ courseId, title: 'Ch 1', order: 1 });
    expect(chapterRes.statusCode).toBe(201);
    const chapterId = Number(chapterRes.body.data.chapter.id);
    createdChapterIds.push(chapterId);

    const lectureRes = await request(app)
      .post(`/api/teacher/chapters/${chapterId}/lectures`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'L 1', content: 'content', type: 'video', duration: 600, order: 1 });
    expect(lectureRes.statusCode).toBe(201);
    const lectureId = Number(lectureRes.body.data.lecture.id);
    createdLectureIds.push(lectureId);

    // Enroll and create progress
    const enrollRes = await request(app)
      .post(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect([201, 409]).toContain(enrollRes.statusCode);

    const progressRes = await request(app)
      .put(`/api/student/lectures/${lectureId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ watchedPercent: 50 });
    expect(progressRes.statusCode).toBe(200);

    const { User } = db.models;
    const student = await User.findOne({ where: { role: 'student' }, attributes: ['id'] });
    expect(student).toBeTruthy();

    const beforeCount = await db.models.LectureProgress.count({
      where: { userId: student.id, courseId },
    });
    expect(beforeCount).toBeGreaterThan(0);

    // Unenroll should cleanup LectureProgress
    const unenrollRes = await request(app)
      .delete(`/api/student/enroll/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(unenrollRes.statusCode).toBe(200);

    const afterCount = await db.models.LectureProgress.count({
      where: { userId: student.id, courseId },
    });
    expect(afterCount).toBe(0);
  });
});

