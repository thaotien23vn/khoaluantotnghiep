const db = require('../../models');
const { emitNotification } = require('../../socket');

const { Notification } = db.models;

/**
 * Notification Service - Business logic for notification operations
 */
class NotificationService {
  async getUserNotifications(userId, query) {
    const { page = 1, limit = 20, type, read } = query;
    const offset = (page - 1) * limit;

    const whereClause = { userId };
    if (type) whereClause.type = type;
    if (read !== undefined) whereClause.read = read === 'true';

    const { count, rows: notifications } = await Notification.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const unreadCount = await Notification.count({
      where: { userId, read: false },
    });

    return {
      notifications,
      unreadCount,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async deleteAllNotifications(userId) {
    await Notification.destroy({ where: { userId } });
    return { success: true };
  }

  async markAsRead(userId, notificationId) {
    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      return { success: false, message: 'Không tìm thấy thông báo' };
    }
    if (notification.userId !== userId) {
      return { success: false, message: 'Không có quyền' };
    }

    await notification.update({ read: true });
    return { success: true, message: 'Đã đánh dấu đã đọc' };
  }

  async markAllAsRead(userId) {
    await Notification.update(
      { read: true },
      { where: { userId, read: false } }
    );
    return { success: true, message: 'Đã đánh dấu tất cả là đã đọc' };
  }

  async createNotification(data) {
    const { userId, title, message, type, relatedId, relatedType } = data;
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      relatedId,
      relatedType,
      read: false,
    });

    // Emit socket event if available
    try {
      emitNotification(userId, notification);
    } catch {
      // Socket may not be initialized in test environment
    }

    return { notification };
  }

  async deleteNotification(userId, notificationId) {
    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      return { success: false, message: 'Không tìm thấy thông báo' };
    }
    if (notification.userId !== userId) {
      return { success: false, message: 'Không có quyền' };
    }

    await notification.destroy();
    return { success: true, message: 'Đã xóa thông báo' };
  }
}

module.exports = new NotificationService();
