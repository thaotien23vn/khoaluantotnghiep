const lessonChatService = require('./lessonChat.service');
const logger = require('../../utils/logger');
const { getIO } = require('../../socket');

/**
 * Emit message to chat room via socket
 */
function emitChatMessage(chatId, event, message) {
  try {
    const io = getIO();
    const roomName = `lesson_${chatId}`;
    io.to(roomName).emit(event, message);
  } catch (err) {
    logger.error('SOCKET_EMIT_ERROR', { error: err.message, chatId, event });
  }
}

/**
 * Lesson Chat Controller
 */
class LessonChatController {
  /**
   * Get or create chat for lesson
   * GET /student/lessons/:lessonId/chat
   */
  async getChat(req, res, next) {
    try {
      const { lessonId } = req.params;
      const { courseId } = req.query;
      const userId = req.user?.id;

      const chat = await lessonChatService.getOrCreateChat(lessonId, courseId);
      
      // Join as participant
      if (userId) {
        await lessonChatService.joinChat(chat.id, userId, req.user.role);
      }

      // Get messages
      const messages = await lessonChatService.getChatHistory(chat.id, {
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
      });

      res.json({
        success: true,
        data: {
          chat: {
            id: chat.id,
            lessonId: chat.lessonId,
            courseId: chat.courseId,
            aiEnabled: chat.aiEnabled,
            isActive: chat.isActive,
          },
          messages,
        },
      });
    } catch (err) {
      logger.error('GET_CHAT_ERROR', { error: err.message, lessonId: req.params.lessonId });
      next(err);
    }
  }

  /**
   * Send message
   * POST /student/chat/:chatId/messages
   */
  async sendMessage(req, res, next) {
    try {
      const { chatId } = req.params;
      const { content, parentId } = req.body;
      const userId = req.user?.id;
      const senderType = req.user?.role === 'admin' ? 'admin' : 
                        req.user?.role === 'teacher' ? 'teacher' : 'student';

      const result = await lessonChatService.sendMessage(chatId, userId, content, {
        parentId,
        senderType,
      });

      // Emit user message via socket
      emitChatMessage(chatId, 'new_message', result.message);

      // Emit AI response if available
      if (result.aiResponse) {
        emitChatMessage(chatId, 'new_message', result.aiResponse);
      }

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
      logger.error('SEND_MESSAGE_ERROR', { error: err.message, chatId: req.params.chatId });
      next(err);
    }
  }

  /**
   * Get pending escalations (teacher/admin)
   * GET /teacher/chat/escalations
   * GET /admin/chat/escalations
   */
  async getEscalations(req, res, next) {
    try {
      const userId = req.user?.id;
      const role = req.user?.role;

      const escalations = await lessonChatService.getPendingEscalations(userId, role);

      res.json({
        success: true,
        data: escalations,
      });
    } catch (err) {
      logger.error('GET_ESCALATIONS_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * Reply to message (teacher/admin)
   * POST /teacher/chat/:chatId/reply
   */
  async reply(req, res, next) {
    try {
      const { chatId } = req.params;
      const { content, parentId } = req.body;
      const userId = req.user?.id;
      const senderType = req.user?.role;

      const result = await lessonChatService.sendMessage(chatId, userId, content, {
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
      logger.error('REPLY_ERROR', { error: err.message });
      next(err);
    }
  }

  // ==================== PERMISSION CONTROLLERS ====================

  /**
   * Pin/Unpin message (Teacher/Admin)
   * POST /teacher/chat/:messageId/pin
   * POST /admin/chat/:messageId/pin
   */
  async pinMessage(req, res, next) {
    try {
      const { messageId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await lessonChatService.pinMessage(messageId, userId, userRole);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('PIN_MESSAGE_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * Edit message (Student own within 10 min, Teacher/Admin any)
   * PUT /api/chat/messages/:messageId
   */
  async editMessage(req, res, next) {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await lessonChatService.editMessage(messageId, userId, userRole, content);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('EDIT_MESSAGE_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * Delete message (Student own, Teacher/Admin any)
   * DELETE /api/chat/messages/:messageId
   */
  async deleteMessage(req, res, next) {
    try {
      const { messageId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await lessonChatService.deleteMessage(messageId, userId, userRole);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('DELETE_MESSAGE_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * Mute/Unmute chat (Teacher/Admin)
   * POST /teacher/chat/:chatId/mute
   * POST /admin/chat/:chatId/mute
   */
  async muteChat(req, res, next) {
    try {
      const { chatId } = req.params;
      const { durationMinutes } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await lessonChatService.muteChat(chatId, userId, userRole, durationMinutes);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('MUTE_CHAT_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * Ban/Unban user (Admin only)
   * POST /admin/chat/:chatId/ban/:userId
   */
  async banUser(req, res, next) {
    try {
      const { chatId, userId: targetUserId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await lessonChatService.banUser(chatId, targetUserId, userId, userRole, reason);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('BAN_USER_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * Enable/Disable chat (Admin only)
   * POST /admin/chat/:chatId/toggle
   */
  async toggleChat(req, res, next) {
    try {
      const { chatId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await lessonChatService.toggleChat(chatId, userId, userRole);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('TOGGLE_CHAT_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * Clear chat history (Admin only)
   * DELETE /admin/chat/:chatId/history
   */
  async clearHistory(req, res, next) {
    try {
      const { chatId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await lessonChatService.clearHistory(chatId, userId, userRole);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('CLEAR_HISTORY_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * Get chat analytics (Teacher/Admin)
   * GET /teacher/chat/:chatId/analytics
   * GET /admin/chat/:chatId/analytics
   */
  async getAnalytics(req, res, next) {
    try {
      const { chatId } = req.params;
      const { startDate, endDate } = req.query;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await lessonChatService.getAnalytics(chatId, userId, userRole, startDate, endDate);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('GET_ANALYTICS_ERROR', { error: err.message });
      next(err);
    }
  }
}

module.exports = new LessonChatController();
