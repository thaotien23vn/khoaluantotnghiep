const request = require('supertest');
const app = require('../app');
const { seedCore } = require('./jest.teardown');

describe('Public courses', () => {
  it('GET /api/courses should include seeded published course', async () => {
    const seeded = await seedCore();

    const res = await request(app).get('/api/courses?page=1&limit=20');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    const courses = res.body?.data?.courses;
    expect(Array.isArray(courses)).toBe(true);

    const found = courses.find((c) => String(c.title) === String(seeded.course.title));
    expect(found).toBeTruthy();
  });
});
