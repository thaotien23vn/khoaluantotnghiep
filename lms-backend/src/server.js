require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const { connectDB } = require('./models');
const { autoSeed } = require('./models/seed-rich');
const emailService = require('./services/email.service');
const http = require('http');
const { initSocket } = require('./socket');
const notificationCron = require('./modules/notification/notification.cron');
const logger = require('./utils/logger');

require('./modules/notification/notification.worker');
require('./services/courseGeneration.worker');

const PORT = process.env.PORT || 5000;
const NODE_ENV = (process.env.NODE_ENV || 'development').toLowerCase();

logger.info('SERVER_STARTING', { env: NODE_ENV });

const requireEnv = (name) => {
  const v = process.env[name];
  if (!v || String(v).trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
};

const validateEnv = () => {
  const isProd = NODE_ENV === 'production';

  if (!process.env.DATABASE_URL && !(process.env.DB_NAME && process.env.DB_USER && process.env.DB_HOST)) {
    throw new Error('Missing database configuration');
  }

  if (isProd) {
    requireEnv('JWT_SECRET');
  } else if (!process.env.JWT_SECRET) {
    logger.warn('JWT_SECRET_MISSING_DEV_DEFAULT');
  }

  if (!process.env.ALLOWED_ORIGINS) {
    logger.warn('ALLOWED_ORIGINS_MISSING_USING_DEFAULTS');
  }
};

(async () => {
  try {
    validateEnv();

    // 1. CONNECT DB
    await connectDB();
    logger.info('DATABASE_CONNECTED');

    // 2. SYNC (STRICT CONTROL)
    if (NODE_ENV === 'development') {
      logger.warn('DATABASE_SYNC_DEVELOPMENT_ONLY');

      try {
        // ⚠️ DEV ONLY → KHÔNG dùng alter
        await sequelize.sync();
        logger.info('DATABASE_SYNC_DONE');
      } catch (err) {
        logger.error('DATABASE_SYNC_FAILED_DEV', {
          error: err.message
        });
      }
    } else {
      logger.info('DATABASE_SYNC_SKIPPED', {
        env: NODE_ENV,
        reason: 'Use migrations in production'
      });
    }

    // 3. SEED (disabled — run manually with npm run seed if needed)
    // try {
    //   await autoSeed();
    //   logger.info('AUTO_SEED_COMPLETED');
    // } catch (err) {
    //   logger.warn('AUTO_SEED_FAILED_CONTINUE', { error: err.message });
    // }

    // 4. EMAIL CHECK
    const emailConnected = await emailService.verifyEmailConnection();
    if (!emailConnected) {
      logger.warn('EMAIL_SERVICE_NOT_CONFIGURED');
    }

    // 5. START SERVER
    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, '0.0.0.0', () => {
      logger.info('SERVER_LISTENING', {
        port: PORT,
        env: NODE_ENV
      });

      notificationCron.start();
    });

  } catch (error) {
    logger.error('SERVER_STARTUP_FAILED', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
})();