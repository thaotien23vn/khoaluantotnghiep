const db = require('../../models');
const courseAggregatesService = require('../../services/courseAggregates.service');
const notificationService = require('../notification/notification.service');
const { Op } = require('sequelize');

const { Enrollment, Course, User, Payment, LectureProgress } = db.models;

/**
 * Enrollment Service - Business logic for enrollment operations
 */
class EnrollmentService {
  /**
   * Enroll user into a course
   */
  async enroll(userId, userRole, courseId) {
    if (userRole !== 'student') {
      throw { status: 403, message: 'Chỉ học viên mới được tự ghi danh khóa học' };
    }

    const course = await Course.findByPk(courseId);
    if (!course) throw { status: 404, message: 'Không tìm thấy khóa học' };

    if (!course.published) {
      throw { status: 400, message: 'Khóa học chưa được xuất bản, không thể đăng ký' };
    }

    if (course.createdBy && Number(course.createdBy) === Number(userId)) {
      throw { status: 400, message: 'Bạn không thể ghi danh vào khóa học do chính bạn tạo' };
    }

    const price = Number(course.price || 0);

    if (price > 0) {
      const completedPayment = await Payment.findOne({
        where: { userId, courseId: Number(courseId), status: 'completed' },
        order: [['created_at', 'DESC']],
      });
      if (!completedPayment) {
        throw {
          status: 402,
          message: 'Khóa học có phí. Vui lòng thanh toán hợp lệ trước khi ghi danh',
        };
      }
    }

    const existing = await Enrollment.findOne({ where: { userId, courseId: Number(courseId) } });
    if (existing) {
      throw { status: 409, message: 'Bạn đã đăng ký khóa học này rồi', data: { enrollmentId: existing.id } };
    }

    // Calculate expiration date based on course duration settings
    let expiresAt = null;
    let gracePeriodEndsAt = null;
    if (course.durationType === 'fixed' && course.durationValue && course.durationUnit) {
      expiresAt = this.calculateExpiryDate(new Date(), course.durationValue, course.durationUnit);
      gracePeriodEndsAt = this.addDays(expiresAt, course.gracePeriodDays || 7);
    }

    let enrollment;
    try {
      enrollment = await Enrollment.create({
        userId,
        courseId: Number(courseId),
        status: 'enrolled',
        enrollmentStatus: 'active',
        progressPercent: 0,
        expiresAt,
        gracePeriodEndsAt,
      });
    } catch (err) {
      // Race-condition safe: unique constraint on (userId, courseId)
      if (err?.name === 'SequelizeUniqueConstraintError') {
        throw { status: 409, message: 'Bạn đã đăng ký khóa học này rồi' };
      }
      throw err;
    }

    try {
      await courseAggregatesService.recomputeCourseStudents(courseId);
    } catch (aggErr) {
      console.error('Recompute course students (silent) error:', aggErr);
    }

    const enrollmentWithCourse = await Enrollment.findByPk(enrollment.id, {
      include: [{ model: Course, as: 'Course', attributes: ['id', 'title', 'slug', 'price'] }],
    });

    try {
      await notificationService.createNotification({
        userId,
        title: 'Đăng ký khóa học thành công',
        message: `Bạn đã đăng ký thành công khóa học "${course.title}"`,
        type: 'enrollment',
        relatedId: course.id,
        relatedType: 'course',
      });
    } catch (notifyErr) {
      console.error('Create enrollment notification (silent) error:', notifyErr);
    }

    return { enrollment: enrollmentWithCourse };
  }

