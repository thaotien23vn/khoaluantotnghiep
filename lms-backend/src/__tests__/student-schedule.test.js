const request = require('supertest');
const app = require('../app');
const { seedCore, TEST_PREFIX } = require('./jest.teardown');

async function loginStudent() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: `${TEST_PREFIX}student@example.com`, password: 'Password123@' });

  expect([200, 201]).toContain(res.statusCode);
  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Student schedule', () => {
  it('GET /api/student/learning-schedule should include seeded schedule event', async () => {
    const seeded = await seedCore();
    const token = await loginStudent();

    const res = await request(app)
      .get('/api/student/learning-schedule?limit=50')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    const schedule = res.body?.data?.schedule;
    expect(Array.isArray(schedule)).toBe(true);

    const found = schedule.find((e) => String(e.title) === `${TEST_PREFIX}event`);
    expect(found).toBeTruthy();
  });

  it('GET /api/student/learning-schedule/next should return next event or null', async () => {
    await seedCore();
    const token = await loginStudent();

    const res = await request(app)
      .get('/api/student/learning-schedule/next')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data).toHaveProperty('event');
  });
});
