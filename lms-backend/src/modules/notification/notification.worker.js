const { Worker } = require('bullmq');
const Redis = require('ioredis');
const notificationService = require('./notification.service');

const isTest = process.env.NODE_ENV === 'test';

// Only create worker in non-test environments
let notificationWorker;

if (!isTest) {
  // Use REDIS_URL for production, fallback to host/port for development
  let redisConnection;
  if (process.env.REDIS_URL) {
    redisConnection = new Redis(process.env.REDIS_URL);
  } else {
    redisConnection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      maxRetriesPerRequest: null,
    });
  }

  notificationWorker = new Worker(
    'notificationQueue',
    async (job) => {
      const { type, userId, title, message, payload, dedupeKey, dedupeHours } = job.data;
      
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
        notificationId: result.notification.id,
        skipped: result.skipped 
      };
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  notificationWorker.on('completed', (job, result) => {
    console.log(`[NotificationWorker] Job ${job.id} completed:`, result);
  });

  notificationWorker.on('failed', (job, err) => {
    console.error(`[NotificationWorker] Job ${job.id} failed:`, err.message);
  });
} else {
  // Mock worker for test environment
  notificationWorker = {
    on: () => {}, // no-op event handler
  };
}

module.exports = { notificationWorker };
