require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const { connectDB } = require('./models');
const { autoSeed } = require('./models/seed');
const emailService = require('./services/email.service');
const http = require('http');
const { initSocket } = require('./socket');
const notificationCron = require('./modules/notification/notification.cron');
require('./modules/notification/notification.worker');
require('./services/courseGeneration.worker'); // Khởi động course generation worker

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
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const hasOldDbConfig = process.env.DB_NAME && process.env.DB_USER && process.env.DB_HOST;

  // Database config: either DATABASE_URL (Neon) or old DB_* variables
  if (!hasDatabaseUrl && !hasOldDbConfig) {
    throw new Error('Missing database configuration. Please set either DATABASE_URL (for Neon PostgreSQL) or DB_NAME, DB_USER, DB_HOST');
  }

  // JWT validation
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

    // Auto-sync database cho production (Render free tier)
    if (process.env.NODE_ENV === 'production') {
      console.log('🔄 Auto-syncing database...');
      try {
        await sequelize.sync({ alter: true });
        console.log('✅ Database sync completed');
      } catch (syncErr) {
        console.error('❌ Database sync failed:', syncErr.message);
        // Không exit, vẫn tiếp tục chạy
      }
    }

    // Tự động tạo admin nếu chưa có (không cần biến env)
    console.log('🌱 Kiểm tra và tạo admin user nếu cần...');
    try {
      await autoSeed();
      console.log('✅ Auto seed hoàn tất\n');
    } catch (seedErr) {
      console.error('⚠️  Auto seed thất bại nhưng vẫn tiếp tục khởi động:', seedErr.message);
    }

    // Kiểm tra kết nối email
    const emailConnected = await emailService.verifyEmailConnection();
    if (!emailConnected) {
      console.warn('⚠️  Email service not properly configured. Some features may not work.');
    }

    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Server chạy trên port ${PORT}`);
      console.log(`✓ API: http://localhost:${PORT}/api`);
      
      // Start notification scheduler cron jobs
      notificationCron.start();
    });
  } catch (error) {
    console.error('✗ Lỗi khởi động server:', error.message);
    process.exit(1);
  }
})();