  /**
   * Unenroll user from a course — FIXED: block unenroll for paid courses
   */
  async unenroll(userId, courseId) {
    const enrollment = await Enrollment.findOne({
      where: { userId, courseId: Number(courseId) },
    });

    if (!enrollment) throw { status: 404, message: 'Bạn chưa đăng ký khóa học này' };

    // Block unenroll if a completed payment exists for this course
    const course = await Course.findByPk(courseId, { attributes: ['id', 'price', 'title'] });
    const price = Number(course?.price || 0);

    if (price > 0) {
      const completedPayment = await Payment.findOne({
        where: { userId, courseId: Number(courseId), status: 'completed' },
      });
      if (completedPayment) {
        throw {
          status: 400,
          message: `Bạn đã thanh toán khóa học "${course?.title}". Không thể hủy ghi danh — vui lòng yêu cầu hoàn tiền nếu cần.`,
          data: { paymentId: completedPayment.id },
        };
      }
    }

    await enrollment.destroy();

    // Cleanup per-course progress so unenroll does not leave stale progress history
    try {
      await LectureProgress.destroy({ where: { userId, courseId: Number(courseId) } });
    } catch (e) {
      console.error('Cleanup lecture progress after unenroll (silent) error:', e);
    }

    try {
      await courseAggregatesService.recomputeCourseStudents(courseId);
    } catch (aggErr) {
      console.error('Recompute course students (silent) error:', aggErr);
    }

    return { message: 'Đã hủy đăng ký khóa học' };
  }

  /**
   * Get user's enrollments — FIXED: includes progressPercent, enrolledAt, lastAccessedAt
   */
  async getMyEnrollments(userId) {
    const enrollments = await Enrollment.findAll({
      where: { userId },
      include: [
        {
          model: Course,
          as: 'Course',
          attributes: ['id', 'title', 'slug', 'price', 'published', 'imageUrl', 'level', 'duration',
            'durationType', 'durationValue', 'durationUnit', 'renewalDiscountPercent', 'gracePeriodDays'],
          include: [
            { model: User, as: 'creator', attributes: ['id', 'name', 'username'] },
          ],
        },
      ],
      order: [['enrolledAt', 'DESC']],
    });

    // Get last accessed lecture for each enrolled course in one query
    const courseIds = enrollments.map(e => e.courseId);
    let lastAccessMap = {};
    if (courseIds.length > 0) {
      const lastAccesses = await LectureProgress.findAll({
        where: {
          userId,
          courseId: { [Op.in]: courseIds },
        },
        attributes: [
          'courseId',
          [db.sequelize.fn('MAX', db.sequelize.col('last_accessed_at')), 'lastAccessedAt'],
        ],
        group: ['courseId'],
        raw: true,
      });
      lastAccessMap = Object.fromEntries(lastAccesses.map(r => [r.courseId, r.lastAccessedAt]));
    }

    const enrichedEnrollments = await Promise.all(enrollments.map(async enrollment => {
      // Use EnrollmentAccess to determine effective status (handles NULLs and legacy records)
      const EnrollmentAccess = require('./enrollment.access');
      const access = await EnrollmentAccess.checkAccess(userId, enrollment.courseId);
      
      return {
        ...enrollment.toJSON(),
        progressPercent: Number(enrollment.progressPercent),
        lastAccessedAt: lastAccessMap[enrollment.courseId] || null,
        // Expiration fields
        expiresAt: enrollment.expiresAt,
        gracePeriodEndsAt: enrollment.gracePeriodEndsAt,
        renewalCount: enrollment.renewalCount,
        lastRenewedAt: enrollment.lastRenewedAt,
        enrollmentStatus: access.reason,
      };
    }));

    return { enrollments: enrichedEnrollments };
  }

  /**
   * Get enrollment detail by course
   */
  async getEnrollmentByCourse(userId, courseId) {
    const enrollment = await Enrollment.findOne({
      where: { userId, courseId: Number(courseId) },
      include: [
        {
          model: Course,
          as: 'Course',
          attributes: [
            'id', 'title', 'slug', 'description', 'price',
            'published', 'imageUrl', 'level', 'rating', 'reviewCount', 'duration',
            'durationType', 'durationValue', 'durationUnit', 'renewalDiscountPercent', 'gracePeriodDays',
          ],
          include: [
            { model: User, as: 'creator', attributes: ['id', 'name', 'username'] },
          ],
        },
      ],
    });

    if (!enrollment) throw { status: 404, message: 'Bạn chưa đăng ký khóa học này' };

    // Get last accessed lecture
    const lastProgress = await LectureProgress.findOne({
      where: { userId, courseId: Number(courseId) },
      order: [['lastAccessedAt', 'DESC']],
      attributes: ['lectureId', 'lastAccessedAt', 'watchedPercent', 'isCompleted'],
    });

    return {
      enrollment: {
        ...enrollment.toJSON(),
        progressPercent: Number(enrollment.progressPercent),
        lastAccessedAt: lastProgress?.lastAccessedAt || null,
        lastLectureId: lastProgress?.lectureId || null,
        // Expiration fields
        expiresAt: enrollment.expiresAt,
        gracePeriodEndsAt: enrollment.gracePeriodEndsAt,
        renewalCount: enrollment.renewalCount,
        lastRenewedAt: enrollment.lastRenewedAt,
        enrollmentStatus: enrollment.enrollmentStatus,
      },
    };
  }

