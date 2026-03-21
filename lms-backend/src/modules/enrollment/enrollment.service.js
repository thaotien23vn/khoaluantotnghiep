const db = require('../../models');
const courseAggregatesService = require('../../services/courseAggregates.service');
const notificationController = require('../../controllers/notification.controller');

const { Enrollment, Course, User, Payment } = db.models;

/**
 * Enrollment Service - Business logic for enrollment operations
 */
class EnrollmentService {
  /**
   * Enroll user into a course
   */
  async enroll(userId, userRole, courseId) {
    // Only student can self-enroll
    if (userRole !== 'student') {
      throw { 
        status: 403, 
        message: 'Chỉ học viên mới được tự ghi danh khóa học',
      };
    }

    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (!course.published) {
      throw { 
        status: 400, 
        message: 'Khóa học chưa được xuất bản, không thể đăng ký',
      };
    }

    // Instructor cannot enroll in their own course
    if (course.createdBy && Number(course.createdBy) === Number(userId)) {
      throw { 
        status: 400, 
        message: 'Bạn không thể ghi danh vào khóa học do chính bạn tạo',
      };
    }

    const price = Number(course.price || 0);

    // Paid course requires completed payment
    if (price > 0) {
      const completedPayment = await Payment.findOne({
        where: {
          userId,
          courseId: Number(courseId),
          status: 'completed',
        },
        order: [['created_at', 'DESC']],
      });

      if (!completedPayment) {
        throw { 
          status: 402, 
          message: 'Khóa học có phí. Vui lòng thanh toán hợp lệ trước khi ghi danh',
        };
      }
    }

    // Check for existing enrollment
    const existing = await Enrollment.findOne({
      where: { userId, courseId: Number(courseId) },
    });

    if (existing) {
      throw { 
        status: 409, 
        message: 'Bạn đã đăng ký khóa học này rồi',
        data: { enrollmentId: existing.id },
      };
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      userId,
      courseId: Number(courseId),
      status: 'enrolled',
      progressPercent: 0,
    });

    // Update course students count
    try {
      await courseAggregatesService.recomputeCourseStudents(courseId);
    } catch (aggErr) {
      console.error('Recompute course students (silent) error:', aggErr);
    }

    // Get enrollment with course details
    const enrollmentWithCourse = await Enrollment.findByPk(enrollment.id, {
      include: [
        { 
          model: Course, 
          as: 'Course', 
          attributes: ['id', 'title', 'slug', 'price'],
        },
      ],
    });

    // Send notification
    try {
      await notificationController.createEnrollmentNotification(userId, course.id);
    } catch (notifyErr) {
      console.error('Create enrollment notification (silent) error:', notifyErr);
    }

    return { enrollment: enrollmentWithCourse };
  }

  /**
   * Unenroll user from a course
   */
  async unenroll(userId, courseId) {
    const enrollment = await Enrollment.findOne({
      where: { userId, courseId: Number(courseId) },
    });

    if (!enrollment) {
      throw { status: 404, message: 'Bạn chưa đăng ký khóa học này' };
    }

    await enrollment.destroy();

    // Update course students count
    try {
      await courseAggregatesService.recomputeCourseStudents(courseId);
    } catch (aggErr) {
      console.error('Recompute course students (silent) error:', aggErr);
    }

    return { message: 'Đã hủy đăng ký khóa học' };
  }

  /**
   * Get user's enrollments
   */
  async getMyEnrollments(userId) {
    const enrollments = await Enrollment.findAll({
      where: { userId },
      include: [
        {
          model: Course,
          as: 'Course',
          attributes: ['id', 'title', 'slug', 'price', 'published', 'imageUrl'],
          include: [
            { model: User, as: 'creator', attributes: ['id', 'name', 'username'] },
          ],
        },
      ],
      order: [['enrolledAt', 'DESC']],
    });

    return { enrollments };
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

    if (!enrollment) {
      throw { status: 404, message: 'Bạn chưa đăng ký khóa học này' };
    }

    return { enrollment };
  }

  /**
   * Update progress percent
   */
  async updateProgress(userId, courseId, progressPercent) {
    if (progressPercent == null || Number(progressPercent) < 0 || Number(progressPercent) > 100) {
      throw { status: 400, message: 'Tiến độ phải là số từ 0 đến 100' };
    }

    const enrollment = await Enrollment.findOne({
      where: { userId, courseId: Number(courseId) },
    });

    if (!enrollment) {
      throw { status: 404, message: 'Bạn chưa đăng ký khóa học này' };
    }

    enrollment.progressPercent = Math.min(100, Math.max(0, Number(progressPercent)));
    await enrollment.save();

    return { enrollment };
  }
}

module.exports = new EnrollmentService();
