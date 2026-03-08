const request = require('supertest');
const app = require('../app');
const { seedCore, TEST_PREFIX } = require('./jest.teardown');

async function loginTeacher() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: `${TEST_PREFIX}teacher@example.com`, password: '123456' });

  expect([200, 201]).toContain(res.statusCode);
  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Teacher course management', () => {
  it('GET /api/teacher/courses should include seeded course', async () => {
    const seeded = await seedCore();
    const token = await loginTeacher();

    const res = await request(app)
      .get('/api/teacher/courses?page=1&limit=50')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    const courses = res.body?.data?.courses;
    expect(Array.isArray(courses)).toBe(true);

    const found = courses.find((c) => String(c.title) === seeded.course.title);
    expect(found).toBeTruthy();
  });

  it('GET /api/teacher/courses/:id should return seeded course', async () => {
    const seeded = await seedCore();
    const token = await loginTeacher();

    const res = await request(app)
      .get(`/api/teacher/courses/${seeded.course.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(String(res.body?.data?.course?.id)).toBe(String(seeded.course.id));
  });

  it('PUT /api/teacher/courses/:id/publish should set published=false then true', async () => {
    const seeded = await seedCore();
    const token = await loginTeacher();

    const res1 = await request(app)
      .put(`/api/teacher/courses/${seeded.course.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ published: false });

    expect(res1.statusCode).toBe(200);
    expect(res1.body).toHaveProperty('success', true);

    const res2 = await request(app)
      .put(`/api/teacher/courses/${seeded.course.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ published: true });

    expect(res2.statusCode).toBe(200);
    expect(res2.body).toHaveProperty('success', true);
  });
});
