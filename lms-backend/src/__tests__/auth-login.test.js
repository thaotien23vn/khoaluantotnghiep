const request = require('supertest');
const app = require('../app');

describe('POST /api/auth/login', () => {
  it('should login admin and return token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: process.env.TEST_ADMIN_EMAIL || 'adminThai@gmail.com', password: process.env.TEST_ADMIN_PASSWORD || '123456' });

    expect([200, 201]).toContain(res.statusCode);
    expect(res.body).toHaveProperty('success', true);

    // token field can vary by implementation
    const token = res.body?.token || res.body?.accessToken || res.body?.data?.token || res.body?.data?.accessToken;
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  });
});
