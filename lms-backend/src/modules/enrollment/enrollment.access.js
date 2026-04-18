const { Op } = require('sequelize');
const db = require('../../models');

/**
 * Unified Enrollment Access Checker
 * Ensures consistent access control logic across backend and frontend
 */
class EnrollmentAccess {
  /**
   * Check if user has access to course content
   * Returns detailed status with access decision
   */
  static async checkAccess(userId, courseId) {
    const { Enrollment } = db.models;
    const now = new Date();

    const enrollment = await Enrollment.findOne({
      where: {
        userId,
        courseId,
      },
    });

    if (!enrollment) {
      return {
        hasAccess: false,
        reason: 'not_enrolled',
        message: 'Bạn chưa ghi danh vào khóa học này',
        enrollment: null,
      };
    }

    // Backward compatibility: handle legacy records without enrollmentStatus
    const effectiveStatus = enrollment.enrollmentStatus || (enrollment.status === 'enrolled' ? 'active' : 'unknown');

    // Primary check: enrollmentStatus
    switch (effectiveStatus) {
      case 'active':
        return {
          hasAccess: true,
          reason: 'active',
          message: 'Quyền truy cập đầy đủ',
          enrollment,
          expiresAt: enrollment.expiresAt,
        };

      case 'grace_period':
        // Additional time-based check for safety
        if (enrollment.gracePeriodEndsAt && enrollment.gracePeriodEndsAt > now) {
          return {
            hasAccess: true,
            reason: 'grace_period',
            message: 'Trong thời gian ân hạn, vui lòng gia hạn sớm',
            enrollment,
            expiresAt: enrollment.expiresAt,
            gracePeriodEndsAt: enrollment.gracePeriodEndsAt,
            daysRemaining: Math.ceil((enrollment.gracePeriodEndsAt - now) / (1000 * 60 * 60 * 24)),
          };
        }
        // Grace period actually expired, should be updated by scheduler
        return {
          hasAccess: false,
          reason: 'grace_expired',
          message: 'Thời gian ân hạn đã kết thúc',
          enrollment,
        };

      case 'expired':
        return {
          hasAccess: false,
          reason: 'expired',
          message: 'Khóa học đã hết hạn, vui lòng gia hạn để tiếp tục học',
          enrollment,
          renewUrl: `/course/${courseId}/renew`,
        };

      case 'pending':
        return {
          hasAccess: false,
          reason: 'pending',
          message: 'Ghi danh đang chờ xác nhận thanh toán',
          enrollment,
        };

      case 'dropped':
        return {
          hasAccess: false,
          reason: 'dropped',
          message: 'Bạn đã rút khỏi khóa học',
          enrollment,
        };

      default:
        return {
          hasAccess: false,
          reason: 'unknown_status',
          message: 'Trạng thái ghi danh không xác định',
          enrollment,
        };
    }
  }

  /**
   * Quick check - just returns boolean
   */
  static async canAccess(userId, courseId) {
    const result = await this.checkAccess(userId, courseId);
    return result.hasAccess;
  }

  /**
   * Get enrollment with access info
   */
  static async getEnrollmentWithAccessInfo(userId, courseId) {
    const accessCheck = await this.checkAccess(userId, courseId);
    return {
      ...accessCheck,
      needsRenewal: accessCheck.reason === 'grace_period' || accessCheck.reason === 'expired',
      showExpirationWarning: accessCheck.enrollment?.expiresAt && 
        new Date(accessCheck.enrollment.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Check multiple enrollments at once
   */
  static async checkMultiple(userId, courseIds) {
    const results = await Promise.all(
      courseIds.map(courseId => this.checkAccess(userId, courseId))
    );
    return courseIds.reduce((acc, courseId, index) => {
      acc[courseId] = results[index];
      return acc;
    }, {});
  }
}

module.exports = EnrollmentAccess;
