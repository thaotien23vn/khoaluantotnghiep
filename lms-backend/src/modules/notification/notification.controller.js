const { validationResult } = require('express-validator');
const notificationService = require('./notification.service');
const NotificationScheduler = require('./notification.scheduler');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array(),
    });
  }
  return null;
};

/**
 * Handle service errors
 */
const handleServiceError = (error, res) => {
  console.error('Notification error:', error);
  
  // Handle specific database errors with user-friendly messages
  if (error.name === 'SequelizeForeignKeyConstraintError') {
    const field = error.index?.replace('_fkey', '') || 'user_id';
    const value = error.parameters?.[1] || 'unknown';
    
    return res.status(400).json({
      success: false,
      message: `Không tìm thấy ${field} với giá trị ${value}`,
      debug: {
        field,
        value,
        table: error.table,
        constraint: error.index,
      },
    });
  }
  
  if (error.name === 'SequelizeDatabaseError' && error.parent?.code === '22P02') {
    return res.status(400).json({
      success: false,
      message: 'Giá trị không hợp lệ cho trường dữ liệu',
      debug: {
        field: error.parent?.column,
        value: error.parameters?.[1],
        allowedValues: ['enrollment', 'quiz', 'review', 'payment', 'course_update', 'certificate', 'announcement', 'system', 'quiz_reminder', 'study_reminder', 'chapter_complete'],
      },
    });
  }
  
  // Default error response
  res.status(500).json({
    success: false,
    message: 'Lỗi máy chủ',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
  });
};

/**
 * Notification Controller - HTTP request handling
 */
class NotificationController {
  async getUserNotifications(req, res) {
    try {
      const result = await notificationService.getUserNotifications(req.user.id, req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getUnreadCount(req, res) {
    try {
      const result = await notificationService.getUserNotifications(req.user.id, { limit: 1 });
      res.json({ success: true, data: { unreadCount: result.unreadCount } });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async deleteAllNotifications(req, res) {
    try {
      const result = await notificationService.deleteAllNotifications(req.user.id);
      res.json(result);
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getById(req, res) {
    try {
      const { notificationId } = req.params;
      const result = await notificationService.getById(req.user.id, notificationId);
      if (!result.success) {
        return res.status(result.message === 'Không tìm thấy thông báo' ? 404 : 403).json(result);
      }
      res.json({ success: true, notification: result.notification });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async markAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const result = await notificationService.markAsRead(req.user.id, notificationId);
      if (!result.success) {
        return res.status(result.message === 'Không tìm thấy thông báo' ? 404 : 403).json(result);
      }
      res.json(result);
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async markAllAsRead(req, res) {
    try {
      const result = await notificationService.markAllAsRead(req.user.id);
      res.json(result);
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async deleteNotification(req, res) {
    try {
      const { notificationId } = req.params;
      const result = await notificationService.deleteNotification(req.user.id, notificationId);
      if (!result.success) {
        return res.status(result.message === 'Không tìm thấy thông báo' ? 404 : 403).json(result);
      }
      res.json(result);
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  // Admin methods
  async sendNotification(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { userIds, title, message, type } = req.body;
      
      console.log(`[DEBUG] Sending notification to users: ${userIds.join(', ')}`);
      console.log(`[DEBUG] Notification data:`, { title, message, type });
      
      const notifications = await Promise.all(
        userIds.map(userId => {
          console.log(`[DEBUG] Creating notification for userId: ${userId}`);
          return notificationService.createNotification({ userId, title, message, type });
        })
      );
      
      console.log(`[DEBUG] Successfully created ${notifications.length} notifications`);
      
      res.status(201).json({
        success: true,
        message: `Đã gửi thông báo đến ${userIds.length} người dùng`,
        data: { notifications },
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getAllNotifications(req, res) {
    try {
      const result = await notificationService.getUserNotifications(null, req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async triggerScheduler(req, res) {
    try {
      const result = await NotificationScheduler.scheduleQuizReminders();
      res.json({
        success: true,
        message: 'Đã kích hoạt scheduler',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new NotificationController();
