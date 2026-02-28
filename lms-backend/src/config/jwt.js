module.exports = {
  secret: process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
