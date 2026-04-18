const request = require('supertest');
const app = require('../../app');
const db = require('../../models');
const { loginByRole } = require('../testAuth');

describe('P2 auth hardening regressions', () => {
  beforeAll(async () => {
    await db.sequelize.sync();
  });

  test('disabled user cannot use old JWT token on auth-only routes', async () => {
    const token = await loginByRole('student');

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.statusCode).toBe(200);

    const userId = Number(me.body?.data?.id);
    expect(userId).toBeTruthy();

    const { User } = db.models;
    const user = await User.findByPk(userId);
    await user.update({ isActive: false });

    const res = await request(app)
      .get('/api/cart/count')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
    });

    // Reset to avoid side effects for other tests
    await user.update({ isActive: true });
  });

  test('downgraded admin loses admin privileges with old JWT token', async () => {
    const adminToken = await loginByRole('admin');
    const teacherToken = await loginByRole('teacher');

    const adminMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    const teacherMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(adminMe.statusCode).toBe(200);
    expect(teacherMe.statusCode).toBe(200);

    const adminId = Number(adminMe.body?.data?.id);
    const teacherId = Number(teacherMe.body?.data?.id);
    expect(adminId).toBeTruthy();
    expect(teacherId).toBeTruthy();

    // Create minimal lesson chat data so admin chat route can perform permission check
    const { Course, Chapter, Lecture, LessonChat, User } = db.models;
    const course = await Course.create({
      title: `P2 Course ${Date.now()}`,
      slug: `p2-course-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      description: 'desc',
      price: 0,
      published: true,
      status: 'published',
      createdBy: teacherId,
    });
    const chapter = await Chapter.create({
      title: 'P2 Chapter',
      courseId: course.id,
      order: 0,
    });
    const lecture = await Lecture.create({
      title: 'P2 Lecture',
      type: 'text',
      content: 'hello',
      duration: 60,
      chapterId: chapter.id,
    });
    const chat = await LessonChat.create({
      lessonId: lecture.id,
      courseId: course.id,
      title: 'Lesson Discussion',
      isActive: true,
      aiEnabled: true,
    });

    // Downgrade admin role after token issuance
    const adminUser = await User.findByPk(adminId);
    await adminUser.update({ role: 'student' });

    // Route uses authMiddleware only, permission is decided by req.user.role
    const res = await request(app)
      .post(`/api/admin/chat/${chat.id}/toggle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      success: false,
    });

    // Restore role for test stability
    await adminUser.update({ role: 'admin' });
  });
});

