const request = require('supertest');
const app = require('../app');
const { seedCore, TEST_PREFIX } = require('./jest.teardown');

async function loginStudent() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: `${TEST_PREFIX}student@example.com`, password: '123456' });

  expect([200, 201]).toContain(res.statusCode);
  expect(res.body).toHaveProperty('success', true);

  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Student enrollments', () => {
  it('GET /api/student/enrollments should include seeded enrollment', async () => {
    const seeded = await seedCore();
    const token = await loginStudent();

    const res = await request(app)
      .get('/api/student/enrollments')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    const enrollments = res.body?.data?.enrollments;
    expect(Array.isArray(enrollments)).toBe(true);

    const found = enrollments.find((e) => Number(e.id) === Number(seeded.enrollment.id));
    expect(found).toBeTruthy();
  });

  it('GET /api/student/enrollments/course/:courseId should return enrollment detail', async () => {
    const seeded = await seedCore();
    const token = await loginStudent();

    const res = await request(app)
      .get(`/api/student/enrollments/course/${seeded.course.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.enrollment).toBeTruthy();
  });

  it('PUT /api/student/progress/:courseId should update progress', async () => {
    const seeded = await seedCore();
    const token = await loginStudent();

    const res = await request(app)
      .put(`/api/student/progress/${seeded.course.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ progressPercent: 42 });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
