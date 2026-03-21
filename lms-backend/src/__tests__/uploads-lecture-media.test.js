const request = require('supertest');
const app = require('../app');
const path = require('path');
const db = require('../models');
const { seedCore, TEST_PREFIX } = require('./jest.teardown');

async function loginTeacher() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: `${TEST_PREFIX}teacher@example.com`, password: 'Password123@' });

  expect([200, 201]).toContain(res.statusCode);
  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Uploads - lecture media', () => {
  it('POST /api/teacher/chapters/:chapterId/lectures should create lecture with uploaded media', async () => {
    const seeded = await seedCore();
    const token = await loginTeacher();

    const createChapterRes = await request(app)
      .post(`/api/teacher/courses/${seeded.course.id}/chapters`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `${TEST_PREFIX}Chapter for upload`, order: 1 });

    expect(createChapterRes.statusCode).toBe(201);
    expect(createChapterRes.body).toHaveProperty('success', true);

    const chapterId = createChapterRes.body?.data?.chapter?.id;
    expect(chapterId).toBeTruthy();

    const fixturePath = path.join(__dirname, 'fixtures', 'doc.pdf');

    const createLectureReq = request(app)
      .post(`/api/teacher/chapters/${chapterId}/lectures`)
      .set('Authorization', `Bearer ${token}`)
      .field('title', `${TEST_PREFIX}Lecture upload`)
      .field('type', 'video')
      .attach('file', fixturePath);

    const createLectureRes = await createLectureReq;

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      expect(createLectureRes.statusCode).toBe(500);
      expect(String(createLectureRes.body?.error || '')).toMatch(/Cloudinary/);
      return;
    }

    expect(createLectureRes.statusCode).toBe(201);
    expect(createLectureRes.body).toHaveProperty('success', true);
    expect(createLectureRes.body?.data?.lecture?.contentUrl).toBeTruthy();

    const lectureId = createLectureRes.body?.data?.lecture?.id;
    expect(lectureId).toBeTruthy();

    const fixture2 = path.join(__dirname, 'fixtures', 'avatar.png');

    const updateLectureRes = await request(app)
      .put(`/api/teacher/lectures/${lectureId}`)
      .set('Authorization', `Bearer ${token}`)
      .field('title', `${TEST_PREFIX}Lecture upload updated`)
      .attach('file', fixture2);

    expect(updateLectureRes.statusCode).toBe(200);
    expect(updateLectureRes.body).toHaveProperty('success', true);
    expect(updateLectureRes.body?.data?.lecture?.contentUrl).toBeTruthy();

    // cleanup created chapter/lecture
    await db.models.Lecture.destroy({ where: { id: lectureId } });
    await db.models.Chapter.destroy({ where: { id: chapterId } });
  }, 30000);
});
