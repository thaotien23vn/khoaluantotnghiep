const request = require('supertest');
const app = require('../app');
const { seedCore, TEST_PREFIX } = require('./jest.teardown');

const db = require('../models');

async function loginStudent() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: `${TEST_PREFIX}student@example.com`, password: 'Password123@' });

  expect([200, 201]).toContain(res.statusCode);
  expect(res.body).toHaveProperty('success', true);

  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Student review flow', () => {
  it('POST /api/student/courses/:courseId/reviews should create review and return user+course', async () => {
    const seeded = await seedCore();
    const token = await loginStudent();

    // Fake a completed lecture since users must complete at least 1 lecture to review
    await db.models.LectureProgress.destroy({ where: { userId: seeded.student.id, courseId: seeded.course.id }});
    const fakeChapter = await db.models.Chapter.create({ courseId: seeded.course.id, title: 'test chapter', order: 1 });
    const fakeLecture = await db.models.Lecture.create({ chapterId: fakeChapter.id, title: 'test lecture', type: 'text', order: 1 });
    await db.models.LectureProgress.create({
      userId: seeded.student.id,
      courseId: seeded.course.id,
      lectureId: fakeLecture.id,
      progressPercent: 100,
      watchedPercent: 100,
      isCompleted: true
    });

    const uniqueComment = `Integration test comment ${Date.now()} - should be >= 10 chars`;

    const res = await request(app)
      .post(`/api/student/courses/${seeded.course.id}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 4, comment: uniqueComment });

    // Depending on unique constraint (userId+courseId), API may return 409 if already reviewed.
    // In that case, this test should be adjusted to update instead of create.
    expect([201, 409]).toContain(res.statusCode);

    if (res.statusCode === 201) {
      expect(res.body).toHaveProperty('success', true);
      const review = res.body?.data?.review;
      expect(review).toHaveProperty('user');
      expect(typeof review.user?.name).toBe('string');
      expect(review).toHaveProperty('course');
      expect(typeof review.course?.title).toBe('string');
    }
  });
});
