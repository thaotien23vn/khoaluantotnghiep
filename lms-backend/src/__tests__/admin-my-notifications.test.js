const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole, TEST_ACCOUNTS } = require('./testAuth');

describe('Admin my-notifications', () => {
  let adminToken;
  let adminId;
  let createdNotificationIds = [];

  beforeAll(async () => {
    adminToken = await loginByRole('admin');
    const admin = await db.models.User.findOne({
      where: { email: TEST_ACCOUNTS.admin.email },
      attributes: ['id'],
    });
    expect(admin).toBeTruthy();
    adminId = admin.id;
  });

  afterAll(async () => {
    if (createdNotificationIds.length > 0) {
      await db.models.Notification.destroy({ where: { id: createdNotificationIds } });
    }
  });

  it('returns current admin notifications list', async () => {
    const listRes = await request(app)
      .get('/api/admin/my-notifications?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body?.data?.notifications)).toBe(true);
  });

  it('supports delete-all for current admin notifications', async () => {
    const uniqueTitle = `it_admin_notification_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const created = await db.models.Notification.create({
      userId: adminId,
      type: 'announcement',
      title: uniqueTitle,
      message: 'seed',
      payload: { test: true },
      read: false,
    });
    createdNotificationIds.push(created.id);

    const beforeDelete = await request(app)
      .get('/api/admin/my-notifications?page=1&limit=50')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(beforeDelete.status).toBe(200);
    expect(beforeDelete.body.success).toBe(true);
    expect(
      (beforeDelete.body?.data?.notifications || []).some((item) => String(item.title) === uniqueTitle)
    ).toBe(true);

    const deleteAllRes = await request(app)
      .delete('/api/admin/my-notifications/delete-all')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteAllRes.status).toBe(200);
    expect(deleteAllRes.body.success).toBe(true);

    const afterDelete = await request(app)
      .get('/api/admin/my-notifications?page=1&limit=50')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(afterDelete.status).toBe(200);
    expect(afterDelete.body.success).toBe(true);
    expect(
      (afterDelete.body?.data?.notifications || []).some((item) => String(item.title) === uniqueTitle)
    ).toBe(false);
    createdNotificationIds = createdNotificationIds.filter((id) => id !== created.id);
  });
});
