const request = require('supertest');
const app = require('../app');
const path = require('path');
const { TEST_PREFIX } = require('./jest.teardown');

async function loginTeacher() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: `${TEST_PREFIX}teacher@example.com`, password: '123456' });

  expect([200, 201]).toContain(res.statusCode);
  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Uploads - quiz media', () => {
  it('POST /api/teacher/media/quiz should upload quiz media (requires Cloudinary)', async () => {
    const token = await loginTeacher();

    const fixturePath = path.join(__dirname, 'fixtures', 'avatar.png');

    const res = await request(app)
      .post('/api/teacher/media/quiz')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fixturePath);

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      expect(res.statusCode).toBe(500);
      expect(String(res.body?.error || '')).toMatch(/Cloudinary/);
      return;
    }

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.url).toBeTruthy();
    expect(res.body?.data?.publicId).toBeTruthy();
  }, 30000);
});
