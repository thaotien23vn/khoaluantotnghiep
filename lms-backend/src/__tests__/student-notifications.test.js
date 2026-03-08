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
  it('GET /api/student/notifications should return a list (and include seeded notification)', async () => {
    const seeded = await seedCore();
    const token = await loginStudent();

    const listRes = await request(app)
      .get('/api/student/notifications?page=1&limit=50')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body).toHaveProperty('success', true);

    const notifications = listRes.body?.data?.notifications;
    expect(Array.isArray(notifications)).toBe(true);

    let found = notifications.find((n) => String(n.title) === `${TEST_PREFIX}notification`);
    if (!found) {
      const listRes2 = await request(app)
        .get('/api/student/notifications?page=1&limit=200')
        .set('Authorization', `Bearer ${token}`);

      expect(listRes2.statusCode).toBe(200);
      const notifications2 = listRes2.body?.data?.notifications;
      expect(Array.isArray(notifications2)).toBe(true);
      found = notifications2.find((n) => String(n.title) === `${TEST_PREFIX}notification`);
    }
    expect(found).toBeTruthy();
  });

  it('GET /api/student/notifications/unread-count should return number', async () => {
    await seedCore();
    const token = await loginStudent();

    const unreadRes = await request(app)
      .get('/api/student/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);

    expect(unreadRes.statusCode).toBe(200);
    expect(unreadRes.body).toHaveProperty('success', true);
    expect(typeof unreadRes.body?.data?.unreadCount).toBe('number');
  });
});
