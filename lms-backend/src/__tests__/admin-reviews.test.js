const request = require('supertest');
const app = require('../app');
const { seedCore } = require('./jest.teardown');
const { loginByRole } = require('./testAuth');

async function loginAndGetToken() {
  return await loginByRole('admin');
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
