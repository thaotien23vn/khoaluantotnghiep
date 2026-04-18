const request = require('supertest');
const bcrypt = require('bcryptjs');
const db = require('../../models');
const { loginByRole } = require('../testAuth');

jest.mock('../../services/email.service', () => ({
  sendVerificationEmail: jest.fn(async () => ({ success: true })),
  sendResetPasswordEmail: jest.fn(async () => ({ success: true })),
}));

const emailService = require('../../services/email.service');
const app = require('../../app');

describe('P3 auth/chat security hardening', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    await db.sequelize.sync();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  test('register does not leak verificationCode in production-like env', async () => {
    process.env.NODE_ENV = 'production';
    const email = `p3_prod_${Date.now()}@example.com`;
    const username = `p3prod_${Date.now()}`;

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'P3 Prod User',
        username,
        email,
        password: 'Password123',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.user?.email).toBe(email);
    expect(res.body?.data?.verificationCode).toBeUndefined();
  });

  test('register can expose verificationCode only in test env', async () => {
    process.env.NODE_ENV = 'test';
    const email = `p3_test_${Date.now()}@example.com`;
    const username = `p3test_${Date.now()}`;

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'P3 Test User',
        username,
        email,
        password: 'Password123',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(typeof res.body?.data?.verificationCode).toBe('string');
    expect(res.body?.data?.verificationCode.length).toBe(6);
  });

  test('forgot-password response is uniform (non-enumerable)', async () => {
    // Ensure one existing user
    const existingEmail = `p3_existing_${Date.now()}@example.com`;
    const { User } = db.models;
    await User.create({
      name: 'P3 Existing',
      email: existingEmail,
      username: `p3_exist_${Date.now()}`,
      passwordHash: await bcrypt.hash('Password123', 10),
      role: 'student',
      isEmailVerified: true,
      isActive: true,
    });

    const nonExistingEmail = `p3_nonexisting_${Date.now()}@example.com`;

    const resExisting = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: existingEmail });
    const resMissing = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: nonExistingEmail });

    expect(resExisting.statusCode).toBe(200);
    expect(resMissing.statusCode).toBe(200);
    expect(resExisting.body?.success).toBe(true);
    expect(resMissing.body?.success).toBe(true);
    expect(resExisting.body?.message).toBe(resMissing.body?.message);
  });

  test('reset token flow uses deterministic hash and no token leakage in check endpoint', async () => {
    const email = `p3_reset_${Date.now()}@example.com`;
    const oldPassword = 'Password123';
    const newPassword = 'NewPassword123';
    const { User } = db.models;
    await User.create({
      name: 'P3 Reset User',
      email,
      username: `p3_reset_${Date.now()}`,
      passwordHash: await bcrypt.hash(oldPassword, 10),
      role: 'student',
      isEmailVerified: true,
      isActive: true,
    });

    let capturedResetToken = null;
    emailService.sendResetPasswordEmail.mockImplementation(async (_email, _name, token) => {
      capturedResetToken = token;
      return { success: true };
    });

    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email });
    expect(forgotRes.statusCode).toBe(200);
    expect(forgotRes.body?.success).toBe(true);
    expect(typeof capturedResetToken).toBe('string');

    const userAfterForgot = await User.findOne({ where: { email } });
    expect(typeof userAfterForgot.resetPasswordToken).toBe('string');
    expect(userAfterForgot.resetPasswordToken.startsWith('v2:')).toBe(true);

    const checkRes = await request(app).get(`/api/auth/reset-password/${capturedResetToken}`);
    expect(checkRes.statusCode).toBe(200);
    expect(checkRes.body?.success).toBe(true);
    expect(checkRes.body?.data?.valid).toBe(true);
    expect(checkRes.body?.data?.expiresAt).toBeTruthy();
    expect(checkRes.body?.data?.token).toBeUndefined();

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: capturedResetToken,
        password: newPassword,
        confirmPassword: newPassword,
      });
    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.body?.success).toBe(true);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: newPassword });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body?.success).toBe(true);
    expect(typeof loginRes.body?.data?.token).toBe('string');
  });

  test('chat route defense-in-depth: admin endpoints reject non-admin, allow admin', async () => {
    const adminToken = await loginByRole('admin');
    const teacherToken = await loginByRole('teacher');
    const studentToken = await loginByRole('student');

    const adminMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
    const teacherMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${teacherToken}`);
    expect(adminMe.statusCode).toBe(200);
    expect(teacherMe.statusCode).toBe(200);
    const teacherId = Number(teacherMe.body?.data?.id);
    expect(teacherId).toBeTruthy();

    const { Course, Chapter, Lecture, LessonChat } = db.models;
    const course = await Course.create({
      title: `P3 Chat ${Date.now()}`,
      slug: `p3-chat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      description: 'desc',
      price: 0,
      published: true,
      status: 'published',
      createdBy: teacherId,
    });
    const chapter = await Chapter.create({ title: 'P3 Chapter', courseId: course.id, order: 0 });
    const lecture = await Lecture.create({ title: 'P3 Lecture', type: 'text', content: 'hello', duration: 60, chapterId: chapter.id });
    const chat = await LessonChat.create({
      lessonId: lecture.id,
      courseId: course.id,
      title: 'Lesson Discussion',
      isActive: true,
      aiEnabled: true,
    });

    const studentRes = await request(app)
      .post(`/api/admin/chat/${chat.id}/toggle`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});
    expect(studentRes.statusCode).toBe(403);

    const teacherRes = await request(app)
      .post(`/api/admin/chat/${chat.id}/toggle`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({});
    expect(teacherRes.statusCode).toBe(403);

    const adminRes = await request(app)
      .post(`/api/admin/chat/${chat.id}/toggle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect([200, 201]).toContain(adminRes.statusCode);
    expect(adminRes.body?.success).toBe(true);
  });
});

