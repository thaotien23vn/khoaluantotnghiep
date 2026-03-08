const request = require('supertest');
const app = require('../app');
const { loginByRole } = require('./testAuth');

async function getAnyTeacherCourse(token) {
  const res = await request(app)
    .get('/api/teacher/courses?page=1&limit=20')
    .set('Authorization', `Bearer ${token}`);

  expect(res.statusCode).toBe(200);
  expect(res.body).toHaveProperty('success', true);

  const courses = res.body?.data?.courses;
  expect(Array.isArray(courses)).toBe(true);
  expect(courses.length).toBeGreaterThan(0);

  return courses[0];
}

describe('Teacher core (existing course)', () => {
  it('GET /api/teacher/courses/:id should work for existing teacher course', async () => {
    const token = await loginByRole('teacher');
    const course = await getAnyTeacherCourse(token);

    const res = await request(app)
      .get(`/api/teacher/courses/${course.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.course).toBeTruthy();
  });

  it('GET /api/teacher/courses/:courseId/chapters should return chapters list', async () => {
    const token = await loginByRole('teacher');
    const course = await getAnyTeacherCourse(token);

    const res = await request(app)
      .get(`/api/teacher/courses/${course.id}/chapters`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data).toHaveProperty('chapters');
    expect(Array.isArray(res.body?.data?.chapters)).toBe(true);
  });

  it('GET /api/teacher/courses/:courseId/enrollments should return enrollments list', async () => {
    const token = await loginByRole('teacher');
    const course = await getAnyTeacherCourse(token);

    const res = await request(app)
      .get(`/api/teacher/courses/${course.id}/enrollments`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data).toHaveProperty('enrollments');
    expect(Array.isArray(res.body?.data?.enrollments)).toBe(true);
  });
});
