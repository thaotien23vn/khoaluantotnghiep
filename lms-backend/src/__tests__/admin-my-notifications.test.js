const request = require('supertest');
const app = require('../app');
const { seedCore, TEST_PREFIX } = require('./jest.teardown');
const bcrypt = require('bcryptjs');

async function loginAdmin() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({
      email: process.env.TEST_ADMIN_EMAIL || 'adminThai@gmail.com',
      password: process.env.TEST_ADMIN_PASSWORD || '123456',
    });

  expect([200, 201]).toContain(res.statusCode);
  const token =
    res.body?.token ||
    res.body?.accessToken ||
    res.body?.data?.token ||
    res.body?.data?.accessToken;
  expect(typeof token).toBe('string');
  return token;
}

describe('Admin my-notifications', () => {
  it('GET /api/admin/my-notifications should work for admin and support delete-all', async () => {
    // Ensure DB is seeded (creates teacher + student + course etc.)
    await seedCore();

    // Ensure admin user exists in DB with same email used for login
    const db = require('../models');
    const { User, Notification } = db.models;
    const email = (process.env.TEST_ADMIN_EMAIL || 'adminThai@gmail.com').toLowerCase();
    const password = process.env.TEST_ADMIN_PASSWORD || '123456';

    let admin = await User.findOne({ where: { email } });
    
    if (admin) {
      // Update password to ensure it matches for testing
      const passwordHash = await bcrypt.hash(password, 10);
      await admin.update({ 
        passwordHash,
        isEmailVerified: true,
        isActive: true 
      });
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      try {
        admin = await User.create({
          name: 'IT Seed Admin',
          username: `${TEST_PREFIX}admin`,
          email,
          passwordHash,
          role: 'admin',
          isEmailVerified: true,
          isActive: true,
        });
      } catch (err) {
        throw err;
      }
    }

    const token = await loginAdmin();

    await Notification.create({
      userId: admin.id,
      type: 'announcement',
      title: `${TEST_PREFIX}admin_notification`,
      message: 'seed',
      payload: { test: true },
      read: false,
    });

    const listRes = await request(app)
      .get('/api/admin/my-notifications?page=1&limit=50')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body).toHaveProperty('success', true);
    expect(Array.isArray(listRes.body?.data?.notifications)).toBe(true);

    const found = listRes.body.data.notifications.find(
      (n) => String(n.title) === `${TEST_PREFIX}admin_notification`,
    );
    expect(found).toBeTruthy();

    const delAllRes = await request(app)
      .delete('/api/admin/my-notifications/delete-all')
      .set('Authorization', `Bearer ${token}`);

    expect(delAllRes.statusCode).toBe(200);
    expect(delAllRes.body).toHaveProperty('success', true);

    const listRes2 = await request(app)
      .get('/api/admin/my-notifications?page=1&limit=50')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes2.statusCode).toBe(200);
    const stillThere = (listRes2.body?.data?.notifications || []).find(
      (n) => String(n.title) === `${TEST_PREFIX}admin_notification`,
    );
    expect(stillThere).toBeFalsy();
  });
});
