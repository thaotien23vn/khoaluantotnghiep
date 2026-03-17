const request = require('supertest');
const app = require('../app');
const { loginByRole } = require('./testAuth');

describe('POST /api/auth/login', () => {
  it('should login admin and return token', async () => {
    // Use the same login function as other tests
    const token = await loginByRole('admin');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  });
});
