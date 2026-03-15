const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const notificationController = require('../controllers/notification.controller');
const { body, query } = require('express-validator');

const router = express.Router();

// Notification validation rules
const sendNotificationValidation = [
  body('userIds').isArray({ min: 1 }).withMessage('Danh sách người dùng không được rỗng'),
  body('userIds.*').isInt().withMessage('ID người dùng phải là số nguyên'),
  body('type').isIn(['enrollment', 'quiz', 'review', 'payment', 'course_update', 'certificate', 'announcement']).withMessage('Loại thông báo không hợp lệ'),
  body('title').notEmpty().withMessage('Tiêu đề không được để trống'),
  body('message').notEmpty().withMessage('Nội dung không được để trống'),
  body('payload').optional().isObject().withMessage('Payload phải là object')
];

// ========== STUDENT ROUTES ==========

/**
 * @route   GET /api/student/notifications
 * @desc    Get user notifications
 * @access  Private (Student & Admin)
 */
router.get(
  '/student/notifications',
  authMiddleware,
  authorizeRole('student', 'admin'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Trang phải là số nguyên dương'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Giới hạn phải là số nguyên từ 1-100'),
    query('type').optional().isIn(['enrollment', 'quiz', 'review', 'payment', 'course_update', 'certificate', 'announcement']).withMessage('Loại thông báo không hợp lệ'),
    query('read').optional().isBoolean().withMessage('Read phải là boolean')
  ],
  notificationController.getUserNotifications
);

/**
 * @route   GET /api/student/notifications/unread-count
 * @desc    Get unread notifications count
 * @access  Private (Student & Admin)
 */
router.get(
  '/student/notifications/unread-count',
  authMiddleware,
  authorizeRole('student', 'admin'),
  notificationController.getUnreadCount
);

/**
 * @route   PUT /api/student/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Private (Student & Admin)
 */
router.put(
  '/student/notifications/:notificationId/read',
  authMiddleware,
  authorizeRole('student', 'admin'),
  notificationController.markAsRead
);

/**
 * @route   PUT /api/student/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private (Student & Admin)
 */
router.put(
  '/student/notifications/read-all',
  authMiddleware,
  authorizeRole('student', 'admin'),
  notificationController.markAllAsRead
);

/**
 * @route   DELETE /api/student/notifications/delete-all
 * @desc    Delete all notifications for current user
 * @access  Private (Student & Admin)
 */
router.delete(
  '/student/notifications/delete-all',
  authMiddleware,
  authorizeRole('student', 'admin'),
  notificationController.deleteAllNotifications
);

/**
 * @route   DELETE /api/student/notifications/:notificationId
 * @desc    Delete notification
 * @access  Private (Student & Admin)
 */
router.delete(
  '/student/notifications/:notificationId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  notificationController.deleteNotification
);

 router.get(
   '/teacher/notifications',
   authMiddleware,
   authorizeRole('teacher', 'admin'),
   [
     query('page').optional().isInt({ min: 1 }).withMessage('Trang phải là số nguyên dương'),
     query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Giới hạn phải là số nguyên từ 1-100'),
     query('type').optional().isIn(['enrollment', 'quiz', 'review', 'payment', 'course_update', 'certificate', 'announcement']).withMessage('Loại thông báo không hợp lệ'),
     query('read').optional().isBoolean().withMessage('Read phải là boolean')
   ],
   notificationController.getUserNotifications
 );

 router.get(
   '/teacher/notifications/unread-count',
   authMiddleware,
   authorizeRole('teacher', 'admin'),
   notificationController.getUnreadCount
 );

 router.put(
   '/teacher/notifications/:notificationId/read',
   authMiddleware,
   authorizeRole('teacher', 'admin'),
   notificationController.markAsRead
 );

 router.put(
   '/teacher/notifications/read-all',
   authMiddleware,
   authorizeRole('teacher', 'admin'),
   notificationController.markAllAsRead
 );

 router.delete(
  '/teacher/notifications/delete-all',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  notificationController.deleteAllNotifications
 );

 router.delete(
   '/teacher/notifications/:notificationId',
   authMiddleware,
   authorizeRole('teacher', 'admin'),
   notificationController.deleteNotification
 );

// ========== ADMIN ROUTES ==========

/**
 * @route   POST /api/admin/notifications/send
 * @desc    Send notification to users (Admin)
 * @access  Private (Admin)
 */
router.post(
  '/admin/notifications/send',
  authMiddleware,
  authorizeRole('admin'),
  sendNotificationValidation,
  notificationController.sendNotification
);

/**
 * @route   GET /api/admin/notifications
 * @desc    Get all notifications (Admin)
 * @access  Private (Admin)
 */
router.get(
  '/admin/notifications',
  authMiddleware,
  authorizeRole('admin'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Trang phải là số nguyên dương'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Giới hạn phải là số nguyên từ 1-100'),
    query('userId').optional().isInt().withMessage('ID người dùng phải là số nguyên'),
    query('type').optional().isIn(['enrollment', 'quiz', 'review', 'payment', 'course_update', 'certificate', 'announcement']).withMessage('Loại thông báo không hợp lệ'),
    query('read').optional().isBoolean().withMessage('Read phải là boolean')
  ],
  notificationController.getAllNotifications
);

// ========== ADMIN "MY" NOTIFICATIONS (for FE compatibility) ==========

router.get(
  '/admin/my-notifications',
  authMiddleware,
  authorizeRole('admin'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Trang phải là số nguyên dương'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Giới hạn phải là số nguyên từ 1-100'),
    query('type').optional().isIn(['enrollment', 'quiz', 'review', 'payment', 'course_update', 'certificate', 'announcement']).withMessage('Loại thông báo không hợp lệ'),
    query('read').optional().isBoolean().withMessage('Read phải là boolean')
  ],
  notificationController.getMyAdminNotifications
);

router.put(
  '/admin/my-notifications/:notificationId/read',
  authMiddleware,
  authorizeRole('admin'),
  notificationController.markMyAdminNotificationAsRead
);

router.put(
  '/admin/my-notifications/read-all',
  authMiddleware,
  authorizeRole('admin'),
  notificationController.markAllMyAdminNotificationsAsRead
);

router.delete(
  '/admin/my-notifications/delete-all',
  authMiddleware,
  authorizeRole('admin'),
  notificationController.deleteAllMyAdminNotifications
);

router.delete(
  '/admin/my-notifications/:notificationId',
  authMiddleware,
  authorizeRole('admin'),
  notificationController.deleteMyAdminNotification
);

module.exports = router;
