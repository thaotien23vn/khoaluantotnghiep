const request = require('supertest');
const app = require('../../app');
const db = require('../../models');
const { loginByRole } = require('../testAuth');

describe('Admin Notifications API', () => {
  let adminToken;
  let studentToken;
  let testUserIds = [];
  let testNotificationIds = [];

  beforeAll(async () => {
    const { User, Notification } = db.models;

    // Create test users
    const adminUser = await User.create({
      name: 'Test Admin',
      username: `admin_test_${Date.now()}`,
      email: `admin_test_${Date.now()}@test.com`,
      passwordHash: 'fake_hash',
      role: 'admin',
      isEmailVerified: true,
      isActive: true,
    });
    testUserIds.push(adminUser.id);

    const studentUser = await User.create({
      name: 'Test Student',
      username: `student_test_${Date.now()}`,
      email: `student_test_${Date.now()}@test.com`,
      passwordHash: 'fake_hash',
      role: 'student',
      isEmailVerified: true,
      isActive: true,
    });
    testUserIds.push(studentUser.id);

    const teacherUser = await User.create({
      name: 'Test Teacher',
      username: `teacher_test_${Date.now()}`,
      email: `teacher_test_${Date.now()}@test.com`,
      passwordHash: 'fake_hash',
      role: 'teacher',
      isEmailVerified: true,
      isActive: true,
    });
    testUserIds.push(teacherUser.id);

    // Create test notifications for different users
    const notifications = await Notification.bulkCreate([
      {
        userId: studentUser.id,
        title: 'Student notification',
        message: 'Test message 1',
        type: 'system',
        read: false,
      },
      {
        userId: teacherUser.id,
        title: 'Teacher notification',
        message: 'Test message 2',
        type: 'course',
        read: true,
      },
      {
        userId: adminUser.id,
        title: 'Admin notification',
        message: 'Test message 3',
        type: 'system',
        read: false,
      },
    ]);
    testNotificationIds = notifications.map(n => n.id);

    // Use testAuth helpers to login
    adminToken = await loginByRole('admin');
    studentToken = await loginByRole('student');
  });

  afterAll(async () => {
    const { User, Notification } = db.models;
    
    // Clean up test notifications
    if (testNotificationIds.length > 0) {
      await Notification.destroy({ 
        where: { id: testNotificationIds },
        force: true 
      });
    }
    
    // Clean up test users
    if (testUserIds.length > 0) {
      await User.destroy({ 
        where: { id: testUserIds },
        force: true 
      });
    }
  });

  describe('GET /api/admin/notifications', () => {
    it('should return all notifications without user filter when admin', async () => {
      const res = await request(app)
        .get('/api/admin/notifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(3);
    });

    it('should filter notifications by type', async () => {
      const res = await request(app)
        .get('/api/admin/notifications?type=system')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.notifications.length).toBeGreaterThanOrEqual(2);
      res.body.data.notifications.forEach(n => {
        expect(n.type).toBe('system');
      });
    });

    it('should filter notifications by read status', async () => {
      const res = await request(app)
        .get('/api/admin/notifications?read=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.notifications.length).toBeGreaterThanOrEqual(1);
      res.body.data.notifications.forEach(n => {
        expect(n.read).toBe(true);
      });
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app).get('/api/admin/notifications');

      expect(res.status).toBe(401);
    });

    it('should return 403 when user is not admin', async () => {
      const res = await request(app)
        .get('/api/admin/notifications')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/admin/notifications/schedule', () => {
    it('should trigger scheduler when admin', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/schedule')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Đã kích hoạt scheduler');
      expect(res.body.data).toHaveProperty('reminders24h');
      expect(res.body.data).toHaveProperty('reminders1h');
    });

    it('should return 403 when user is not admin', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/schedule')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });
});
