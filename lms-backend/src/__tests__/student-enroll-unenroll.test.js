const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole } = require('./testAuth');
const { seedCore } = require('./jest.teardown');

async function getCurrentUser(token) {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(200);
  expect(res.body).toHaveProperty('success', true);
  expect(res.body?.data?.id).toBeTruthy();
  return res.body.data;
}

describe('Student enroll/unenroll', () => {
  it('POST then DELETE /api/student/courses/:courseId/enroll should enroll and then unenroll', async () => {
    const seeded = await seedCore();
    const token = await loginByRole('student');
    const me = await getCurrentUser(token);

    // ensure clean state for this student+course
    await db.models.Enrollment.destroy({
      where: { userId: me.id, courseId: seeded.course.id },
    });

    const enrollRes = await request(app)
      .post(`/api/student/enroll/${seeded.course.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect([200, 201]).toContain(enrollRes.statusCode);
    expect(enrollRes.body).toHaveProperty('success', true);

    const enrollment = await db.models.Enrollment.findOne({
      where: { userId: me.id, courseId: seeded.course.id },
    });
    expect(enrollment).toBeTruthy();

    const unenrollRes = await request(app)
      .delete(`/api/student/enroll/${seeded.course.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(unenrollRes.statusCode).toBe(200);
    expect(unenrollRes.body).toHaveProperty('success', true);

    await db.models.Enrollment.destroy({
      where: { userId: me.id, courseId: seeded.course.id },
    });
  });
});
