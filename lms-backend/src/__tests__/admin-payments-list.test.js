const request = require('supertest');
const app = require('../app');
const { loginByRole } = require('./testAuth');

describe('Admin payments', () => {
  it('GET /api/admin/payments should return payments list', async () => {
    const token = await loginByRole('admin');

    const res = await request(app)
      .get('/api/admin/payments?page=1&limit=20')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    const payments = res.body?.data?.payments;
    expect(Array.isArray(payments)).toBe(true);
  });
});
