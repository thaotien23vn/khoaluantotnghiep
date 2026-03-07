const db = require('../models');
const { Enrollment, Course, User, Payment } = db.models;
 const notificationController = require('./notification.controller');

/**
 * POST /api/student/courses/:courseId/enroll
 * Học viên đăng ký khóa học
 */
exports.enroll = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Business rule: only student can self-enroll (routes should enforce, but keep defense-in-depth)
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ học viên mới được tự ghi danh khóa học',
      });
    }

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }
    if (!course.published) {
      return res.status(400).json({
        success: false,
        message: 'Khóa học chưa được xuất bản, không thể đăng ký',
      });
    }

    // Business rule: instructor (creator) cannot enroll their own course
    // (Course model uses createdBy in this project)
    if (course.createdBy && Number(course.createdBy) === Number(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể ghi danh vào khóa học do chính bạn tạo',
      });
    }

    // Business rule: paid course requires valid payment BEFORE enrollment is created
    const price = Number(course.price || 0);
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
        return res.status(402).json({
          success: false,
          message: 'Khóa học có phí. Vui lòng thanh toán hợp lệ trước khi ghi danh',
        });
      }
    }

    const existing = await Enrollment.findOne({
      where: { userId, courseId: Number(courseId) },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Bạn đã đăng ký khóa học này rồi',
        data: { enrollmentId: existing.id },
      });
    }

    const enrollment = await Enrollment.create({
      userId,
      courseId: Number(courseId),
      status: 'enrolled',
      progressPercent: 0,
    });

    const enrollmentWithCourse = await Enrollment.findByPk(enrollment.id, {
      include: [{ model: Course, as: 'Course', attributes: ['id', 'title', 'slug', 'price'] }],
    });

     try {
       await notificationController.createEnrollmentNotification(userId, course.id);
     } catch (notifyErr) {
       console.error('Create enrollment notification (silent) error:', notifyErr);
     }

    res.status(201).json({
      success: true,
      message: 'Đăng ký khóa học thành công',
      data: { enrollment: enrollmentWithCourse },
    });
  } catch (error) {
    console.error('Lỗi đăng ký khóa học:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/student/courses/:courseId/enroll
 * Học viên hủy đăng ký khóa học
 */
exports.unenroll = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const enrollment = await Enrollment.findOne({
      where: { userId, courseId: Number(courseId) },
    });
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Bạn chưa đăng ký khóa học này',
      });
    }

    await enrollment.destroy();
    res.json({
      success: true,
      message: 'Đã hủy đăng ký khóa học',
    });
  } catch (error) {
    console.error('Lỗi hủy đăng ký:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * GET /api/student/enrollments
 * Danh sách khóa học đã đăng ký của học viên
 */
exports.getMyEnrollments = async (req, res) => {
  try {
    const userId = req.user.id;

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

    res.json({
      success: true,
      message: 'Danh sách khóa học của bạn',
      data: { enrollments },
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách đăng ký:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * GET /api/student/enrollments/course/:courseId
 * Chi tiết đăng ký của học viên cho một khóa học (để xem tiến độ)
 */
exports.getEnrollmentByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const enrollment = await Enrollment.findOne({
      where: { userId, courseId: Number(courseId) },
      include: [
        {
          model: Course,
          as: 'Course',
          attributes: ['id', 'title', 'slug', 'description', 'price', 'published', 'imageUrl', 'level', 'rating', 'reviewCount', 'duration'],
          include: [
            { model: User, as: 'creator', attributes: ['id', 'name', 'username'] },
          ],
        },
      ],
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Bạn chưa đăng ký khóa học này',
      });
    }

    res.json({
      success: true,
      data: { enrollment },
    });
  } catch (error) {
    console.error('Lỗi lấy chi tiết đăng ký:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * PUT /api/student/progress/:courseId
 * Cập nhật tiến độ hoàn thành khóa học (0–100)
 */
exports.updateProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { progressPercent } = req.body;
    const userId = req.user.id;

    if (progressPercent == null || Number(progressPercent) < 0 || Number(progressPercent) > 100) {
      return res.status(400).json({
        success: false,
        message: 'Tiến độ phải là số từ 0 đến 100',
      });
    }

    const enrollment = await Enrollment.findOne({
      where: { userId, courseId: Number(courseId) },
    });
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Bạn chưa đăng ký khóa học này',
      });
    }

    enrollment.progressPercent = Math.min(100, Math.max(0, Number(progressPercent)));
    await enrollment.save();

    res.json({
      success: true,
      message: 'Cập nhật tiến độ thành công',
      data: { enrollment },
    });
  } catch (error) {
    console.error('Lỗi cập nhật tiến độ:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};
