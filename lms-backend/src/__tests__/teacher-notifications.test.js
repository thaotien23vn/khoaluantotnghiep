const request = require('supertest');
const app = require('../app');
const { seedCore, TEST_PREFIX } = require('./jest.teardown');

async function loginTeacher() {
  await seedCore();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: `${TEST_PREFIX}teacher@example.com`, password: '123456' });

  expect([200, 201]).toContain(res.statusCode);
  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Teacher notifications', () => {
  it('GET /api/teacher/notifications should return list and support delete-all', async () => {
    const seeded = await seedCore();
    const token = await loginTeacher();

    // seed one notification for teacher
    const { Notification } = require('../models').models;
    await Notification.create({
      userId: seeded.teacher.id,
      type: 'announcement',
      title: `${TEST_PREFIX}teacher_notification`,
      message: 'seed',
      payload: { test: true },
      read: false,
    });

    const listRes = await request(app)
      .get('/api/teacher/notifications?page=1&limit=50')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body).toHaveProperty('success', true);
    expect(Array.isArray(listRes.body?.data?.notifications)).toBe(true);

    const found = listRes.body.data.notifications.find(
      (n) => String(n.title) === `${TEST_PREFIX}teacher_notification`,
    );
    expect(found).toBeTruthy();

    const unreadRes = await request(app)
      .get('/api/teacher/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);

    expect(unreadRes.statusCode).toBe(200);
    expect(unreadRes.body).toHaveProperty('success', true);
    expect(typeof unreadRes.body?.data?.unreadCount).toBe('number');

    // delete all
    const delAllRes = await request(app)
      .delete('/api/teacher/notifications/delete-all')
      .set('Authorization', `Bearer ${token}`);

    expect(delAllRes.statusCode).toBe(200);
    expect(delAllRes.body).toHaveProperty('success', true);

    const listRes2 = await request(app)
      .get('/api/teacher/notifications?page=1&limit=50')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes2.statusCode).toBe(200);
    const stillThere = (listRes2.body?.data?.notifications || []).find(
      (n) => String(n.title) === `${TEST_PREFIX}teacher_notification`,
    );
    expect(stillThere).toBeFalsy();
  });
});
