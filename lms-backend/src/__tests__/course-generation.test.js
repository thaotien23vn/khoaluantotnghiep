/**
 * Course Generation Tests
 * Tests for courseGeneration.queue.js and courseGeneration.worker.js
 * Note: In test environment, these use mocks instead of actual Redis/BullMQ
 */

describe('Course Generation Tests', () => {
  describe('Course Generation Queue', () => {
    test('should export queue and connection', () => {
      const { courseGenerationQueue, redisConnection } = require('../services/courseGeneration.queue');
      expect(courseGenerationQueue).toBeDefined();
      expect(courseGenerationQueue.add).toBeInstanceOf(Function);
    });

    test('should add job to queue in test mode', async () => {
      const { courseGenerationQueue } = require('../services/courseGeneration.queue');

      const jobData = {
        courseId: 1,
        chapterIds: [1, 2, 3],
        options: { skipExistingContent: true },
        userId: 1,
      };

      const result = await courseGenerationQueue.add('generateCourse', jobData);

      expect(result).toBeDefined();
      expect(result.id).toBe('test-job-id');
      expect(result.data).toEqual(jobData);
    });
  });

  describe('Course Generation Worker', () => {
    test('should export worker (null in test mode)', () => {
      const { courseGenerationWorker } = require('../services/courseGeneration.worker');
      // In test mode, worker should be null (not initialized)
      expect(courseGenerationWorker).toBeNull();
    });
  });
});
