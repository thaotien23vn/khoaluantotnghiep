const request = require('supertest');
const app = require('../app');

describe('GET /api/health', () => {
  it('should return OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
  });
});
