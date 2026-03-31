const courseChatService = require('./courseChat.service');
const logger = require('../../utils/logger');

/**
 * Course Chat Controller
 */
class CourseChatController {
  /**
   * Get or create chat for course
   * GET /student/courses/:courseId/chat
   */
  async getChat(req, res, next) {
    try {
      const { courseId } = req.params;
      const userId = req.user?.id;

      const chat = await courseChatService.getOrCreateChat(courseId);

      if (userId) {
        await courseChatService.joinChat(chat.id, userId, req.user.role);
      }

      const messages = await courseChatService.getChatHistory(chat.id, {
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
      });

      res.json({
        success: true,
        data: {
          chat: {
            id: chat.id,
            courseId: chat.courseId,
            title: chat.title,
            aiEnabled: chat.aiEnabled,
            isEnabled: chat.isEnabled,
            isActive: chat.isActive,
          },
          messages,
        },
      });
    } catch (err) {
      logger.error('GET_COURSE_CHAT_ERROR', { error: err.message, courseId: req.params.courseId });
      next(err);
    }
  }

  /**
   * Send message
   * POST /student/course-chat/:chatId/messages
   */
  async sendMessage(req, res, next) {
    try {
      const { chatId } = req.params;
      const { content, parentId } = req.body;
      const userId = req.user?.id;
      const senderType = req.user?.role === 'admin' ? 'admin' :
                        req.user?.role === 'teacher' ? 'teacher' : 'student';

      const result = await courseChatService.sendMessage(chatId, userId, content, {
        parentId,
        senderType,
      });

      res.json({
        success: true,
        data: {
          message: result.message,
          aiResponse: result.aiResponse,
          answeredBy: result.answeredBy,
          escalation: result.escalation,
        },
      });
    } catch (err) {
      logger.error('SEND_COURSE_MESSAGE_ERROR', { error: err.message, chatId: req.params.chatId });
      next(err);
    }
  }

  /**
   * Get pending escalations (teacher/admin)
   * GET /teacher/course-chat/escalations
   * GET /admin/course-chat/escalations
   */
  async getEscalations(req, res, next) {
    try {
      const userId = req.user?.id;
      const role = req.user?.role;

      const escalations = await courseChatService.getPendingEscalations(userId, role);

      res.json({
        success: true,
        data: escalations,
      });
    } catch (err) {
      logger.error('GET_COURSE_ESCALATIONS_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * Reply to message (teacher/admin)
   * POST /teacher/course-chat/:chatId/reply
   * POST /admin/course-chat/:chatId/reply
   */
  async reply(req, res, next) {
    try {
      const { chatId } = req.params;
      const { content, parentId } = req.body;
      const userId = req.user?.id;
      const senderType = req.user?.role;

      const result = await courseChatService.sendMessage(chatId, userId, content, {
        parentId,
        senderType,
      });

      res.json({
        success: true,
        data: {
          message: result.message,
        },
      });
    } catch (err) {
      logger.error('COURSE_REPLY_ERROR', { error: err.message });
      next(err);
    }
  }

  // ==================== PERMISSION CONTROLLERS ====================

  async pinMessage(req, res, next) {
    try {
      const { messageId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await courseChatService.pinMessage(messageId, userId, userRole);

      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('COURSE_PIN_MESSAGE_ERROR', { error: err.message });
      next(err);
    }
  }

  async editMessage(req, res, next) {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await courseChatService.editMessage(messageId, userId, userRole, content);

      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('COURSE_EDIT_MESSAGE_ERROR', { error: err.message });
      next(err);
    }
  }

  async deleteMessage(req, res, next) {
    try {
      const { messageId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await courseChatService.deleteMessage(messageId, userId, userRole);

      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('COURSE_DELETE_MESSAGE_ERROR', { error: err.message });
      next(err);
    }
  }

  async muteChat(req, res, next) {
    try {
      const { chatId } = req.params;
      const { durationMinutes } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await courseChatService.muteChat(chatId, userId, userRole, durationMinutes);

      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('COURSE_MUTE_CHAT_ERROR', { error: err.message });
      next(err);
    }
  }

  async banUser(req, res, next) {
    try {
      const { chatId, userId: targetUserId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await courseChatService.banUser(chatId, targetUserId, userId, userRole, reason);

      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('COURSE_BAN_USER_ERROR', { error: err.message });
      next(err);
    }
  }

  async toggleChat(req, res, next) {
    try {
      const { chatId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await courseChatService.toggleChat(chatId, userId, userRole);

      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('COURSE_TOGGLE_CHAT_ERROR', { error: err.message });
      next(err);
    }
  }

  async clearHistory(req, res, next) {
    try {
      const { chatId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await courseChatService.clearHistory(chatId, userId, userRole);

      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('COURSE_CLEAR_HISTORY_ERROR', { error: err.message });
      next(err);
    }
  }

  async getAnalytics(req, res, next) {
    try {
      const { chatId } = req.params;
      const { startDate, endDate } = req.query;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await courseChatService.getAnalytics(chatId, userId, userRole, startDate, endDate);

      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('COURSE_GET_ANALYTICS_ERROR', { error: err.message });
      next(err);
    }
  }
}

module.exports = new CourseChatController();
