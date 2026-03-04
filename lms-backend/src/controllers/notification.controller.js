const db = require('../models');
const { Notification, User, Course, Enrollment, Quiz, Review } = db.models;
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

/**
 * @desc    Get user notifications
 * @route   GET /api/student/notifications
 * @access  Private (Student & Admin)
 */
exports.getUserNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, read } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = { userId: req.user.id };
    if (type) {
      whereClause.type = type;
    }
    if (read !== undefined) {
      whereClause.read = read === 'true';
    }

    const { count, rows: notifications } = await Notification.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Get unread count
    const unreadCount = await Notification.count({
      where: {
        userId: req.user.id,
        read: false
      }
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get user notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Mark notification as read
 * @route   PUT /api/student/notifications/:notificationId/read
 * @access  Private (Student & Admin)
 */
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo'
      });
    }

    // Check ownership
    if (notification.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật thông báo này'
      });
    }

    await notification.update({ read: true });

    res.json({
      success: true,
      message: 'Đã đánh dấu là đã đọc',
      data: { notification }
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/student/notifications/read-all
 * @access  Private (Student & Admin)
 */
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.update(
      { read: true },
      {
        where: {
          userId: req.user.id,
          read: false
        }
      }
    );

    res.json({
      success: true,
      message: 'Đã đánh dấu tất cả là đã đọc'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Delete notification
 * @route   DELETE /api/student/notifications/:notificationId
 * @access  Private (Student & Admin)
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo'
      });
    }

    // Check ownership
    if (notification.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa thông báo này'
      });
    }

    await notification.destroy();

    res.json({
      success: true,
      message: 'Xóa thông báo thành công'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Get unread notifications count
 * @route   GET /api/student/notifications/unread-count
 * @access  Private (Student & Admin)
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.count({
      where: {
        userId: req.user.id,
        read: false
      }
    });

    res.json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

// ========== NOTIFICATION CREATION SERVICES ==========

/**
 * Create notification for course enrollment
 */
exports.createEnrollmentNotification = async (userId, courseId) => {
  try {
    const course = await Course.findByPk(courseId, {
      attributes: ['id', 'title']
    });

    if (!course) return;

    await Notification.create({
      userId,
      type: 'enrollment',
      title: 'Đăng ký khóa học thành công',
      message: `Bạn đã đăng ký thành công khóa học "${course.title}"`,
      payload: {
        courseId: course.id,
        courseTitle: course.title
      }
    });
  } catch (error) {
    console.error('Create enrollment notification error:', error);
  }
};

/**
 * Create notification for quiz completion
 */
exports.createQuizCompletionNotification = async (userId, quizId, score, passed) => {
  try {
    const quiz = await Quiz.findByPk(quizId, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title']
        }
      ]
    });

    if (!quiz) return;

    const title = passed ? 'Hoàn thành bài kiểm tra' : 'Không đạt bài kiểm tra';
    const message = passed 
      ? `Chúc mừng! Bạn đã hoàn thành bài kiểm tra "${quiz.title}" với điểm ${score}`
      : `Bạn chưa đạt bài kiểm tra "${quiz.title}" với điểm ${score}. Hãy thử lại nhé!`;

    await Notification.create({
      userId,
      type: 'quiz',
      title,
      message,
      payload: {
        quizId: quiz.id,
        quizTitle: quiz.title,
        courseId: quiz.course.id,
        courseTitle: quiz.course.title,
        score,
        passed
      }
    });
  } catch (error) {
    console.error('Create quiz completion notification error:', error);
  }
};

/**
 * Create notification for course review
 */
exports.createReviewNotification = async (teacherId, courseId, reviewId, rating, reviewerName) => {
  try {
    const course = await Course.findByPk(courseId, {
      attributes: ['id', 'title']
    });

    if (!course) return;

    await Notification.create({
      userId: teacherId,
      type: 'review',
      title: 'Đánh giá mới cho khóa học',
      message: `${reviewerName} đã đánh giá ${rating} sao cho khóa học "${course.title}"`,
      payload: {
        courseId: course.id,
        courseTitle: course.title,
        reviewId,
        rating,
        reviewerName
      }
    });
  } catch (error) {
    console.error('Create review notification error:', error);
  }
};

