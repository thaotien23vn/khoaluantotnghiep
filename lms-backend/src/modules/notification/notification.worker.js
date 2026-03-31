const { Worker } = require('bullmq');
const Redis = require('ioredis');
const notificationService = require('./notification.service');

const isTest = process.env.NODE_ENV === 'test';

// Khai báo biến worker để export
let notificationWorker;

if (!isTest) {
  // 1. Cấu hình Redis Connection - Tối ưu cho Upstash
  // QUAN TRỌNG: BullMQ yêu cầu maxRetriesPerRequest = null cho blocking operations
  const redisOptions = {
    maxRetriesPerRequest: null, // BẮT BUỘC cho BullMQ
    retryStrategy: (times) => Math.min(times * 100, 2000),
    lazyConnect: true,
    ...(process.env.REDIS_URL && process.env.REDIS_URL.startsWith('rediss') && {
      tls: { rejectUnauthorized: false },
    }),
  };

  // Khởi tạo thực thể kết nối Redis
  const redisConnection = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, redisOptions)
    : new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        ...redisOptions,
      });

  // Bắt lỗi kết nối để không làm sập Server
  redisConnection.on('error', (err) => {
    console.error('❌ [RedisWorker] Connection Error:', err.message);
  });

  // 2. Khởi tạo BullMQ Worker với cấu hình tối ưu cho Upstash
  notificationWorker = new Worker(
    'notificationQueue',
    async (job) => {
      const { type, userId, title, message, payload, dedupeKey, dedupeHours } = job.data;
      
      console.log(`🔔 [Worker] Processing Job ${job.id} | User: ${userId} | Type: ${type}`);

      try {
        const result = await notificationService.createNotification({
          userId, title, message, type, payload, dedupeKey, dedupeHours,
        });
        
        return { 
          success: true, 
          notificationId: result?.notification?.id,
          skipped: result?.skipped 
        };
      } catch (error) {
        console.error(`❌ [Worker] Error in Job ${job.id}:`, error.message);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 3, // Giảm từ 5 xuống 3
      // Tối ưu polling cho Upstash - Giảm số request Redis
      lockDuration: 30000, // 30s thay vì 5s mặc định
      stalledInterval: 30000, // 30s thay vì 30s mặc định
      maxStalledCount: 1,
      drainDelay: 5000, // Đợi 5s trước khi poll tiếp khi queue empty
    }
  );

  // 3. Lắng nghe các sự kiện của Worker
  notificationWorker.on('completed', (job, result) => {
    if (result.skipped) {
      console.log(`⚠️ [Worker] Job ${job.id} SKIPPED (Duplicate)`);
    } else {
      console.log(`✅ [Worker] Job ${job.id} COMPLETED`);
    }
  });

  notificationWorker.on('failed', (job, err) => {
    console.error(`❌ [Worker] Job ${job.id} FAILED:`, err.message);
  });

  console.log('🚀 [Worker] Notification Worker optimized for Upstash');

} else {
  // Mock Worker cho môi trường Testing
  notificationWorker = { on: () => {} };
}

module.exports = { notificationWorker };