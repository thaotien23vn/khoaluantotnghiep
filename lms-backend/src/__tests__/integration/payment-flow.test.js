const request = require('supertest');
const app = require('../../app');
const db = require('../../models');
const { loginByRole } = require('../testAuth');

describe('Payment Flow Integration Test', () => {
  let studentToken;
  let adminToken;
  let testCourse;

  beforeAll(async () => {
    studentToken = await loginByRole('student');
    adminToken = await loginByRole('admin');
    const teacherToken = await loginByRole('teacher');

    // 1. Teacher creates a course
    const courseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Integration Test Course',
        description: 'Testing payment flow',
        price: 50000
      });
    testCourse = courseRes.body.data.course;

    // 2. Publish the course
    await request(app)
      .put(`/api/teacher/courses/${testCourse.id}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ published: true });
  });

  it('should complete a full payment flow: create -> process -> enroll', async () => {
    // 1. Student initiates payment via the process endpoint (creates payment + processes in one step)
    const processRes = await request(app)
      .post('/api/student/payments/process')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        courseId: testCourse.id,
        paymentMethod: 'mock',
        paymentDetails: { amount: 50000 }
      });

    // Check for 201 (Created) or 200 (Success)
    expect([200, 201]).toContain(processRes.statusCode);
    expect(processRes.body.success).toBe(true);

    // 2. Verify student is now enrolled
    const enrollmentsRes = await request(app)
      .get('/api/student/enrollments')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(enrollmentsRes.statusCode).toBe(200);
    
    const enrolled = enrollmentsRes.body.data.enrollments.find(e => 
      Number(e.courseId) === Number(testCourse.id) || Number(e.Course?.id) === Number(testCourse.id)
    );
    expect(enrolled).toBeDefined();
    expect(enrolled.status).toBe('enrolled');
  });

  it('should handle duplicate payment attempts gracefully', async () => {
    // Create another course
    const teacherToken = await loginByRole('teacher');
    const courseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Duplicate Payment Test Course',
        description: 'Testing duplicate payments',
        price: 30000
      });
    const courseId = courseRes.body.data.course.id;

    // Publish the course
    await request(app)
      .put(`/api/teacher/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ published: true });

    // First payment - should succeed
    const firstRes = await request(app)
      .post('/api/student/payments/process')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId, paymentMethod: 'mock', paymentDetails: { amount: 30000 } });

    expect([200, 201]).toContain(firstRes.statusCode);
    expect(firstRes.body.success).toBe(true);

    // Second payment attempt - may succeed or fail depending on implementation
    // The system may allow multiple payments or reject duplicates
    const secondRes = await request(app)
      .post('/api/student/payments/process')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId, paymentMethod: 'mock', paymentDetails: { amount: 30000 } });

    // Either response is acceptable - 200/201 (if allowed) or 400/409 (if rejected)
    expect([200, 201, 400, 409]).toContain(secondRes.statusCode);

    // Verify enrollment exists (should be created from first payment)
    const enrollmentsRes = await request(app)
      .get('/api/student/enrollments')
      .set('Authorization', `Bearer ${studentToken}`);
    
    const enrolled = enrollmentsRes.body.data.enrollments.find(e => 
      Number(e.courseId) === Number(courseId) || Number(e.Course?.id) === Number(courseId)
    );
    expect(enrolled).toBeDefined();
    expect(enrolled.status).toBe('enrolled');
  });
});
