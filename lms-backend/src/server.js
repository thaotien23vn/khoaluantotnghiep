require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./models');
const emailService = require('./services/email.service');

const PORT = process.env.PORT || 5000;

console.log('Starting server...');

(async () => {
  try {
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