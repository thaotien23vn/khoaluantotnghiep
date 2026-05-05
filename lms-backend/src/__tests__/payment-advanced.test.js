const request = require('supertest');
const app = require('../app');
const { loginByRole } = require('./testAuth');
const db = require('../models');
const { Payment, Course } = db.models;

describe('Advanced Payment Flow Tests', () => {
  let studentToken;
  let studentUserId;
  let testCourse;

  beforeAll(async () => {
    studentToken = await loginByRole('student');
    
    const { User } = db.models;
    const student = await User.findOne({ where: { email: 'student@gmail.com' } });
    studentUserId = student?.id;
    
    const teacher = await User.findOne({ where: { email: 'teacher@gmail.com' } });
    const timestamp = Date.now();
    
    // Ensure category exists
    const { Category } = db.models;
    let category = await Category.findByPk(1);
    if (!category) {
      category = await Category.create({ id: 1, name: 'Test Category', slug: 'test-category' });
    }

    testCourse = await Course.create({
      title: 'Advanced Payment Course',
      slug: `advanced-payment-course-${timestamp}`,
      price: 500000,
      teacherId: teacher.id,
      published: true,
      categoryId: 1
    });
  });

  afterAll(async () => {
    if (studentUserId) await Payment.destroy({ where: { userId: studentUserId }, force: true });
    if (testCourse) await testCourse.destroy({ force: true });
  });

  test('POST /api/student/payments/create - Create payment for course', async () => {
    const res = await request(app)
      .post('/api/student/payments/create')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: testCourse.id });

    // Should return 201 with payment data or redirect URL
    expect([200, 201]).toContain(res.statusCode);
  });

  test('POST /api/student/payments/stripe/webhook - Handle Stripe Webhook (Mock)', async () => {
    const res = await request(app)
      .post('/api/student/payments/stripe/webhook')
      .send({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'test_session_id',
            payment_status: 'paid',
            metadata: {
              userId: String(studentUserId),
              courseId: String(testCourse.id)
            }
          }
        }
      })
      .set('stripe-signature', 'mock_signature');

    // Webhook returns 200 to avoid Stripe retrying, or 400 if validation fails
    expect([200, 400]).toContain(res.statusCode);
  });

  test('GET /api/student/payments/history - Get student payment history', async () => {
    const res = await request(app)
      .get('/api/student/payments/history')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Object);
  });
});
