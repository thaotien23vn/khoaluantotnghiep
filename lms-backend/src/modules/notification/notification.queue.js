const { Queue } = require('bullmq');
const Redis = require('ioredis');

const isTest = process.env.NODE_ENV === 'test';

let notificationQueue;
let redisConnection;

if (!isTest) {
  // Cấu hình Redis tối ưu cho Upstash - Giảm số request
  const redisOptions = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      // Exponential backoff: 100ms, 200ms, 400ms
      return Math.min(times * 100, 2000);
    },
    lazyConnect: true, // Chỉ kết nối khi cần
    ...(process.env.REDIS_URL && process.env.REDIS_URL.startsWith('rediss') && {
      tls: {
        rejectUnauthorized: false,
      },
    }),
  };

  // Khởi tạo connection
  if (process.env.REDIS_URL) {
    redisConnection = new Redis(process.env.REDIS_URL, redisOptions);
  } else {
    redisConnection = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      ...redisOptions,
    });
  }

  // Lắng nghe lỗi để không làm sập App khi Redis mất kết nối
  redisConnection.on('error', (err) => {
    console.error('❌ Redis Queue Connection Error:', err.message);
  });

  // Khởi tạo BullMQ Queue với cấu hình tối ưu cho Upstash
  notificationQueue = new Queue('notificationQueue', {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 20 }, // Giữ 20 job cuối thay vì 100
      removeOnFail: { count: 10 }, // Giữ 10 job fail
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
    // Tối ưu cho môi trường serverless/free tier
    settings: {
      lockDuration: 30000, // 30s thay vì mặc định 5s
      stalledInterval: 30000, // Kiểm tra stalled job mỗi 30s
      maxStalledCount: 1,
    },
  });

  console.log('🚀 Notification Queue initialized (optimized)');
} else {
  // Mock cho môi trường Test
  notificationQueue = {
    add: async (name, data) => {
      const notificationService = require('./notification.service');
      const result = await notificationService.createNotification(data);
      return { id: result.notification?.id || 'test-id', data: result };
    },
  };
  redisConnection = null;
}

module.exports = { notificationQueue, redisConnection };