const cron = require('node-cron');
const placementQuestionGenerator = require('../../services/placementQuestionGenerator.service');
const logger = require('../../utils/logger');

/**
 * Cron job to pre-generate placement test questions nightly
 * Runs at 2:00 AM every day (low traffic time)
 */
class PlacementQuestionCron {
  constructor() {
    this.task = null;
  }

  /**
   * Start the cron job
   */
  start() {
    // Run at 2:00 AM daily
    this.task = cron.schedule('0 2 * * *', async () => {
      logger.info('PLACEMENT_CRON_START', { 
        time: new Date().toISOString(),
        job: 'pre-generate-questions' 
      });

      try {
        const results = await placementQuestionGenerator.generateAllMissingQuestions();
        
        logger.info('PLACEMENT_CRON_COMPLETE', {
          generated: results.generated,
          failed: results.failed,
          errors: results.errors.length,
        });
      } catch (err) {
        logger.error('PLACEMENT_CRON_ERROR', { error: err.message });
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Ho_Chi_Minh', // Vietnam timezone
    });

    logger.info('PLACEMENT_CRON_SCHEDULED', { 
      schedule: '0 2 * * *',
      timezone: 'Asia/Ho_Chi_Minh'
    });
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.task) {
      this.task.stop();
      logger.info('PLACEMENT_CRON_STOPPED');
    }
  }

  /**
   * Run immediately (for manual trigger)
   */
  async runNow() {
    logger.info('PLACEMENT_CRON_MANUAL_START');
    
    try {
      // First get stats
      const stats = await placementQuestionGenerator.getBankStatistics();
      logger.info('PLACEMENT_CRON_STATS', { stats });

      // Then generate
      const results = await placementQuestionGenerator.generateAllMissingQuestions();
      
      logger.info('PLACEMENT_CRON_MANUAL_COMPLETE', {
        generated: results.generated,
        failed: results.failed,
      });

      return results;
    } catch (err) {
      logger.error('PLACEMENT_CRON_MANUAL_ERROR', { error: err.message });
      throw err;
    }
  }
}

module.exports = new PlacementQuestionCron();
