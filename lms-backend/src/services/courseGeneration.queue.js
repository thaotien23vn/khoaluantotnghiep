const { Queue } = require('bullmq');
const Redis = require('ioredis');

const isTest = process.env.NODE_ENV === 'test';

let courseGenerationQueue;
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

  // Lắng nghe lỗi
  redisConnection.on('error', (err) => {
    console.error('❌ Course Generation Queue Connection Error:', err.message);
  });

  // Khởi tạo BullMQ Queue với cấu hình tối ưu cho Upstash
  courseGenerationQueue = new Queue('courseGenerationQueue', {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 10 }, // Giữ 10 job cuối thay vì 50
      removeOnFail: { count: 5 }, // Giữ 5 job fail
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
    // Tối ưu cho môi trường serverless/free tier
    settings: {
      lockDuration: 30000, // 30s thay vì mặc định 5s (giảm số lần extend lock)
      stalledInterval: 30000, // Kiểm tra stalled job mỗi 30s
      maxStalledCount: 1, // Giảm số lần retry stalled job
    },
  });

  console.log('🚀 Course Generation Queue initialized (optimized)');
} else {
  // Mock cho môi trường Test
  courseGenerationQueue = {
    add: async (name, data) => {
      return { id: 'test-job-id', data };
    },
  };
  redisConnection = null;
}

module.exports = { courseGenerationQueue, redisConnection };
