const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const notificationController = require('../modules/notification/notification.controller');
const {
  getNotificationsValidation,
  sendNotificationValidation,
} = require('../modules/notification/notification.validation');

const router = express.Router();

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
  getNotificationsValidation,
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
  getNotificationsValidation,
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
  getNotificationsValidation,
  notificationController.getAllNotifications
);

// ========== ADMIN "MY" NOTIFICATIONS (for FE compatibility) ==========

router.get(
  '/admin/my-notifications',
  authMiddleware,
  authorizeRole('admin'),
  getNotificationsValidation,
  notificationController.getUserNotifications
);

router.put(
  '/admin/my-notifications/:notificationId/read',
  authMiddleware,
  authorizeRole('admin'),
  notificationController.markAsRead
);

router.put(
  '/admin/my-notifications/read-all',
  authMiddleware,
  authorizeRole('admin'),
  notificationController.markAllAsRead
);

router.delete(
  '/admin/my-notifications/delete-all',
  authMiddleware,
  authorizeRole('admin'),
  notificationController.deleteAllNotifications
);

router.delete(
  '/admin/my-notifications/:notificationId',
  authMiddleware,
  authorizeRole('admin'),
  notificationController.deleteNotification
);

module.exports = router;
