const request = require('supertest');
const app = require('../../app');
const db = require('../../models');
const mediaService = require('../../services/media.service');
const { loginByRole } = require('../testAuth');

describe('Course P2/P3 hardening regressions', () => {
  let adminToken;
  let teacherToken;
  let studentUserId;

  const createdCourseIds = [];
  const createdChapterIds = [];
  const createdLectureIds = [];

  beforeAll(async () => {
    adminToken = await loginByRole('admin');
    teacherToken = await loginByRole('teacher');
    await loginByRole('student');
    const student = await db.models.User.findOne({ where: { role: 'student' } });
    studentUserId = student?.id;
  });

  afterAll(async () => {
    const { Lecture, Chapter, Course, Payment, Enrollment, Review, LectureProgress } = db.models;
    await Payment.destroy({ where: { courseId: createdCourseIds } });
    await Review.destroy({ where: { courseId: createdCourseIds } });
    await Enrollment.destroy({ where: { courseId: createdCourseIds } });
    await LectureProgress.destroy({ where: { courseId: createdCourseIds } });
    await Lecture.destroy({ where: { id: createdLectureIds } });
    await Chapter.destroy({ where: { id: createdChapterIds } });
    await Course.destroy({ where: { id: createdCourseIds } });
  });

  async function createTeacherCourse(titlePrefix = 'P2P3 Course') {
    const uniq = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const res = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: `${titlePrefix} ${uniq}`,
        description: 'regression',
        price: 49,
      });
    expect(res.statusCode).toBe(201);
    const courseId = Number(res.body.data.course.id);
    createdCourseIds.push(courseId);
    return courseId;
  }

  async function publishCourse(courseId) {
    const publish = await request(app)
      .put(`/api/teacher/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });
    expect(publish.statusCode).toBe(200);
  }

  it('teacher edit on published course forces pending_review (re-review required)', async () => {
    const courseId = await createTeacherCourse('ReReview');
    await publishCourse(courseId);

    const update = await request(app)
      .put(`/api/teacher/courses/${courseId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: `Edited ${Date.now()}` });
    expect(update.statusCode).toBe(200);
    expect(update.body).toHaveProperty('success', true);

    const ownerGet = await request(app)
      .get(`/api/teacher/courses/${courseId}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(ownerGet.statusCode).toBe(200);
    expect(ownerGet.body.data.course.status).toBe('pending_review');
    expect(Boolean(ownerGet.body.data.course.published)).toBe(false);
  });

  it('delete course cleans core dependencies and executes media cleanup path', async () => {
    const mediaSpy = jest
      .spyOn(mediaService, 'deleteMediaByUrl')
      .mockResolvedValue({ success: true });

    const courseId = await createTeacherCourse('Cleanup');
    const chapter = await db.models.Chapter.create({
      title: `Chapter ${Date.now()}`,
      order: 1,
      courseId,
    });
    createdChapterIds.push(chapter.id);

    const lecture = await db.models.Lecture.create({
      title: 'Cleanup lecture',
      type: 'video',
      content: 'cleanup',
      contentUrl: 'https://demo.supabase.co/storage/v1/object/public/lms-media/lectures/test.mp4',
      chapterId: chapter.id,
      order: 1,
      isPreview: false,
    });
    createdLectureIds.push(lecture.id);

    await db.models.Enrollment.create({
      userId: studentUserId,
      courseId,
      status: 'enrolled',
      progressPercent: 0,
    });
    await db.models.LectureProgress.create({
      userId: studentUserId,
      lectureId: lecture.id,
      courseId,
      watchedPercent: 30,
      isCompleted: false,
      lastAccessedAt: new Date(),
    });
    await db.models.Payment.create({
      userId: studentUserId,
      courseId,
      amount: 49,
      provider: 'mock',
      providerTxn: `txn_${Date.now()}`,
      status: 'pending',
    });
    await db.models.Review.create({
      userId: studentUserId,
      courseId,
      rating: 5,
      comment: 'Bai hoc rat huu ich!!!',
    });

    const del = await request(app)
      .delete(`/api/teacher/courses/${courseId}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(del.statusCode).toBe(200);
    expect(del.body).toHaveProperty('success', true);

    expect(await db.models.Course.count({ where: { id: courseId } })).toBe(0);
    expect(await db.models.Chapter.count({ where: { courseId } })).toBe(0);
    expect(await db.models.Lecture.count({ where: { chapterId: chapter.id } })).toBe(0);
    expect(await db.models.Enrollment.count({ where: { courseId } })).toBe(0);
    expect(await db.models.LectureProgress.count({ where: { courseId } })).toBe(0);
    expect(await db.models.Payment.count({ where: { courseId } })).toBe(0);
    expect(await db.models.Review.count({ where: { courseId } })).toBe(0);
    expect(mediaSpy).toHaveBeenCalled();

    mediaSpy.mockRestore();
  });
});
