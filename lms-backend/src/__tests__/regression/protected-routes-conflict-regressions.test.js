const request = require('supertest');
const app = require('../../app');
const { loginByRole } = require('../testAuth');

describe('Protected routes conflict regressions (admin/teacher/student routers)', () => {
  let adminToken;
  let studentToken;

  beforeAll(async () => {
    adminToken = await loginByRole('admin');
    studentToken = await loginByRole('student');
  });

  it('GET /api/student/dashboard with student token returns 200', async () => {
    const res = await request(app)
      .get('/api/student/dashboard')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  it('GET /api/student/dashboard with admin token is forbidden', async () => {
    const res = await request(app)
      .get('/api/student/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty('success', false);
  });

  it('GET /api/admin/dashboard works with admin token and blocks student', async () => {
    const ok = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toHaveProperty('success', true);

    const no = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(no.statusCode).toBe(403);
    expect(no.body).toHaveProperty('success', false);
  });
});

