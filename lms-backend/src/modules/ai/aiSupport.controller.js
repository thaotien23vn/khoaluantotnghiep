const aiSupportService = require('./aiSupport.service');
const logger = require('../../utils/logger');

class AiSupportController {
  /**
   * Get or create support conversation
   */
  async getOrCreateChat(req, res, next) {
    try {
      const userId = req.user.id;
      const { sessionId, context } = req.body;

      const result = await aiSupportService.getOrCreateConversation(userId, {
        sessionId,
        context,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('AI_SUPPORT_GET_CHAT_FAILED', {
        userId: req.user?.id,
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * Get chat history
   */
  async getChatHistory(req, res, next) {
    try {
      const userId = req.user.id;
      const { conversationId } = req.params;
      const { limit, offset } = req.query;

      const result = await aiSupportService.getChatHistory(conversationId, userId, {
        limit,
        offset,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('AI_SUPPORT_GET_HISTORY_FAILED', {
        userId: req.user?.id,
        conversationId: req.params?.conversationId,
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * Send message
   */
  async sendMessage(req, res, next) {
    try {
      const userId = req.user.id;
      const { content, conversationId, context, attachments } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Nội dung tin nhắn không được để trống',
        });
      }

      const result = await aiSupportService.sendMessage(userId, content, {
        conversationId,
        context,
        attachments,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('AI_SUPPORT_SEND_MESSAGE_FAILED', {
        userId: req.user?.id,
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * Get user's conversations list
   */
  async getConversations(req, res, next) {
    try {
      const userId = req.user.id;
      const { page, limit } = req.query;

      const result = await aiSupportService.getUserConversations(userId, {
        page,
        limit,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('AI_SUPPORT_GET_CONVERSATIONS_FAILED', {
        userId: req.user?.id,
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * Clear conversation history
   */
  async clearConversation(req, res, next) {
    try {
      const userId = req.user.id;
      const { conversationId } = req.params;

      const result = await aiSupportService.clearConversation(userId, conversationId);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('AI_SUPPORT_CLEAR_CONVERSATION_FAILED', {
        userId: req.user?.id,
        conversationId: req.params?.conversationId,
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(req, res, next) {
    try {
      const userId = req.user.id;
      const { conversationId } = req.params;

      const result = await aiSupportService.deleteConversation(userId, conversationId);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('AI_SUPPORT_DELETE_CONVERSATION_FAILED', {
        userId: req.user?.id,
        conversationId: req.params?.conversationId,
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * Get quick suggestions
   */
  async getQuickSuggestions(req, res, next) {
    try {
      const userId = req.user.id;
      const { currentPage } = req.query;

      const result = await aiSupportService.getQuickSuggestions(userId, { currentPage });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('AI_SUPPORT_GET_SUGGESTIONS_FAILED', {
        userId: req.user?.id,
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * Handle quick action
   */
  async handleQuickAction(req, res, next) {
    try {
      const userId = req.user.id;
      const { action } = req.body;
      const context = req.body.context || {};

      if (!action) {
        return res.status(400).json({
          success: false,
          message: 'Action là bắt buộc',
        });
      }

      const result = await aiSupportService.handleQuickAction(userId, action, context);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('AI_SUPPORT_HANDLE_ACTION_FAILED', {
        userId: req.user?.id,
        action: req.body?.action,
        error: error.message,
      });
      next(error);
    }
  }

  /**
   * Get system statistics (admin only)
   */
  async getSystemStats(req, res, next) {
    try {
      const { days } = req.query;

      const result = await aiSupportService.getSystemStats({ days });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('AI_SUPPORT_GET_STATS_FAILED', {
        error: error.message,
      });
      next(error);
    }
  }
}

module.exports = new AiSupportController();
