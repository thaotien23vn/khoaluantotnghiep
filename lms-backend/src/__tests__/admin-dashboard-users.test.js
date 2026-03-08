const request = require('supertest');
const app = require('../app');

async function loginAdmin() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.TEST_ADMIN_EMAIL || 'adminThai@gmail.com', password: process.env.TEST_ADMIN_PASSWORD || '123456' });

  expect([200, 201]).toContain(res.statusCode);
  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Admin core endpoints', () => {
  it('GET /api/admin/dashboard should return stats', async () => {
    const token = await loginAdmin();

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.stats).toBeTruthy();
  });

  it('GET /api/admin/users should return list', async () => {
    const token = await loginAdmin();

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    const users = res.body?.data?.users;
    expect(Array.isArray(users)).toBe(true);
  });
});
