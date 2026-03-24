const { Queue } = require('bullmq');
const Redis = require('ioredis');

const isTest = process.env.NODE_ENV === 'test';

let notificationQueue;
let redisConnection;

if (!isTest) {
  // Use REDIS_URL for production, fallback to host/port for development
  if (process.env.REDIS_URL) {
    redisConnection = new Redis(process.env.REDIS_URL);
  } else {
    redisConnection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      maxRetriesPerRequest: null,
    });
  }

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
} else {
  // Mock queue for test environment
  notificationQueue = {
    add: async (name, data, opts) => {
      // In test mode, directly call notification service
      const notificationService = require('./notification.service');
      const result = await notificationService.createNotification(data);
      return { id: result.notification.id, data: result };
    },
  };
  redisConnection = null;
}

module.exports = { notificationQueue, redisConnection };
