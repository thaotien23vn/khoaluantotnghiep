describe('JWT config security hardening', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('production + missing JWT_SECRET => throws on load', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    expect(() => require('../../config/jwt')).toThrow(
      'JWT_SECRET is required in production'
    );
  });

  test('production + valid JWT_SECRET => loads normally', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'prod_super_secret_123';
    process.env.JWT_EXPIRES_IN = '2h';

    const cfg = require('../../config/jwt');
    expect(cfg).toMatchObject({
      secret: 'prod_super_secret_123',
      expiresIn: '2h',
    });
  });

  test('development + missing JWT_SECRET => allows fallback secret', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;

    const cfg = require('../../config/jwt');
    expect(cfg).toMatchObject({
      secret: 'your_super_secret_jwt_key_change_this_in_production',
      expiresIn: '7d',
    });
  });
});

