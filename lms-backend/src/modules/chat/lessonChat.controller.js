const lessonChatService = require('../services/lessonChat.service');
const logger = require('../utils/logger');

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
}

module.exports = new LessonChatController();
