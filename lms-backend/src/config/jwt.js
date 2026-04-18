const fallbackSecret = 'your_super_secret_jwt_key_change_this_in_production';
const env = String(process.env.NODE_ENV || '').toLowerCase();
const isProduction = env === 'production';
const jwtSecret = String(process.env.JWT_SECRET || '').trim();

if (isProduction && !jwtSecret) {
  throw new Error('JWT_SECRET is required in production. Please set process.env.JWT_SECRET before starting the server.');
}

module.exports = {
  secret: jwtSecret || fallbackSecret,
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
