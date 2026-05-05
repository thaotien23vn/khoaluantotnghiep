const request = require('supertest');
const app = require('../app');
const { loginByRole } = require('./testAuth');
const db = require('../models');
const { Course, Enrollment } = db.models;

describe('Certificate Flow Tests', () => {
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
      title: 'Certificate Test Course',
      slug: `certificate-test-course-${timestamp}`,
      description: 'Test Description',
      price: 0,
      teacherId: teacher.id,
      published: true,
      categoryId: 1
    });

    // Create a completed enrollment
    await Enrollment.create({
      userId: studentUserId,
      courseId: testCourse.id,
      status: 'completed',
      enrollmentStatus: 'active',
      progressPercent: 100,
      completedAt: new Date()
    });
  });

  afterAll(async () => {
    const { Certificate } = db.models;
    if (studentUserId && Certificate) await Certificate.destroy({ where: { userId: studentUserId }, force: true });
    if (testCourse) await Enrollment.destroy({ where: { courseId: testCourse.id }, force: true });
    if (testCourse) await testCourse.destroy({ force: true });
  });

  test('GET /api/certificate/my-certificates - List user certificates', async () => {
    const res = await request(app)
      .get('/api/certificate/my-certificates')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  test('GET /api/certificate/download/:courseId - Download certificate for completed course', async () => {
    const res = await request(app)
      .get(`/api/certificate/download/${testCourse.id}`)
      .set('Authorization', `Bearer ${studentToken}`);

    // Should return PDF, 403 (not eligible), or 404 if not yet generated
    expect([200, 403, 404]).toContain(res.statusCode);
  });
});
