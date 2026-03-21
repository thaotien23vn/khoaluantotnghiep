const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole } = require('./testAuth');

async function createTestCourseAsTeacher() {
  const teacherToken = await loginByRole('teacher');
  const uniq = Date.now();

  const createCourseRes = await request(app)
    .post('/api/teacher/courses')
    .set('Authorization', `Bearer ${teacherToken}`)
    .send({ title: `it_seed_admin_enroll_course_${uniq}`, description: 'seed', price: 0, published: true });

  expect(createCourseRes.statusCode).toBe(201);
  const courseId = createCourseRes.body?.data?.course?.id;
  expect(courseId).toBeTruthy();

  // Some implementations ignore `published` at creation; force publish to satisfy admin enrollment rules
  await request(app)
    .put(`/api/teacher/courses/${courseId}/publish`)
    .set('Authorization', `Bearer ${teacherToken}`)
    .send({ published: true });

  return { teacherToken, courseId };
}

describe('Admin enrollments (admin enroll/unenroll + list by course/user)', () => {
  it('should enroll a test-created student to a test-created published course, then list, then unenroll', async () => {
    const adminToken = await loginByRole('admin');

    const uniq = Date.now();
    const username = `it_seed_admin_enroll_student_${uniq}`;
    const email = `it_seed_admin_enroll_student_${uniq}@example.com`;

    const createUserRes = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username, email, password: 'Password123@', role: 'student' });

    expect(createUserRes.statusCode).toBe(201);
    const studentId = createUserRes.body?.data?.user?.id;
    expect(studentId).toBeTruthy();

    const { courseId } = await createTestCourseAsTeacher();

    // ensure clean state
    await db.models.Enrollment.destroy({ where: { userId: studentId, courseId } });

    const enrollRes = await request(app)
      .post('/api/admin/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: studentId, courseId });

    if (enrollRes.statusCode !== 201) {
      // eslint-disable-next-line no-console
      console.log('admin enrollments enroll failed:', enrollRes.statusCode, enrollRes.body);
    }

    expect(enrollRes.statusCode).toBe(201);
    expect(enrollRes.body).toHaveProperty('success', true);

    const courseEnrollmentsRes = await request(app)
      .get(`/api/admin/courses/${courseId}/enrollments-admin`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(courseEnrollmentsRes.statusCode).toBe(200);
    expect(courseEnrollmentsRes.body).toHaveProperty('success', true);
    expect(Array.isArray(courseEnrollmentsRes.body?.data?.enrollments)).toBe(true);

    const foundInCourse = courseEnrollmentsRes.body.data.enrollments.find((e) => Number(e.userId) === Number(studentId));
    expect(foundInCourse).toBeTruthy();

    const userEnrollmentsRes = await request(app)
      .get(`/api/admin/users/${studentId}/enrollments`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(userEnrollmentsRes.statusCode).toBe(200);
    expect(userEnrollmentsRes.body).toHaveProperty('success', true);
    expect(Array.isArray(userEnrollmentsRes.body?.data?.enrollments)).toBe(true);

    const foundInUser = userEnrollmentsRes.body.data.enrollments.find((e) => Number(e.courseId) === Number(courseId));
    expect(foundInUser).toBeTruthy();

    const unenrollRes = await request(app)
      .delete('/api/admin/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: studentId, courseId });

    expect(unenrollRes.statusCode).toBe(200);
    expect(unenrollRes.body).toHaveProperty('success', true);

    // cleanup
    await db.models.Enrollment.destroy({ where: { userId: studentId, courseId } });
    await db.models.Course.destroy({ where: { id: courseId } });
    await db.models.User.destroy({ where: { id: studentId } });
  });
});
