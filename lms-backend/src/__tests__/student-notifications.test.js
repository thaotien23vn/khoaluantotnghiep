const request = require('supertest');
const app = require('../app');
const { seedCore, TEST_PREFIX } = require('./jest.teardown');

async function loginStudent() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: `${TEST_PREFIX}student@example.com`, password: '123456' });

  expect([200, 201]).toContain(res.statusCode);
  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Student notifications', () => {
  it('GET /api/student/notifications should include seeded notification', async () => {
    const seeded = await seedCore();
    const token = await loginStudent();

    const res = await request(app)
      .get('/api/student/notifications?page=1&limit=20')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    const notifications = res.body?.data?.notifications;
    expect(Array.isArray(notifications)).toBe(true);

    let found = notifications.find((n) => String(n.title) === `${TEST_PREFIX}notification`);
    if (!found) {
      const res2 = await request(app)
        .get('/api/student/notifications?page=1&limit=200')
        .set('Authorization', `Bearer ${token}`);

      expect(res2.statusCode).toBe(200);
      const notifications2 = res2.body?.data?.notifications;
      expect(Array.isArray(notifications2)).toBe(true);
      found = notifications2.find((n) => String(n.title) === `${TEST_PREFIX}notification`);
    }
    expect(found).toBeTruthy();
  });

  it('GET /api/student/notifications/unread-count should return number', async () => {
    await seedCore();
    const token = await loginStudent();

    const res = await request(app)
      .get('/api/student/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(typeof res.body?.data?.unreadCount).toBe('number');
  });
});
