const { Op } = require('sequelize');
const { notificationQueue } = require('./notification.queue');
const db = require('../../models');

class NotificationScheduler {
  static async scheduleQuizReminders() {
    const { Quiz, Course, Enrollment, Attempt } = db.models;
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Find quizzes ending in 23-25 hours (for 24h reminder)
    const quizzesFor24hReminder = await Quiz.findAll({
      where: {
        endTime: {
          [Op.gte]: in24Hours,
          [Op.lte]: in25Hours,
        },
      },
      include: [
        { model: Course, as: 'course', attributes: ['id', 'title'] },
      ],
    });

    // Find quizzes ending in 0-2 hours (for 1h reminder)
    const quizzesFor1hReminder = await Quiz.findAll({
      where: {
        endTime: {
          [Op.gte]: now,
          [Op.lte]: in2Hours,
        },
      },
      include: [
        { model: Course, as: 'course', attributes: ['id', 'title'] },
      ],
    });

    // Process 24h reminders
    for (const quiz of quizzesFor24hReminder) {
      await this.sendQuizReminder(quiz, '24h');
    }

    // Process 1h reminders
    for (const quiz of quizzesFor1hReminder) {
      await this.sendQuizReminder(quiz, '1h');
    }

    return {
      reminders24h: quizzesFor24hReminder.length,
      reminders1h: quizzesFor1hReminder.length,
    };
  }

  static async sendQuizReminder(quiz, reminderType) {
    const { Attempt, Enrollment } = db.models;
    
    // Fetch enrollments for the course
    const enrollments = await Enrollment.findAll({
      where: {
        courseId: quiz.courseId,
        enrollmentStatus: { [Op.in]: ['active', 'grace_period'] },
      },
    });
    
    for (const enrollment of enrollments) {
      const userId = enrollment.userId;
      
      // Check if user has already attempted this quiz
      const hasAttempt = await Attempt.findOne({
        where: { quizId: quiz.id, userId },
      });
      
      if (hasAttempt) continue;

      const hours = reminderType === '24h' ? 24 : 1;
      const title = `⏰ Quiz sắp hết hạn!`;
      const message = `Bạn còn ${hours} giờ để hoàn thành quiz "${quiz.title}" trong khóa "${quiz.course?.title || ''}"`;
      const dedupeKey = `quiz_deadline:${quiz.id}:${userId}:${reminderType}`;

      await notificationQueue.add(
        'quiz-reminder',
        {
          type: 'quiz_reminder',
          userId,
          title,
          message,
          payload: {
            quizId: quiz.id,
            courseId: quiz.courseId,
            reminderType,
            endTime: quiz.endTime,
          },
          dedupeKey,
          dedupeHours: 48, // Longer dedupe for quiz reminders
        },
        {
          delay: 0,
          jobId: dedupeKey, // Ensures idempotency at job level too
        }
      );
    }
  }

  static async scheduleStudyReminder(userId, courseId, lastAccessedAt) {
    const daysSinceLastStudy = Math.floor(
      (Date.now() - new Date(lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastStudy >= 3) {
      const dedupeKey = `study_reminder:${userId}:${courseId}`;
      
      await notificationQueue.add(
        'study-reminder',
        {
          type: 'study_reminder',
          userId,
          title: '📚 Nhắc nhở học tập',
          message: `Bạn đã ${daysSinceLastStudy} ngày chưa học. Hãy tiếp tục để duy trì streak!`,
          payload: { courseId, daysSinceLastStudy },
          dedupeKey,
          dedupeHours: 24,
        },
        {
          delay: 0,
          jobId: dedupeKey,
        }
      );
    }
  }

  static async scheduleChapterCompletion(userId, courseId, chapterTitle) {
    const dedupeKey = `chapter_complete:${userId}:${courseId}:${Date.now()}`;
    
    await notificationQueue.add(
      'chapter-complete',
      {
        type: 'chapter_complete',
        userId,
        title: '🎉 Chúc mừng!',
        message: `Bạn đã hoàn thành chương "${chapterTitle}"`,
        payload: { courseId, chapterTitle },
        dedupeKey,
        dedupeHours: 1,
      },
      {
        delay: 0,
      }
    );
  }
}

module.exports = NotificationScheduler;