  /**
   * Update progress percent (manual — usually auto-updated by lecture progress)
   */
  async updateProgress(userId, courseId, progressPercent) {
    if (progressPercent == null || Number(progressPercent) < 0 || Number(progressPercent) > 100) {
      throw { status: 400, message: 'Tiến độ phải là số từ 0 đến 100' };
    }

    const enrollment = await Enrollment.findOne({ where: { userId, courseId: Number(courseId) } });
    if (!enrollment) throw { status: 404, message: 'Bạn chưa đăng ký khóa học này' };

    enrollment.progressPercent = Math.min(100, Math.max(0, Number(progressPercent)));
    await enrollment.save();

    return { enrollment };
  }

  /**
   * Check enrollment status and auto-update if expired
   */
  async checkAndUpdateExpiration(enrollmentId) {
    const enrollment = await Enrollment.findByPk(enrollmentId, {
      include: [{ model: Course, as: 'Course' }],
    });

    if (!enrollment || !enrollment.expiresAt) return enrollment;

    const now = new Date();
    let updated = false;

    // Check if expired and update status
    if (now > enrollment.expiresAt && enrollment.enrollmentStatus === 'active') {
      enrollment.enrollmentStatus = 'grace_period';
      updated = true;
    }

    // Check if grace period ended
    if (enrollment.gracePeriodEndsAt && now > enrollment.gracePeriodEndsAt 
        && enrollment.enrollmentStatus === 'grace_period') {
      enrollment.enrollmentStatus = 'expired';
      updated = true;
    }

    if (updated) {
      await enrollment.save();
    }

    return enrollment;
  }

  /**
   * Calculate renewal price for an enrollment
   */
  async getRenewalPrice(enrollmentId, renewalMonths) {
    const enrollment = await Enrollment.findByPk(enrollmentId, {
      include: [{ model: Course, as: 'Course' }],
    });

    if (!enrollment) throw { status: 404, message: 'Không tìm thấy ghi danh' };

    const course = enrollment.Course;
    const basePrice = Number(course.price) || 0;
    const discountPercent = course.renewalDiscountPercent || 0;
    
    // Get course duration (in months) to calculate unit price
    const courseDurationValue = course.durationValue || 1;
    const courseDurationUnit = course.durationUnit || 'months';
    
    // Convert course duration to months
    let courseDurationMonths = courseDurationValue;
    if (courseDurationUnit === 'years') {
      courseDurationMonths = courseDurationValue * 12;
    } else if (courseDurationUnit === 'days') {
      courseDurationMonths = courseDurationValue / 30;
    }
    
    // Calculate price per month based on course price and duration
    // (e.g., if course is 1 month = 100k, then monthly price = 100k)
    // (e.g., if course is 3 months = 300k, then monthly price = 100k)
    const monthlyPrice = courseDurationMonths > 0 ? basePrice / courseDurationMonths : basePrice;
    
    // Calculate renewal original price (without discount)
    const originalPrice = Math.floor(monthlyPrice * renewalMonths);
    
    // Calculate discount amount
    const discountAmount = Math.floor(originalPrice * discountPercent / 100);
    
    // Calculate final renewal price with discount
    const renewalPrice = originalPrice - discountAmount;
    
    // Calculate new expiration date
    let startFrom = new Date();
    if (enrollment.expiresAt && enrollment.expiresAt > startFrom) {
      startFrom = enrollment.expiresAt;
    }
    const newExpiresAt = this.calculateExpiryDate(startFrom, renewalMonths, 'months');

    return {
      renewalPrice,
      originalPrice,
      discountPercent,
      discountAmount,
      renewalMonths,
      currentExpiry: enrollment.expiresAt,
      newExpiry: newExpiresAt,
      enrollmentStatus: enrollment.enrollmentStatus,
    };
  }

