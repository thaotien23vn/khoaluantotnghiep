const request = require('supertest');
const app = require('../app');
const path = require('path');
const { loginByRole } = require('./testAuth');

async function loginTeacher() {
  return await loginByRole('teacher');
}

describe('Uploads - quiz media', () => {
  it('POST /api/teacher/media/quiz should upload quiz media (requires Supabase)', async () => {
    const token = await loginTeacher();

    const fixturePath = path.join(__dirname, 'fixtures', 'avatar.png');

    const res = await request(app)
      .post('/api/teacher/media/quiz')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fixturePath);

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      expect(res.statusCode).toBe(500);
      expect(String(res.body?.error || '')).toMatch(/Supabase/);
      return;
    }

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.url).toBeTruthy();
    expect(res.body?.data?.publicId).toBeTruthy();
  }, 30000);
});
