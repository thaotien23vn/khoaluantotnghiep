const { Queue } = require('bullmq');
const Redis = require('ioredis');

const isTest = process.env.NODE_ENV === 'test';

let courseGenerationQueue;
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

  // Lắng nghe lỗi
  redisConnection.on('error', (err) => {
    console.error('❌ Course Generation Queue Connection Error:', err.message);
  });

  // Khởi tạo BullMQ Queue
  courseGenerationQueue = new Queue('courseGenerationQueue', {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 25,
      attempts: 1, // Không retry job level - để worker xử lý retry
      backoff: {
        type: 'fixed',
        delay: 5000,
      },
    },
  });

  console.log('🚀 Course Generation Queue initialized');
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