  /**
   * Renew enrollment for a course
   */
  async renewEnrollment(userId, enrollmentId, renewalMonths, paymentId = null) {
    const enrollment = await Enrollment.findOne({
      where: { id: enrollmentId, userId },
      include: [{ model: Course, as: 'Course' }],
    });

    if (!enrollment) throw { status: 404, message: 'Không tìm thấy ghi danh' };

    // Allow renewal for active, grace_period, or expired enrollments
    if (!['active', 'grace_period', 'expired'].includes(enrollment.enrollmentStatus)) {
      throw { status: 400, message: 'Không thể gia hạn ghi danh này' };
    }

    const course = enrollment.Course;
    
    // Calculate new expiration date
    let startFrom = new Date();
    if (enrollment.expiresAt && enrollment.expiresAt > startFrom) {
      // If not yet expired, extend from current expiry
      startFrom = enrollment.expiresAt;
    }
    const newExpiresAt = this.calculateExpiryDate(startFrom, renewalMonths, 'months');
    const newGracePeriodEndsAt = this.addDays(newExpiresAt, course.gracePeriodDays || 7);

    // Update enrollment
    enrollment.expiresAt = newExpiresAt;
    enrollment.gracePeriodEndsAt = newGracePeriodEndsAt;
    enrollment.renewalCount += 1;
    enrollment.lastRenewedAt = new Date();
    enrollment.enrollmentStatus = 'active';
    
    await enrollment.save();

    // Send renewal notification
    try {
      await notificationService.createNotification({
        userId,
        title: 'Gia hạn khóa học thành công',
        message: `Bạn đã gia hạn khóa học "${course.title}" thêm ${renewalMonths} tháng. Hết hạn mới: ${newExpiresAt.toLocaleDateString('vi-VN')}`,
        type: 'enrollment_renewal',
        relatedId: course.id,
        relatedType: 'course',
      });
    } catch (notifyErr) {
      console.error('Create renewal notification (silent) error:', notifyErr);
    }

    return {
      enrollment,
      renewalMonths,
      newExpiresAt,
      newGracePeriodEndsAt,
    };
  }

  /**
   * Get user's enrollments that are expiring soon
   */
  async getExpiringEnrollments(userId, daysThreshold = 7) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const enrollments = await Enrollment.findAll({
      where: {
        userId,
        enrollmentStatus: 'active',
        expiresAt: {
          [Op.lte]: thresholdDate,
          [Op.gt]: new Date(),
        },
      },
      include: [
        {
          model: Course,
          as: 'Course',
          attributes: ['id', 'title', 'slug', 'imageUrl', 'price', 'renewalDiscountPercent'],
        },
      ],
      order: [['expiresAt', 'ASC']],
    });

    return { enrollments };
  }

  /**
   * Get all expired enrollments in grace period (for cron job)
   */
  async getGracePeriodEnrollments() {
    const now = new Date();
    
    const enrollments = await Enrollment.findAll({
      where: {
        enrollmentStatus: 'grace_period',
        gracePeriodEndsAt: {
          [Op.lte]: now,
        },
      },
      include: [
        {
          model: Course,
          as: 'Course',
          attributes: ['id', 'title'],
        },
        {
          model: User,
          as: 'User',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    return { enrollments };
  }

  /**
   * Helper: Calculate expiry date
   */
  calculateExpiryDate(startDate, value, unit) {
    const date = new Date(startDate);
    switch(unit) {
      case 'days':
        date.setDate(date.getDate() + value);
        break;
      case 'years':
        date.setFullYear(date.getFullYear() + value);
        break;
      case 'months':
      default:
        // Handle fractional months (0.25 = 1 week, 0.5 = 2 weeks)
        // Average month = 30.44 days (365.25 / 12)
        const totalDays = Math.round(value * 30.44);
        date.setDate(date.getDate() + totalDays);
        break;
    }
    return date;
  }

  /**
   * Helper: Add days to date
   */
  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}

module.exports = new EnrollmentService();
