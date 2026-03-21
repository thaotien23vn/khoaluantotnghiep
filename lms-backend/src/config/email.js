module.exports = {
  // Brevo API Configuration
  apiKey: process.env.BREVO_API_KEY,
  
  // Sender Configuration
  fromEmail: process.env.EMAIL_FROM,
  fromName: process.env.EMAIL_FROM_NAME || 'EnglishLearning',
  
  // Token Expiry Settings
  verifyExpire: process.env.EMAIL_VERIFY_EXPIRE || '24h',
  resetPasswordExpire: process.env.RESET_PASSWORD_EXPIRE || '1h',
};
