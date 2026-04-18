require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const { connectDB } = require('./models');
const { autoSeed } = require('./models/seed');
const emailService = require('./services/email.service');
const http = require('http');
const { initSocket } = require('./socket');
const notificationCron = require('./modules/notification/notification.cron');
const placementQuestionCron = require('./modules/placement/placementQuestion.cron');
const logger = require('./utils/logger');
require('./modules/notification/notification.worker');
require('./services/courseGeneration.worker'); // Khởi động course generation worker

const PORT = process.env.PORT || 5000;

logger.info('SERVER_STARTING');

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
    logger.warn('JWT_SECRET_MISSING_DEV_DEFAULT');
  }

  // Optional but recommended
  if (!process.env.ALLOWED_ORIGINS) {
    logger.warn('ALLOWED_ORIGINS_MISSING_USING_DEFAULTS');
  }
};

(async () => {
  try {
    validateEnv();

    // Kết nối database
    await connectDB();

    // Auto-sync database cho production (Render free tier)
    if (process.env.NODE_ENV === 'production') {
      logger.info('DATABASE_AUTO_SYNC_STARTED');
      try {
        await sequelize.sync();
        logger.info('DATABASE_AUTO_SYNC_COMPLETED');
      } catch (syncErr) {
        logger.error('DATABASE_AUTO_SYNC_FAILED', { error: syncErr.message });
        // Không exit, vẫn tiếp tục chạy
      }
    }

    // Tự động tạo admin nếu chưa có (không cần biến env)
    logger.info('AUTO_SEED_STARTED');
    try {
      await autoSeed();
      logger.info('AUTO_SEED_COMPLETED');
    } catch (seedErr) {
      logger.warn('AUTO_SEED_FAILED_CONTINUE_STARTUP', { error: seedErr.message });
    }

    // Kiểm tra kết nối email
    const emailConnected = await emailService.verifyEmailConnection();
    if (!emailConnected) {
      logger.warn('EMAIL_SERVICE_NOT_CONFIGURED');
    }

    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, '0.0.0.0', () => {
      logger.info('SERVER_LISTENING', { port: PORT, apiBaseUrl: `http://localhost:${PORT}/api` });
      
      // Start notification scheduler cron jobs
      notificationCron.start();
      
      // Start placement question pre-generation cron
      placementQuestionCron.start();
    });
  } catch (error) {
    logger.error('SERVER_STARTUP_FAILED', { error: error.message });
    process.exit(1);
  }
})();