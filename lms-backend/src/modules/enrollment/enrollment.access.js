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
  static async checkAccess(userId, courseId, userRole = null) {
    const { Enrollment, Course, User } = db.models;
    const now = new Date();

    // Auto-enrollment for teacher (own courses) and admin (all courses)
    if (!userRole) {
      const user = await User.findByPk(userId, { attributes: ['role'] });
      userRole = user?.role || 'student';
    }

    const course = await Course.findByPk(courseId, { attributes: ['id', 'createdBy'] });
    
    // Teacher: auto-enroll if they own the course
    if (userRole === 'teacher' && course && Number(course.createdBy) === Number(userId)) {
      let enrollment = await Enrollment.findOne({
        where: { userId, courseId },
      });
      
      if (!enrollment) {
        // Auto-enroll teacher for their own course
        enrollment = await Enrollment.create({
          userId,
          courseId,
          status: 'enrolled',
          enrollmentStatus: 'active',
          source: 'teacher_access',
          payment: 'none',
          progressPercent: 0,
          enrolledAt: new Date(),
          expiresAt: null, // Teacher has lifetime access to their own courses
        });
      }
      
      return {
        hasAccess: true,
        reason: 'teacher_owner',
        message: 'Bạn là giảng viên của khóa học này',
        enrollment,
        expiresAt: null,
      };
    }

    // Admin: auto-enroll for all courses
    if (userRole === 'admin') {
      let enrollment = await Enrollment.findOne({
        where: { userId, courseId },
      });
      
      if (!enrollment) {
        // Auto-enroll admin for all courses
        enrollment = await Enrollment.create({
          userId,
          courseId,
          status: 'enrolled',
          enrollmentStatus: 'active',
          source: 'admin_access',
          payment: 'none',
          progressPercent: 0,
          enrolledAt: new Date(),
          expiresAt: null, // Admin has lifetime access to all courses
        });
      }
      
      return {
        hasAccess: true,
        reason: 'admin_access',
        message: 'Bạn là quản trị viên',
        enrollment,
        expiresAt: null,
      };
    }

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
        // SECURITY: Even if marked 'active', we must check if it has actually expired.
        // This closes the bypass for legacy records with missing enrollmentStatus.
        if (enrollment.expiresAt && new Date(enrollment.expiresAt) < new Date()) {
          return {
            hasAccess: false,
            reason: 'expired',
            message: 'Khóa học đã hết hạn',
            enrollment,
            expiresAt: enrollment.expiresAt,
          };
        }
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
