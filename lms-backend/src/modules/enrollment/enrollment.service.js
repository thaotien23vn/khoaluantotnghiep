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

    const enrollment = await Enrollment.create({
      userId,
      courseId: Number(courseId),
      status: 'enrolled',
      progressPercent: 0,
    });

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
          attributes: ['id', 'title', 'slug', 'price', 'published', 'imageUrl', 'level', 'duration'],
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

    const enrichedEnrollments = enrollments.map(enrollment => ({
      ...enrollment.toJSON(),
      progressPercent: Number(enrollment.progressPercent),
      lastAccessedAt: lastAccessMap[enrollment.courseId] || null,
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
}

module.exports = new EnrollmentService();
