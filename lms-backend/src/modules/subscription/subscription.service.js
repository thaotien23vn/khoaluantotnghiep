const db = require('../../models');
const courseAggregatesService = require('../../services/courseAggregates.service');

const { Enrollment, Course, User, Payment } = db.models;

/**
 * Subscription Service - Business logic for subscription-based access
 * 
 * Note: This implementation provides a foundation for subscription plans.
 * In the current system, courses can be purchased individually or accessed
 * through subscription plans if implemented.
 */
class SubscriptionService {
  /**
   * Check if user has active subscription for a course
   */
  async hasActiveSubscription(userId, courseId) {
    // Check individual purchase (enrollment with completed payment)
    const enrollment = await Enrollment.findOne({
      where: { userId, courseId },
    });

    if (enrollment) {
      return { hasAccess: true, type: 'enrollment' };
    }

    // Check for completed payment (not yet enrolled - edge case)
    const completedPayment = await Payment.findOne({
      where: {
        userId,
        courseId,
        status: 'completed',
      },
    });

    if (completedPayment) {
      return { hasAccess: true, type: 'purchased' };
    }

    return { hasAccess: false };
  }

  /**
   * Get user's subscription/access status for all courses
   */
  async getUserSubscriptions(userId) {
    const enrollments = await Enrollment.findAll({
      where: { userId },
      include: [
        {
          model: Course,
          as: 'Course',
          attributes: ['id', 'title', 'slug', 'price'],
        },
      ],
    });

    const payments = await Payment.findAll({
      where: { userId, status: 'completed' },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug', 'price'],
        },
      ],
    });

    return {
      enrollments,
      purchases: payments,
      totalActive: enrollments.length,
    };
  }

  /**
   * Check course access and get expiration info
   */
  async getCourseAccessInfo(userId, courseId) {
    const access = await this.hasActiveSubscription(userId, courseId);

    if (!access.hasAccess) {
      return {
        hasAccess: false,
        canEnroll: true,
        reason: 'not_purchased',
      };
    }

    const enrollment = await Enrollment.findOne({
      where: { userId, courseId },
      include: [
        {
          model: Course,
          as: 'Course',
          attributes: ['id', 'title', 'slug'],
        },
      ],
    });

    if (!enrollment) {
      return {
        hasAccess: true,
        type: access.type,
        canEnroll: true,
        reason: 'paid_not_enrolled',
      };
    }

    return {
      hasAccess: true,
      type: access.type,
      enrollmentId: enrollment.id,
      enrolledAt: enrollment.enrolledAt,
      progressPercent: enrollment.progressPercent,
      status: enrollment.status,
    };
  }

  /**
   * Grant access to course (used after successful payment)
   */
  async grantCourseAccess(userId, courseId) {
    // Check if already has access
    const existing = await Enrollment.findOne({
      where: { userId, courseId },
    });

    if (existing) {
      return { 
        enrollment: existing,
        isNew: false,
        message: 'User already has access to this course',
      };
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      userId,
      courseId,
      status: 'enrolled',
      progressPercent: 0,
    });

    // Update course students count
    try {
      await courseAggregatesService.recomputeCourseStudents(courseId);
    } catch (aggErr) {
      console.error('Recompute course students (silent) error:', aggErr);
    }

    return {
      enrollment,
      isNew: true,
      message: 'Course access granted successfully',
    };
  }

  /**
   * Revoke course access (used for refunds or admin actions)
   */
  async revokeCourseAccess(userId, courseId) {
    const enrollment = await Enrollment.findOne({
      where: { userId, courseId },
    });

    if (!enrollment) {
      return {
        revoked: false,
        message: 'User does not have active enrollment',
      };
    }

    await enrollment.destroy();

    // Update course students count
    try {
      await courseAggregatesService.recomputeCourseStudents(courseId);
    } catch (aggErr) {
      console.error('Recompute course students (silent) error:', aggErr);
    }

    return {
      revoked: true,
      message: 'Course access revoked successfully',
    };
  }

  /**
   * Check if user can access course content
   */
  async canAccessContent(userId, courseId) {
    const access = await this.getCourseAccessInfo(userId, courseId);

    return {
      canAccess: access.hasAccess,
      ...access,
    };
  }
}

module.exports = new SubscriptionService();
