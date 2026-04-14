const cron = require('node-cron');
const NotificationScheduler = require('./notification.scheduler');
const courseChatService = require('../chat/courseChat.service');

class NotificationCron {
  constructor() {
    this.jobs = [];
  }

  start() {
    // Run quiz reminders every hour
    const quizReminderJob = cron.schedule('0 * * * *', async () => {
      if (process.env.NODE_ENV !== 'test') {
        console.log('[Cron] Running quiz reminder scheduler...');
      }
      try {
        const result = await NotificationScheduler.scheduleQuizReminders();
        if (process.env.NODE_ENV !== 'test') {
          console.log('[Cron] Quiz reminders scheduled:', result);
        }
      } catch (error) {
        console.error('[Cron] Quiz reminder scheduler failed:', error.message);
      }
    });

    this.jobs.push(quizReminderJob);

    // Run study reminders daily at 9 AM
    const studyReminderJob = cron.schedule('0 9 * * *', async () => {
      if (process.env.NODE_ENV !== 'test') {
        console.log('[Cron] Running study reminder scheduler...');
      }
      // Study reminders are triggered per-user when they access the platform
      // This job can be used for batch processing if needed
    });

    this.jobs.push(studyReminderJob);

    // Run admin escalation check every hour (after quiz reminders)
    const escalationCheckJob = cron.schedule('15 * * * *', async () => {
      if (process.env.NODE_ENV !== 'test') {
        console.log('[Cron] Running admin escalation check...');
      }
      try {
        const count = await courseChatService.checkAdminEscalation();
        if (process.env.NODE_ENV !== 'test') {
          console.log('[Cron] Admin escalations notified:', count);
        }
      } catch (error) {
        console.error('[Cron] Admin escalation check failed:', error.message);
      }
    });

    this.jobs.push(escalationCheckJob);

    if (process.env.NODE_ENV !== 'test') {
      console.log('[Cron] Notification scheduler started');
    }
  }

  stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    if (process.env.NODE_ENV !== 'test') {
      console.log('[Cron] Notification scheduler stopped');
    }
  }
}

module.exports = new NotificationCron();
