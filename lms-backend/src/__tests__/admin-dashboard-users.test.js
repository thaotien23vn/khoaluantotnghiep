const request = require('supertest');
const app = require('../app');
const { loginByRole } = require('./testAuth');

describe('Admin core endpoints', () => {
  it('GET /api/admin/dashboard should return stats', async () => {
    const token = await loginByRole('admin');

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.stats).toBeTruthy();
  });

  it('GET /api/admin/users should return list', async () => {
    const token = await loginByRole('admin');

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    const users = res.body?.data?.users;
    expect(Array.isArray(users)).toBe(true);
  });
});
