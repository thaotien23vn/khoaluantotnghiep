const { Worker } = require('bullmq');
const Redis = require('ioredis');
const notificationService = require('./notification.service');

const isTest = process.env.NODE_ENV === 'test';

// Khai báo biến worker để export
let notificationWorker;

if (!isTest) {
  // 1. Cấu hình Redis Connection
  const redisOptions = {
    maxRetriesPerRequest: null, // BẮT BUỘC: BullMQ sẽ báo lỗi nếu không có dòng này
    // Tự động kích hoạt TLS nếu URL bắt đầu bằng rediss:// (Dành cho Upstash/Render)
    ...(process.env.REDIS_URL && process.env.REDIS_URL.startsWith('rediss') && {
      tls: {
        rejectUnauthorized: false,
      },
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

  // 2. Khởi tạo BullMQ Worker
  notificationWorker = new Worker(
    'notificationQueue',
    async (job) => {
      const { 
        type, 
        userId, 
        title, 
        message, 
        payload, 
        dedupeKey, 
        dedupeHours 
      } = job.data;
      
      console.log(`🔔 [Worker] Processing Job ${job.id} | User: ${userId} | Type: ${type}`);

      try {
        // Gọi Service để xử lý logic lưu Database và check trùng (Deduplication)
        const result = await notificationService.createNotification({
          userId,
          title,
          message,
          type,
          payload,
          dedupeKey,
          dedupeHours,
        });
        
        return { 
          success: true, 
          notificationId: result?.notification?.id,
          skipped: result?.skipped 
        };
      } catch (error) {
        console.error(`❌ [Worker] Error in Job ${job.id}:`, error.message);
        // Quăng lỗi ra ngoài để BullMQ biết và thực hiện retry (nếu có config)
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 5, // Xử lý tối đa 5 thông báo cùng lúc để tối ưu hiệu năng
    }
  );

  // 3. Lắng nghe các sự kiện của Worker để tiện Debug trên Render Logs
  notificationWorker.on('completed', (job, result) => {
    if (result.skipped) {
      console.log(`⚠️ [Worker] Job ${job.id} SKIPPED (Duplicate found via dedupeKey)`);
    } else {
      console.log(`✅ [Worker] Job ${job.id} COMPLETED (Notification sent)`);
    }
  });

  notificationWorker.on('failed', (job, err) => {
    console.error(`❌ [Worker] Job ${job.id} FAILED:`, err.message);
  });

  console.log('🚀 [Worker] Notification Worker is running and listening for jobs...');

} else {
  // Mock Worker cho môi trường Testing
  notificationWorker = {
    on: () => {}, 
  };
}

module.exports = { notificationWorker };