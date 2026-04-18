const { Op } = require('sequelize');
const { notificationQueue } = require('../notification/notification.queue');
const db = require('../../models');

class EnrollmentScheduler {
  /**
   * Update enrollment statuses based on expiration dates
   * - active -> grace_period: when expiresAt < now <= gracePeriodEndsAt
   * - grace_period -> expired: when gracePeriodEndsAt < now
   */
  static async updateEnrollmentStatuses() {
    const { Enrollment, Course, User } = db.models;
    const now = new Date();

    console.log('[EnrollmentScheduler] Starting status update at:', now.toISOString());

    // 1. Update active -> grace_period (expired but in grace period)
    const activeToGrace = await Enrollment.findAll({
      where: {
        enrollmentStatus: 'active',
        expiresAt: { [Op.lt]: now },
        gracePeriodEndsAt: { [Op.gte]: now },
      },
      include: [
        { model: Course, as: 'Course', attributes: ['id', 'title'] },
        { model: User, as: 'User', attributes: ['id', 'email', 'firstName', 'lastName'] },
      ],
    });

    for (const enrollment of activeToGrace) {
      enrollment.enrollmentStatus = 'grace_period';
      await enrollment.save();
      
      console.log(`[EnrollmentScheduler] Enrollment ${enrollment.id} -> grace_period`);
      
      // Send grace period notification
      await notificationQueue.add('sendEmail', {
        to: enrollment.User?.email,
        subject: 'Khóa học của bạn đã hết hạn - Ân hạn 7 ngày',
        template: 'course-grace-period',
        data: {
          userName: `${enrollment.User?.firstName || ''} ${enrollment.User?.lastName || ''}`.trim(),
          courseTitle: enrollment.Course?.title,
          gracePeriodEndsAt: enrollment.gracePeriodEndsAt,
          renewalUrl: `/course/${enrollment.courseId}/renew`,
        },
      });
    }

    // 2. Update grace_period -> expired (grace period ended)
    const graceToExpired = await Enrollment.findAll({
      where: {
        enrollmentStatus: 'grace_period',
        gracePeriodEndsAt: { [Op.lt]: now },
      },
      include: [
        { model: Course, as: 'Course', attributes: ['id', 'title'] },
        { model: User, as: 'User', attributes: ['id', 'email', 'firstName', 'lastName'] },
      ],
    });

    for (const enrollment of graceToExpired) {
      enrollment.enrollmentStatus = 'expired';
      await enrollment.save();
      
      console.log(`[EnrollmentScheduler] Enrollment ${enrollment.id} -> expired`);
      
      // Send expiration notification
      await notificationQueue.add('sendEmail', {
        to: enrollment.User?.email,
        subject: 'Khóa học của bạn đã hết hạn hoàn toàn',
        template: 'course-expired',
        data: {
          userName: `${enrollment.User?.firstName || ''} ${enrollment.User?.lastName || ''}`.trim(),
          courseTitle: enrollment.Course?.title,
          renewUrl: `/course/${enrollment.courseId}/renew`,
        },
      });
    }

    // 3. Also update any active with expiresAt < now but gracePeriodEndsAt missing/also expired
    const activeToExpired = await Enrollment.findAll({
      where: {
        enrollmentStatus: 'active',
        expiresAt: { [Op.lt]: now },
        [Op.or]: [
          { gracePeriodEndsAt: null },
          { gracePeriodEndsAt: { [Op.lt]: now } },
        ],
      },
      include: [
        { model: Course, as: 'Course', attributes: ['id', 'title'] },
        { model: User, as: 'User', attributes: ['id', 'email', 'firstName', 'lastName'] },
      ],
    });

    for (const enrollment of activeToExpired) {
      enrollment.enrollmentStatus = 'expired';
      await enrollment.save();
      
      console.log(`[EnrollmentScheduler] Enrollment ${enrollment.id} -> expired (no grace)`);
    }

    const result = {
      activeToGrace: activeToGrace.length,
      graceToExpired: graceToExpired.length,
      activeToExpired: activeToExpired.length,
      totalUpdated: activeToGrace.length + graceToExpired.length + activeToExpired.length,
    };

    console.log('[EnrollmentScheduler] Status update completed:', result);
    return result;
  }

  /**
   * Check for enrollments nearing expiration (7 days, 1 day)
   */
  static async scheduleExpirationReminders() {
    const { Enrollment, Course, User } = db.models;
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const in8Days = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    // Find enrollments expiring in 7 days
    const expiringIn7Days = await Enrollment.findAll({
      where: {
        enrollmentStatus: 'active',
        expiresAt: {
          [Op.gte]: in7Days,
          [Op.lte]: in8Days,
        },
      },
      include: [
        { model: Course, as: 'Course', attributes: ['id', 'title'] },
        { model: User, as: 'User', attributes: ['id', 'email', 'firstName', 'lastName'] },
      ],
    });

    // Find enrollments expiring in 1 day
    const expiringIn1Day = await Enrollment.findAll({
      where: {
        enrollmentStatus: 'active',
        expiresAt: {
          [Op.gte]: in1Day,
          [Op.lte]: in2Days,
        },
      },
      include: [
        { model: Course, as: 'Course', attributes: ['id', 'title'] },
        { model: User, as: 'User', attributes: ['id', 'email', 'firstName', 'lastName'] },
      ],
    });

    for (const enrollment of expiringIn7Days) {
      await notificationQueue.add('sendEmail', {
        to: enrollment.User?.email,
        subject: 'Khóa học của bạn sắp hết hạn (7 ngày)',
        template: 'course-expiring-soon',
        data: {
          userName: `${enrollment.User?.firstName || ''} ${enrollment.User?.lastName || ''}`.trim(),
          courseTitle: enrollment.Course?.title,
          expiresAt: enrollment.expiresAt,
          renewalUrl: `/course/${enrollment.courseId}/renew`,
          daysLeft: 7,
        },
      });
    }

    for (const enrollment of expiringIn1Day) {
      await notificationQueue.add('sendEmail', {
        to: enrollment.User?.email,
        subject: 'Khóa học của bạn sắp hết hạn (1 ngày)',
        template: 'course-expiring-soon',
        data: {
          userName: `${enrollment.User?.firstName || ''} ${enrollment.User?.lastName || ''}`.trim(),
          courseTitle: enrollment.Course?.title,
          expiresAt: enrollment.expiresAt,
          renewalUrl: `/course/${enrollment.courseId}/renew`,
          daysLeft: 1,
        },
      });
    }

    return {
      reminders7d: expiringIn7Days.length,
      reminders1d: expiringIn1Day.length,
    };
  }
}

module.exports = { EnrollmentScheduler };
