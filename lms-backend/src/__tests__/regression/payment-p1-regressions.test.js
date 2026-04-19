// Important: avoid jest.resetModules() in this suite because the codebase
// assumes a singleton Sequelize instance; resetting modules can create a new
// db without tables (SQLITE_ERROR: no such table).
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';

jest.mock('stripe', () => {
  // StripeService does: require('stripe')(key) -> returns a client object.
  return () => ({
    webhooks: {
      constructEvent: () => global.__stripeConstructedEvent,
    },
  });
});

const request = require('supertest');
const db = require('../../models');
const { loginByRole } = require('../testAuth');
const vnpayService = require('../../services/vnpay.service');
const paymentService = require('../../modules/payment/payment.service');
const stripeService = require('../../services/stripe.service');

describe('Payment P1 regressions', () => {
  let adminToken;
  let teacherToken;
  let studentToken;

  const createdCourseIds = [];
  const createdPaymentIds = [];
  const createdChapterIds = [];
  const createdLectureIds = [];

  beforeAll(async () => {
    adminToken = await loginByRole('admin');
    teacherToken = await loginByRole('teacher');
    studentToken = await loginByRole('student');
  });

  afterAll(async () => {
    const { Enrollment, LectureProgress, Lecture, Chapter, Payment, Course } = db.models;
    await LectureProgress.destroy({ where: { courseId: createdCourseIds } });
    await Enrollment.destroy({ where: { courseId: createdCourseIds } });
    await Payment.destroy({ where: { id: createdPaymentIds } });
    await Lecture.destroy({ where: { id: createdLectureIds } });
    await Chapter.destroy({ where: { id: createdChapterIds } });
    await Course.destroy({ where: { id: createdCourseIds } });
  });

  async function createPublishedPaidCourse(price = 10) {
    const app = require('../../app');
    const uniq = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const courseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: `Pay Course ${uniq}`, description: 'seed', price });
    expect(courseRes.statusCode).toBe(201);
    const courseId = Number(courseRes.body.data.course.id);
    createdCourseIds.push(courseId);

    const publishRes = await request(app)
      .put(`/api/teacher/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });
    expect(publishRes.statusCode).toBe(200);

    return courseId;
  }

  it('blocks price tampering by ignoring client amount and using Course.price', async () => {
    const app = require('../../app');
    const courseId = await createPublishedPaidCourse(25);

    const res = await request(app)
      .post('/api/student/payments/create')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId, provider: 'mock', amount: 1 });

    expect([200, 201]).toContain(res.statusCode);
    expect(res.body.success).toBe(true);
    const payment = res.body.data.payment;
    createdPaymentIds.push(payment.id);
    expect(Number(payment.amount)).toBe(25);
  });

  it('VNPay return replay is safe (already completed returns success early)', async () => {
    const spy = jest.spyOn(vnpayService, 'processReturnUrl').mockResolvedValue({
      success: true,
      txnRef: 'vnp_txn_test_1',
      bankCode: 'VCB',
      transactionNo: '1',
      responseCode: '00',
      message: 'OK',
    });

    const courseId = await createPublishedPaidCourse(10);
    const { User, Payment } = db.models;
    const student = await User.findOne({ where: { role: 'student' }, attributes: ['id'] });
    expect(student).toBeTruthy();

    const payment = await Payment.create({
      userId: student.id,
      courseId,
      amount: 10,
      currency: 'VND',
      provider: 'vnpay',
      providerTxn: 'vnp_txn_test_1',
      status: 'pending',
      paymentDetails: {},
    });
    createdPaymentIds.push(payment.id);

    const first = await paymentService.processVNPayReturn({ any: 'query' });
    expect(first.success).toBe(true);
    expect(first.payment.status).toBe('completed');

    const second = await paymentService.processVNPayReturn({ any: 'query' });
    expect(second.success).toBe(true);
    expect(second.alreadyProcessed).toBe(true);

    const enrollmentCount = await db.models.Enrollment.count({
      where: { userId: student.id, courseId },
    });
    expect(enrollmentCount).toBe(1);

    spy.mockRestore();
  });

  it('Stripe webhook replay is idempotent and does not throw on completed payment', async () => {
    const courseId = await createPublishedPaidCourse(15);
    const { User, Payment, Enrollment } = db.models;
    const student = await User.findOne({ where: { role: 'student' }, attributes: ['id'] });
    expect(student).toBeTruthy();

    // Mock Stripe payment_intent.succeeded event with proper structure
    global.__stripeConstructedEvent = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_1',
          status: 'succeeded',  // Required for _handlePaymentSuccess validation
          metadata: { userId: String(student.id), courseId: String(courseId) },
          charges: { data: [{ receipt_url: 'https://stripe.test/receipt' }] },
        },
      },
    };

    const pay = await Payment.create({
      userId: student.id,
      courseId,
      amount: 15,
      currency: 'USD',
      provider: 'stripe',
      providerTxn: 'pi_test_1',
      status: 'pending',
      paymentDetails: {},
    });
    createdPaymentIds.push(pay.id);

    const payload = Buffer.from('test');
    await expect(stripeService.handleWebhook(payload, 'sig')).resolves.toBeTruthy();
    await expect(stripeService.handleWebhook(payload, 'sig')).resolves.toBeTruthy();

    const updated = await Payment.findByPk(pay.id);
    expect(updated.status).toBe('completed');

    const enrollCount = await Enrollment.count({ where: { userId: student.id, courseId } });
    expect(enrollCount).toBe(1);
  });

  it('Stripe checkout completion is idempotent (unique-safe enrollment)', async () => {
    const courseId = await createPublishedPaidCourse(12);
    const { User, Payment, Enrollment } = db.models;
    const student = await User.findOne({ where: { role: 'student' }, attributes: ['id'] });
    expect(student).toBeTruthy();

    const session = {
      id: 'cs_test_1',
      payment_status: 'paid',
      amount_total: 1200,
      metadata: { userId: String(student.id), courseId: String(courseId) },
      receipt_url: 'https://stripe.test/receipt',
    };

    const payment = await Payment.create({
      userId: student.id,
      courseId,
      amount: 12,
      currency: 'USD',
      provider: 'stripe',
      providerTxn: session.id,
      status: 'pending',
      paymentDetails: { type: 'checkout_session', sessionId: session.id },
    });
    createdPaymentIds.push(payment.id);

    // Sequential calls (SQLite doesn't support concurrent row-level locks like MySQL/Postgres)
    // Still tests idempotency: 2nd call should not throw or create duplicate enrollment
    const first = await stripeService.handleCheckoutCompleted(session);
    expect(first.success).toBe(true);

    const second = await stripeService.handleCheckoutCompleted(session);
    expect(second.success).toBe(true);

    const updated = await Payment.findByPk(payment.id);
    expect(updated.status).toBe('completed');

    const enrollCount = await Enrollment.count({ where: { userId: student.id, courseId } });
    expect(enrollCount).toBe(1);
  });
});

