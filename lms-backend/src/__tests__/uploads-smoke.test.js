const request = require('supertest');
const app = require('../app');
const path = require('path');

async function loginAdmin() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.TEST_ADMIN_EMAIL || 'adminThai@gmail.com', password: process.env.TEST_ADMIN_PASSWORD || '123456' });

  expect([200, 201]).toContain(res.statusCode);
  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Uploads (smoke tests)', () => {
  it('POST /api/auth/me/avatar should upload avatar (requires Cloudinary)', async () => {
    const token = await loginAdmin();

    const fixturePath = path.join(__dirname, 'fixtures', 'avatar.png');

    const res = await request(app)
      .post('/api/auth/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fixturePath);

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      expect(res.statusCode).toBe(500);
      expect(String(res.body?.error || '')).toMatch(/Cloudinary/);
      return;
    }

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.user?.avatar).toBeTruthy();
  });
});
