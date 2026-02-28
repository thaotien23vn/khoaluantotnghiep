module.exports = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  fromName: process.env.EMAIL_FROM_NAME || 'LMS Backend',
  verifyExpire: process.env.EMAIL_VERIFY_EXPIRE || '24h',
  resetPasswordExpire: process.env.RESET_PASSWORD_EXPIRE || '1h',
};
