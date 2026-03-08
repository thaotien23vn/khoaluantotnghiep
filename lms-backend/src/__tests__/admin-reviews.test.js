const request = require('supertest');
const app = require('../app');
const { seedCore } = require('./jest.teardown');

async function loginAndGetToken() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({
      email: process.env.TEST_ADMIN_EMAIL || 'adminThai@gmail.com',
      password: process.env.TEST_ADMIN_PASSWORD || '123456',
    });

  if (!(res.statusCode === 200 || res.statusCode === 201) || res.body?.success !== true) {
    throw new Error(`Login failed: ${res.statusCode} ${JSON.stringify(res.body)}`);
  }

  const token = res.body?.token || res.body?.accessToken || res.body?.data?.token || res.body?.data?.accessToken;
  if (!token) {
    throw new Error(`Login did not return token. Body: ${JSON.stringify(res.body)}`);
  }

  return token;
}

describe('GET /api/admin/reviews', () => {
  it('should return reviews including user.name and course.title', async () => {
    const seeded = await seedCore();
    const token = await loginAndGetToken();

    const res = await request(app)
      .get('/api/admin/reviews?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    const reviews = res.body?.data?.reviews;
    expect(Array.isArray(reviews)).toBe(true);

    const seededReview = reviews.find((r) => Number(r.id) === Number(seeded.review.id));
    expect(seededReview).toBeTruthy();
    expect(seededReview).toHaveProperty('user');
    expect(seededReview.user).toHaveProperty('name', seeded.student.name);
    expect(seededReview).toHaveProperty('course');
    expect(seededReview.course).toHaveProperty('title', seeded.course.title);
  });
});
