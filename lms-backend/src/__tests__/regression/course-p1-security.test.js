const request = require('supertest');
const app = require('../../app');
const db = require('../../models');
const { loginByRole } = require('../testAuth');

describe('Course P1 security regressions', () => {
  let adminToken;
  let teacherToken;

  const createdCourseIds = [];
  const createdChapterIds = [];
  const createdLectureIds = [];

  beforeAll(async () => {
    adminToken = await loginByRole('admin');
    teacherToken = await loginByRole('teacher');
  });

  afterAll(async () => {
    const { Lecture, Chapter, Course } = db.models;
    await Lecture.destroy({ where: { id: createdLectureIds } });
    await Chapter.destroy({ where: { id: createdChapterIds } });
    await Course.destroy({ where: { id: createdCourseIds } });
  });

  async function createTeacherCourse(payload = {}) {
    const uniq = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const res = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: `Course P1 ${uniq}`,
        description: 'desc',
        price: 10,
        ...payload,
      });
    expect(res.statusCode).toBe(201);
    const courseId = Number(res.body.data.course.id);
    createdCourseIds.push(courseId);
    return courseId;
  }

  it('teacher create/update cannot set published; admin publish flow remains', async () => {
    const courseId = await createTeacherCourse({ published: true });

    // Teacher create with published=true must still be draft/unpublished
    const ownerGet = await request(app)
      .get(`/api/teacher/courses/${courseId}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(ownerGet.statusCode).toBe(200);
    expect(ownerGet.body.success).toBe(true);
    expect(Boolean(ownerGet.body.data.course.published)).toBe(false);

    // Teacher update with published=true must be ignored
    const update = await request(app)
      .put(`/api/teacher/courses/${courseId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ published: true, title: `Updated ${Date.now()}` });
    expect(update.statusCode).toBe(200);
    expect(update.body.success).toBe(true);
    expect(Boolean(update.body.data.course.published)).toBe(false);

    // Admin publish remains unchanged
    const publish = await request(app)
      .put(`/api/teacher/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });
    expect(publish.statusCode).toBe(200);
    expect(publish.body.success).toBe(true);

    const ownerGetAfter = await request(app)
      .get(`/api/teacher/courses/${courseId}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(ownerGetAfter.statusCode).toBe(200);
    expect(Boolean(ownerGetAfter.body.data.course.published)).toBe(true);
  });

  it('public GET /api/courses/:id sanitizes non-preview lessons', async () => {
    const courseId = await createTeacherCourse();

    const chapter = await db.models.Chapter.create({
      title: `Chapter ${Date.now()}`,
      order: 1,
      courseId,
    });
    createdChapterIds.push(chapter.id);

    const nonPreview = await db.models.Lecture.create({
      title: 'Private Lesson',
      type: 'video',
      content: 'secret private lesson content',
      contentUrl: 'https://example.com/private-video.mp4',
      isPreview: false,
      chapterId: chapter.id,
      order: 1,
      duration: 300,
    });
    createdLectureIds.push(nonPreview.id);

    const preview = await db.models.Lecture.create({
      title: 'Preview Lesson',
      type: 'video',
      content: 'public preview content',
      contentUrl: 'https://example.com/preview-video.mp4',
      isPreview: true,
      chapterId: chapter.id,
      order: 2,
      duration: 120,
    });
    createdLectureIds.push(preview.id);

    const publish = await request(app)
      .put(`/api/teacher/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });
    expect(publish.statusCode).toBe(200);

    const publicDetail = await request(app).get(`/api/courses/${courseId}`);
    expect(publicDetail.statusCode).toBe(200);
    expect(publicDetail.body.success).toBe(true);

    const curriculum = publicDetail.body.data.course.curriculum || [];
    const lessons = curriculum.flatMap(ch => ch.lessons || []);

    const privateLesson = lessons.find(l => l.title === 'Private Lesson');
    expect(privateLesson).toBeTruthy();
    expect(privateLesson.isPreview).toBe(false);
    expect(privateLesson.videoUrl).toBeNull();
    expect(privateLesson.fileUrl).toBeNull();
    expect(privateLesson.content).toBeNull();

    const previewLesson = lessons.find(l => l.title === 'Preview Lesson');
    expect(previewLesson).toBeTruthy();
    expect(previewLesson.isPreview).toBe(true);
    expect(previewLesson.videoUrl).toBe('https://example.com/preview-video.mp4');
    expect(previewLesson.content).toBe('public preview content');
  });
});