/**
 * Create notification for payment completion
 */
exports.createPaymentNotification = async (userId, courseId, amount) => {
  try {
    const course = await Course.findByPk(courseId, {
      attributes: ['id', 'title']
    });

    if (!course) return;

    await Notification.create({
      userId,
      type: 'payment',
      title: 'Thanh toán thành công',
      message: `Thanh toán ${amount} USD cho khóa học "${course.title}" đã được xác nhận`,
      payload: {
        courseId: course.id,
        courseTitle: course.title,
        amount
      }
    });
  } catch (error) {
    console.error('Create payment notification error:', error);
  }
};

/**
 * Create notification for new course (for enrolled students)
 */
exports.createCourseUpdateNotification = async (courseId, updateType, updateContent) => {
  try {
    const course = await Course.findByPk(courseId, {
      attributes: ['id', 'title']
    });

    if (!course) return;

    // Get all enrolled students
    const enrollments = await Enrollment.findAll({
      where: {
        courseId,
        status: 'enrolled'
      },
      attributes: ['userId']
    });

    const userIds = enrollments.map(e => e.userId);

    const titles = {
      new_lecture: 'Bài giảng mới',
      new_chapter: 'Chương mới',
      course_update: 'Cập nhật khóa học',
      announcement: 'Thông báo'
    };

    const messages = {
      new_lecture: `Khóa học "${course.title}" có bài giảng mới: ${updateContent}`,
      new_chapter: `Khóa học "${course.title}" có chương mới: ${updateContent}`,
      course_update: `Khóa học "${course.title}" đã được cập nhật: ${updateContent}`,
      announcement: `Thông báo từ khóa học "${course.title}": ${updateContent}`
    };

    const title = titles[updateType] || 'Cập nhật khóa học';
    const message = messages[updateType] || `Khóa học "${course.title}" có cập nhật mới`;

    // Create notifications for all enrolled students
    const notifications = userIds.map(userId => ({
      userId,
      type: 'course_update',
      title,
      message,
      payload: {
        courseId: course.id,
        courseTitle: course.title,
        updateType,
        updateContent
      }
    }));

    await Notification.bulkCreate(notifications);
  } catch (error) {
    console.error('Create course update notification error:', error);
  }
};

/**
 * Create notification for certificate (future feature)
 */
exports.createCertificateNotification = async (userId, courseId) => {
  try {
    const course = await Course.findByPk(courseId, {
      attributes: ['id', 'title']
    });

    if (!course) return;

    await Notification.create({
      userId,
      type: 'certificate',
      title: 'Chứng chỉ hoàn thành',
      message: `Chúc mừng! Bạn đã nhận được chứng chỉ hoàn thành khóa học "${course.title}"`,
      payload: {
        courseId: course.id,
        courseTitle: course.title
      }
    });
  } catch (error) {
    console.error('Create certificate notification error:', error);
  }
};

// ========== ADMIN ROUTES ==========

/**
 * @desc    Send notification to users (Admin)
 * @route   POST /api/admin/notifications/send
 * @access  Private (Admin)
 */
exports.sendNotification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    const { userIds, type, title, message, payload } = req.body;

    const notifications = userIds.map(userId => ({
      userId,
      type,
      title,
      message,
      payload: payload || {}
    }));

    await Notification.bulkCreate(notifications);

    res.status(201).json({
      success: true,
      message: `Đã gửi thông báo đến ${userIds.length} người dùng`
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Get all notifications (Admin)
 * @route   GET /api/admin/notifications
 * @access  Private (Admin)
 */
exports.getAllNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, userId, type, read } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {};
    if (userId) whereClause.userId = parseInt(userId);
    if (type) whereClause.type = type;
    if (read !== undefined) whereClause.read = read === 'true';

    const { count, rows: notifications } = await Notification.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};
