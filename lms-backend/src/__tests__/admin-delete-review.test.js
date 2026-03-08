const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole } = require('./testAuth');

async function getCurrentUser(token) {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(200);
  expect(res.body).toHaveProperty('success', true);
  expect(res.body?.data?.id).toBeTruthy();
  return res.body.data;
}

describe('Admin delete review (test-created only)', () => {
  it('should create a review as student for a published course and delete it as admin', async () => {
    const adminToken = await loginByRole('admin');
    const teacherToken = await loginByRole('teacher');
    const studentToken = await loginByRole('student');
    const me = await getCurrentUser(studentToken);

    const uniq = Date.now();

    // create a published course (free) as teacher
    const createCourseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: `it_seed_admin_delete_review_course_${uniq}`, description: 'seed', price: 0, published: true });

    expect(createCourseRes.statusCode).toBe(201);
    const courseId = createCourseRes.body?.data?.course?.id;
    expect(courseId).toBeTruthy();

    // Ensure published even if create endpoint ignores `published`
    await request(app)
      .put(`/api/teacher/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ published: true });

    // ensure enrolled (student self-enroll)
    await db.models.Enrollment.destroy({ where: { userId: me.id, courseId } });

    const enrollRes = await request(app)
      .post(`/api/student/courses/${courseId}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`);

    if (![200, 201].includes(enrollRes.statusCode)) {
      // eslint-disable-next-line no-console
      console.log('student enroll failed:', enrollRes.statusCode, enrollRes.body);
    }

    expect([200, 201]).toContain(enrollRes.statusCode);

    // create review
    const createReviewRes = await request(app)
      .post(`/api/student/courses/${courseId}/reviews`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ rating: 5, comment: `it_seed_admin_delete_review_${uniq}` });

    expect([200, 201]).toContain(createReviewRes.statusCode);
    expect(createReviewRes.body).toHaveProperty('success', true);

    const reviewId = createReviewRes.body?.data?.review?.id;
    expect(reviewId).toBeTruthy();

    const deleteRes = await request(app)
      .delete(`/api/admin/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body).toHaveProperty('success', true);

    // cleanup
    await db.models.Review.destroy({ where: { id: reviewId } });
    await db.models.Enrollment.destroy({ where: { userId: me.id, courseId } });
    await db.models.Course.destroy({ where: { id: courseId } });
  });
});
