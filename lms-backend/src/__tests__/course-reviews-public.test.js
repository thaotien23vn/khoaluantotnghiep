const request = require('supertest');
const app = require('../app');
const { seedCore } = require('./jest.teardown');

describe('Public course reviews', () => {
  it('GET /api/courses/:courseId/reviews should include seeded review with user+course', async () => {
    const seeded = await seedCore();

    const res = await request(app)
      .get(`/api/courses/${seeded.course.id}/reviews?page=1&limit=10`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    const reviews = res.body?.data?.reviews;
    expect(Array.isArray(reviews)).toBe(true);

    const found = reviews.find((r) => Number(r.id) === Number(seeded.review.id));
    expect(found).toBeTruthy();

    expect(found).toHaveProperty('user');
    expect(found.user).toHaveProperty('name', seeded.student.name);

    expect(found).toHaveProperty('course');
    expect(found.course).toHaveProperty('title', seeded.course.title);
  });
});
