require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./models');
const emailService = require('./services/email.service');

const PORT = process.env.PORT || 5000;

console.log('Starting server...');

const requireEnv = (name) => {
  const v = process.env[name];
  if (v == null || String(v).trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
};

const validateEnv = () => {
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  // Required
  requireEnv('DB_NAME');
  requireEnv('DB_USER');
  requireEnv('DB_HOST');
  if (isProd) {
    requireEnv('JWT_SECRET');
  } else if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET is not set. Using default insecure secret (development only).');
  }

  // Optional but recommended
  if (!process.env.ALLOWED_ORIGINS) {
    console.warn('⚠️  ALLOWED_ORIGINS is not set. Using default localhost origins.');
  }
};

(async () => {
  try {
    validateEnv();

    // Kết nối database
    await connectDB();

    // Kiểm tra kết nối email
    const emailConnected = await emailService.verifyEmailConnection();
    if (!emailConnected) {
      console.warn('⚠️  Email service not properly configured. Some features may not work.');
    }

    app.listen(PORT, () => {
      console.log(`✓ Server chạy trên port ${PORT}`);
      console.log(`✓ API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('✗ Lỗi khởi động server:', error.message);
    process.exit(1);
  }
})();