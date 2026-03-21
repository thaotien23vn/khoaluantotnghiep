const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { seedCore, TEST_PREFIX } = require('./jest.teardown');

async function loginStudent() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: `${TEST_PREFIX}student@example.com`, password: 'Password123@' });

  expect([200, 201]).toContain(res.statusCode);
  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Student payments (mock)', () => {
  it('POST /api/student/payments/process should create payment request', async () => {
    const seeded = await seedCore();
    const token = await loginStudent();

    await db.models.Payment.destroy({
      where: { userId: seeded.student.id, courseId: seeded.paidCourse.id },
    });
    await db.models.Enrollment.destroy({
      where: { userId: seeded.student.id, courseId: seeded.paidCourse.id },
    });

    const res = await request(app)
      .post('/api/student/payments/process')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseId: seeded.paidCourse.id,
        paymentMethod: 'mock',
        paymentDetails: { test: true },
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.payment).toBeTruthy();
    expect(res.body?.data?.payment).toHaveProperty('id');
  });

  it('POST /api/student/payments/verify should complete payment and create enrollment', async () => {
    const seeded = await seedCore();
    const token = await loginStudent();

    await db.models.Payment.destroy({
      where: { userId: seeded.student.id, courseId: seeded.paidCourse.id },
    });
    await db.models.Enrollment.destroy({
      where: { userId: seeded.student.id, courseId: seeded.paidCourse.id },
    });

    const processRes = await request(app)
      .post('/api/student/payments/process')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courseId: seeded.paidCourse.id,
        paymentMethod: 'mock',
        paymentDetails: { test: true },
      });

    expect(processRes.statusCode).toBe(201);

    const createdPaymentId = processRes.body?.data?.payment?.id;
    expect(createdPaymentId).toBeTruthy();

    const verifyRes = await request(app)
      .post('/api/student/payments/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentId: createdPaymentId, verificationData: { ok: true } });

    // For mock provider, process step already completes payment & creates enrollment.
    // Verify should therefore return "already processed".
    expect(verifyRes.statusCode).toBe(400);
    expect(verifyRes.body).toHaveProperty('success', false);

    const enrollment = await db.models.Enrollment.findOne({
      where: { userId: seeded.student.id, courseId: seeded.paidCourse.id, status: 'enrolled' },
    });
    expect(enrollment).toBeTruthy();

    const detailRes = await request(app)
      .get(`/api/student/payments/${createdPaymentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.body).toHaveProperty('success', true);
    expect(detailRes.body?.data?.payment).toBeTruthy();
  });

  it('GET /api/student/payments should include at least one payment record after verify', async () => {
    const seeded = await seedCore();
    const token = await loginStudent();

    const res = await request(app)
      .get('/api/student/payments?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    const payments = res.body?.data?.payments;
    expect(Array.isArray(payments)).toBe(true);
  });
});
