const request = require('supertest');
const app = require('../app');
const { seedCore } = require('./jest.teardown');

describe('GET /api/categories', () => {
  it('should include seeded category', async () => {
    const seeded = await seedCore();

    const res = await request(app).get('/api/categories');
    expect(res.statusCode).toBe(200);

    const categories = res.body?.data?.categories || res.body?.data;
    expect(Array.isArray(categories)).toBe(true);

    const found = categories.find((c) => Number(c.id) === Number(seeded.category.id));
    expect(found).toBeTruthy();
  });
});
