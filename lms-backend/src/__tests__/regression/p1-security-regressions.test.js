const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../app');
const db = require('../../models');
const { loginByRole } = require('../testAuth');

// Mock stripe service to verify raw body is passed through
jest.mock('../../services/stripe.service', () => ({
  handleWebhook: jest.fn(async (payload, signature) => {
    return { event: { type: 'test.webhook', isBuffer: Buffer.isBuffer(payload), sig: signature } };
  }),
}));

const stripeService = require('../../services/stripe.service');

async function createUserAndLogin({ email, password, role = 'student' }) {
  const { User } = db.models;
  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    name: `Test ${role}`,
    email,
    username: `test_${role}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    passwordHash,
    role,
    isEmailVerified: true,
    isActive: true,
  });

  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (![200, 201].includes(res.statusCode) || !res.body?.success) {
    throw new Error(`Login failed status=${res.statusCode} body=${JSON.stringify(res.body)}`);
  }
  return res.body?.data?.token;
}

describe('P1 security regressions', () => {
  beforeAll(async () => {
    await db.sequelize.sync();
  });

  test('payment callback routes are publicly accessible (no auth)', async () => {
    // Stripe cancel is a simple public callback that returns JSON without touching DB.
    const resStripeCancel = await request(app).get('/api/student/payments/stripe/cancel');
    expect(resStripeCancel.statusCode).toBe(200);
    expect(resStripeCancel.body).toMatchObject({
      success: false,
    });

    // VNPay IPN is also public; on missing params it should still respond 200 with a VNPay-compatible body.
    const resVnpIpn = await request(app).get('/api/student/payments/vnpay/ipn');
    expect(resVnpIpn.statusCode).toBe(200);
    expect(resVnpIpn.body).toHaveProperty('RspCode');
    expect(resVnpIpn.body).toHaveProperty('Message');
  });

  test('stripe status enforces ownership (IDOR) -> 403', async () => {
    const tokenA = await loginByRole('student');
    const tokenB = await createUserAndLogin({
      email: `student_b_${Date.now()}@example.com`,
      password: 'Password123@',
      role: 'student',
    });

    // Identify user ids by calling /me
    const meA = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenA}`);
    const meB = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenB}`);
    expect(meA.statusCode).toBe(200);
    expect(meB.statusCode).toBe(200);
    const userIdA = Number(meA.body?.data?.id);
    const userIdB = Number(meB.body?.data?.id);
    expect(userIdA).toBeTruthy();
    expect(userIdB).toBeTruthy();
    expect(userIdA).not.toBe(userIdB);

    const { Payment, Course } = db.models;
    const providerTxn = `cs_test_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const course = await Course.create({
      title: `Payment Course ${Date.now()}`,
      slug: `payment-course-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      description: 'desc',
      price: 10,
      published: true,
      status: 'published',
      createdBy: userIdA,
    });

    await Payment.create({
      userId: userIdA,
      courseId: course.id,
      amount: 10,
      currency: 'USD',
      status: 'pending',
      provider: 'stripe',
      providerTxn,
      paymentDetails: { type: 'checkout_session' },
    });

    const res = await request(app)
      .get(`/api/student/payments/stripe/status?session_id=${encodeURIComponent(providerTxn)}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ success: false });
  });

  test('lesson chat unauthorized access -> 403', async () => {
    const teacherToken = await loginByRole('teacher');
    const studentToken = await loginByRole('student');

    // Create course/chapter/lecture directly to avoid unrelated category FK issues
    const meTeacher = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${teacherToken}`);
    expect(meTeacher.statusCode).toBe(200);
    const teacherId = Number(meTeacher.body?.data?.id);
    expect(teacherId).toBeTruthy();

    const { Course, Chapter, Lecture } = db.models;
    const course = await Course.create({
      title: `Course ${Date.now()}`,
      slug: `course-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      description: 'desc',
      price: 0,
      published: true,
      status: 'published',
      createdBy: teacherId,
    });
    const chapter = await Chapter.create({ title: 'Chapter 1', courseId: course.id, order: 0 });
    const lecture = await Lecture.create({ title: 'Lecture 1', type: 'text', content: 'hello', duration: 60, chapterId: chapter.id });
    const lectureId = Number(lecture.id);

    // Student is NOT enrolled -> should be 403
    const res = await request(app)
      .get(`/api/lessons/${lectureId}/chat`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ success: false });
  });

  test('lesson chat creation ignores poisoned courseId (uses authoritative courseId)', async () => {
    const teacherToken = await loginByRole('teacher');

    const meTeacher = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${teacherToken}`);
    expect(meTeacher.statusCode).toBe(200);
    const teacherId = Number(meTeacher.body?.data?.id);
    expect(teacherId).toBeTruthy();

    const { Course, Chapter, Lecture } = db.models;
    const courseA = await Course.create({
      title: `CourseA ${Date.now()}`,
      slug: `coursea-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      description: 'desc',
      price: 0,
      published: true,
      status: 'published',
      createdBy: teacherId,
    });
    const courseB = await Course.create({
      title: `CourseB ${Date.now()}`,
      slug: `courseb-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      description: 'desc',
      price: 0,
      published: true,
      status: 'published',
      createdBy: teacherId,
    });
    const courseAId = Number(courseA.id);
    const courseBId = Number(courseB.id);
    expect(courseBId).not.toBe(courseAId);

    const chapter = await Chapter.create({ title: 'Ch', courseId: courseAId, order: 0 });
    const lecture = await Lecture.create({ title: 'Lecture Poison', type: 'text', content: 'hello', duration: 60, chapterId: chapter.id });
    const lectureId = Number(lecture.id);

    // Try to poison by passing courseId=courseBId in query
    const chatRes = await request(app)
      .get(`/api/lessons/${lectureId}/chat?courseId=${encodeURIComponent(courseBId)}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(chatRes.statusCode).toBe(200);
    expect(chatRes.body?.success).toBe(true);
    expect(Number(chatRes.body?.data?.chat?.courseId)).toBe(courseAId);
  });

  test('stripe webhook receives raw body (Buffer) for signature verification', async () => {
    stripeService.handleWebhook.mockClear();

    const payload = { hello: 'world' };
    const res = await request(app)
      .post('/api/student/payments/stripe/webhook')
      .set('stripe-signature', 'test_sig')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.statusCode).toBe(200);
    expect(stripeService.handleWebhook).toHaveBeenCalledTimes(1);

    const [calledPayload, calledSig] = stripeService.handleWebhook.mock.calls[0];
    expect(calledSig).toBe('test_sig');
    expect(Buffer.isBuffer(calledPayload)).toBe(true);

    expect(res.body).toMatchObject({
      received: true,
    });
    // Controller returns "event" from the service
    expect(res.body.event).toHaveProperty('type', 'test.webhook');
    expect(res.body.event).toHaveProperty('isBuffer', true);
  });
});

