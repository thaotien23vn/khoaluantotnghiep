const { Queue } = require('bullmq');
const Redis = require('ioredis');

const isTest = process.env.NODE_ENV === 'test';

let notificationQueue;
let redisConnection;

if (!isTest) {
  // Cấu hình Redis chung
  const redisOptions = {
    maxRetriesPerRequest: null, 
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

  // Khởi tạo BullMQ Queue
  notificationQueue = new Queue('notificationQueue', {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });

  console.log('🚀 Notification Queue initialized');
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