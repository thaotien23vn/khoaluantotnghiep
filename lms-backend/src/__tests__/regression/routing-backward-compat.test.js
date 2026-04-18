const request = require('supertest');
const app = require('../../app');
const { loginByRole } = require('../testAuth');

describe('Routing backward compatibility regressions', () => {
  let adminToken;
  let teacherToken;
  let studentToken;
  const createdCourseIds = [];

  beforeAll(async () => {
    adminToken = await loginByRole('admin');
    teacherToken = await loginByRole('teacher');
    studentToken = await loginByRole('student');
  });

  afterAll(async () => {
    const db = require('../../models');
    const { Payment, Enrollment, Course } = db.models;
    await Payment.destroy({ where: { courseId: createdCourseIds } });
    await Enrollment.destroy({ where: { courseId: createdCourseIds } });
    await Course.destroy({ where: { id: createdCourseIds } });
  });

  async function createPublishedPaidCourse(price = 11) {
    const uniq = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const createRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: `Route BC ${uniq}`, description: 'seed', price });
    expect(createRes.statusCode).toBe(201);
    const courseId = Number(createRes.body.data.course.id);
    createdCourseIds.push(courseId);

    const publishRes = await request(app)
      .put(`/api/teacher/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });
    expect(publishRes.statusCode).toBe(200);

    return courseId;
  }

  it('keeps payment history canonical + alias URLs working', async () => {
    const canonical = await request(app)
      .get('/api/student/payments/history')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(canonical.statusCode).toBe(200);
    expect(canonical.body).toHaveProperty('success', true);

    const alias = await request(app)
      .get('/api/student/payments')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(alias.statusCode).toBe(200);
    expect(alias.body).toHaveProperty('success', true);
  });

  it('keeps create payment canonical + deprecated alias URLs working', async () => {
    const courseId = await createPublishedPaidCourse(13);

    const canonical = await request(app)
      .post('/api/student/payments/create')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId, provider: 'mock' });
    expect([200, 201]).toContain(canonical.statusCode);
    expect(canonical.body).toHaveProperty('success', true);

    const alias = await request(app)
      .post(`/api/student/courses/${courseId}/payment`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ provider: 'mock' });
    // alias can return conflict if enrollment/payment already exists; it must remain reachable and non-404
    expect([200, 201, 400, 409]).toContain(alias.statusCode);
    expect(alias.body).toHaveProperty('success');
  });

  it('keeps student schedule URL working after removing unreachable duplicate route', async () => {
    const res = await request(app)
      .get('/api/student/learning-schedule')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  it('keeps /api/admin/reviews reachable for admin and forbidden for student', async () => {
    const ok = await request(app)
      .get('/api/admin/reviews')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toHaveProperty('success', true);

    const no = await request(app)
      .get('/api/admin/reviews')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(no.statusCode).toBe(403);
    expect(no.body).toHaveProperty('success', false);
  });

  it('keeps analytics canonical endpoint and deprecated admin alias behavior', async () => {
    const canonical = await request(app)
      .get('/api/tracking/analytics')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(canonical.statusCode).toBe(200);
    expect(canonical.body).toHaveProperty('success', true);

    const alias = await request(app)
      .get('/api/admin/tracking/analytics')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(alias.statusCode).toBe(200);
    expect(alias.body).toHaveProperty('success', true);
    expect(alias.headers).toHaveProperty('deprecation', 'true');
  });
});

