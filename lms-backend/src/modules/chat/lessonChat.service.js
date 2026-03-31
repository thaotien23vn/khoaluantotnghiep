const db = require('../../models/index');
const aiRag = require('../../services/aiRag.service');
const aiGateway = require('../../services/aiGateway.service');
const logger = require('../../utils/logger');
const { Op } = require('sequelize');
const { sequelize } = db;

const {
  LessonChat,
  LessonMessage,
  ChatParticipant,
  ChatEscalation,
  ChatAnalytics,
  Lecture,
  Course,
  User,
  Notification,
} = db.models;

/**
 * Lesson Chat Service
 * Handles public chat for lessons with AI + Teacher + Admin support
 */
// AI system user ID (reserved ID for AI assistant)
const AI_SYSTEM_USER_ID = 0;

class LessonChatService {
  /**
   * Get or create chat for a lesson
   */
  async getOrCreateChat(lessonId, courseId) {
    let chat = await LessonChat.findOne({
      where: { lessonId },
      include: [
        { model: LessonMessage, as: 'messages', limit: 50, order: [['created_at', 'DESC']] },
      ],
    });

    if (!chat) {
      chat = await LessonChat.create({
        lessonId,
        courseId,
        title: 'Lesson Discussion',
        isActive: true,
        aiEnabled: true,
      });
      logger.info('LESSON_CHAT_CREATED', { chatId: chat.id, lessonId, courseId });
    }

    return chat;
  }

  /**
   * Get chat history with pagination
   */
  async getChatHistory(chatId, options = {}) {
    const { limit = 50, offset = 0, includeReplies = true } = options;

    const messages = await LessonMessage.findAll({
      where: {
        chatId,
        parentId: null, // Top level messages only
        isDeleted: false,
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'avatar'],
        },
        ...(includeReplies ? [{
          model: LessonMessage,
          as: 'replies',
          where: { isDeleted: false },
          required: false,
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'name', 'avatar'],
            },
          ],
        }] : []),
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return messages.reverse(); // Oldest first
  }

  /**
   * Send message - main entry point
   */
  async sendMessage(chatId, userId, content, options = {}) {
    const { parentId = null, senderType = 'student' } = options;

    // Check if user is banned before sending
    if (senderType === 'student') {
      const participant = await ChatParticipant.findOne({
        where: { chatId, userId },
      });
      if (participant?.isBanned) {
        throw { status: 403, message: 'Bạn đã bị ban khỏi chat này' };
      }
    }

    // Save user message
    const message = await LessonMessage.create({
      chatId,
      senderId: userId,
      senderType,
      content,
      parentId,
      status: 'active',
    });

    logger.info('LESSON_MESSAGE_SENT', {
      messageId: message.id,
      chatId,
      userId,
      senderType,
    });

    // Record analytics - with await to catch errors
    try {
      await this.recordAnalytics(chatId, senderType);
    } catch (analyticsError) {
      logger.error('ANALYTICS_RECORD_FAILED', { chatId, senderType, error: analyticsError.message });
    }

    // If student question, try AI first
    if (senderType === 'student' && !parentId) {
      return this.handleStudentQuestion(chatId, message);
    }

    // Teacher/Admin reply - mark parent as answered
    if (parentId && (senderType === 'teacher' || senderType === 'admin')) {
      await this.markAsAnswered(parentId, senderType, userId);
    }

    return { message, aiResponse: null };
  }

  /**
   * Handle student question with AI + fallback
   */
  async handleStudentQuestion(chatId, message) {
    const chat = await LessonChat.findByPk(chatId, {
      include: [{ model: Course, as: 'course' }],
    });

    if (!chat.aiEnabled) {
      return this.escalateToTeacher(chatId, message.id, 'AI disabled');
    }

    // Get lesson content for RAG context (using question to retrieve relevant chunks)
    const context = await this.getLessonContext(chat.lessonId, message.content);

    // Try AI response
    const aiResult = await this.generateAiResponse(message.content, context);

    if (aiResult.confidence >= 0.7) {
      // AI confident enough - save response
      const aiMessage = await LessonMessage.create({
        chatId,
        senderId: AI_SYSTEM_USER_ID,
        senderType: 'ai',
        content: aiResult.content,
        parentId: message.id,
        status: 'active',
        answeredBy: 'ai',
        aiConfidence: aiResult.confidence,
        aiContext: { sources: aiResult.sources },
      });

      // Update original message
      await message.update({
        status: 'answered',
        answeredBy: 'ai',
      });

      logger.info('LESSON_AI_ANSWERED', {
        messageId: message.id,
        aiMessageId: aiMessage.id,
        confidence: aiResult.confidence,
      });

      // Record AI response analytics
      await this.recordAnalytics(chatId, 'ai');

      return {
        message,
        aiResponse: aiMessage,
        answeredBy: 'ai',
      };
    }

    // AI not confident - escalate
    const escalationResult = await this.escalateToTeacher(
      chatId,
      message.id,
      `AI confidence too low: ${aiResult.confidence}`,
      aiResult
    );

    // Record escalation analytics
    await this.recordAnalytics(chatId, 'escalation');

    return escalationResult;
  }

  /**
   * Generate AI response with RAG
   */
  async generateAiResponse(question, context) {
    try {
      const prompt = this.buildRagPrompt(question, context);
      
      const response = await aiGateway.generateText({
        system: 'Bạn là trợ giảng AI. Trả lời câu hỏi dựa trên nội dung bài học. Nếu không chắc chắn, hãy nói rõ.',
        prompt,
        maxOutputTokens: 800,
        temperature: 0.3,
        timeoutMs: 120000,
      });

      // Parse confidence from response or estimate
      const confidence = this.estimateConfidence(response.text, context);

      return {
        content: response.text,
        confidence,
        sources: context.sources || [],
      };
    } catch (err) {
      logger.error('LESSON_AI_FAILED', { error: err.message });
      
      // Return a structured error response that the UI can handle
      if (err.statusCode === 429 || err.code === 'GLOBAL_RATE_LIMITED' || err.code === 'ALL_KEYS_RATE_LIMITED') {
        return {
          content: 'Hệ thống AI hiện đang bận do quá tải (Rate Limit). Vui lòng thử lại sau 1-2 phút.',
          confidence: 0,
          sources: [],
          error: 'RATE_LIMIT'
        };
      }
      
      return {
        content: 'Xin lỗi, tôi gặp lỗi kỹ thuật khi xử lý câu hỏi này. Vui lòng thử lại sau.',
        confidence: 0,
        sources: [],
        error: 'GENERIC_ERROR'
      };
    }
  }

  /**
   * Build RAG context using AiChunk with embeddings
   */
  async getLessonContext(lessonId, question) {
    const lecture = await Lecture.findByPk(lessonId, {
      include: [{ model: db.models.Chapter, as: 'chapter', attributes: ['courseId'] }],
    });
    
    if (!lecture?.chapter?.courseId) {
      return { content: '', title: lecture?.title || '', sources: [] };
    }

    // Use RAG to get relevant chunks from AiChunk
    const topChunks = await aiRag.retrieveTopChunks({
      courseId: lecture.chapter.courseId,
      lectureId: lessonId,
      query: question,
      topK: 5,
    });

    if (!topChunks.length) {
      // Fallback to raw content if no chunks
      return {
        content: lecture?.content?.substring(0, 3000) || '',
        title: lecture?.title || '',
        sources: [{ type: 'lecture', id: lessonId }],
      };
    }

    // Build context from relevant chunks
    const contextParts = topChunks.map((chunk, idx) => `[${idx + 1}] ${chunk.text}`);
    
    return {
      content: contextParts.join('\n\n'),
      title: lecture?.title || '',
      sources: topChunks.map(c => ({ type: 'chunk', id: c.id, lectureId: c.lectureId, score: c.score })),
    };
  }

  /**
   * Build prompt for AI
   */
  buildRagPrompt(question, context) {
    return `Bài học: ${context.title}

Nội dung bài học:
${context.content?.substring(0, 3000) || 'Không có nội dung'}

Câu hỏi: ${question}

Trả lời dựa trên nội dung bài học trên. Nếu không có thông tin, hãy nói "Tôi không chắc chắn". Chỉ trả lời nếu bạn confident > 70%.`;
  }

  /**
   * Estimate AI confidence
   */
  estimateConfidence(response, context) {
    // Simple heuristic - can be improved
    const hasUncertainty = /không chắc|không biết|không có thông tin|không tìm thấy/i.test(response);
    const isRelevant = context.content && response.length > 50;
    
    if (hasUncertainty) return 0.3;
    if (!isRelevant) return 0.5;
    return 0.85;
  }

  /**
   * Escalate to teacher
   */
  async escalateToTeacher(chatId, messageId, reason, aiResult = null) {
    const chat = await LessonChat.findByPk(chatId, {
      include: [{ model: Course, as: 'course' }],
    });

    // Create escalation record
    const escalation = await ChatEscalation.create({
      messageId,
      chatId,
      status: 'ai_failed',
      aiConfidence: aiResult?.confidence || 0,
      escalationReason: reason,
    });

    // Find course teacher
    const course = await Course.findByPk(chat.courseId);
    const teacher = await User.findByPk(course?.createdBy);

    if (teacher) {
      // Notify teacher
      await Notification.create({
        userId: teacher.id,
        type: 'system',
        title: 'Câu hỏi cần trả lời',
        message: `Học viên đã hỏi trong bài học và cần sự hỗ trợ của bạn.`,
        payload: {
          chatId,
          messageId,
          escalationId: escalation.id,
          type: 'chat_escalation',
        },
      });

      await escalation.update({
        status: 'notified_teacher',
        teacherNotifiedAt: new Date(),
      });

      logger.info('LESSON_ESCALATED_TEACHER', {
        escalationId: escalation.id,
        teacherId: teacher.id,
        messageId,
      });
    }

    return {
      message: await LessonMessage.findByPk(messageId),
      aiResponse: null,
      answeredBy: null,
      escalation: {
        id: escalation.id,
        status: 'needs_teacher',
        reason,
      },
    };
  }

  /**
   * Mark message as answered
   */
  async markAsAnswered(messageId, answeredBy, userId) {
    await LessonMessage.update(
      { status: 'answered', answeredBy },
      { where: { id: messageId } }
    );

    // Update escalation if exists
    const escalation = await ChatEscalation.findOne({
      where: { messageId },
    });

    if (escalation) {
      await escalation.update({
        status: 'answered',
        answeredAt: new Date(),
        answeredBy: userId,
      });

      // Record resolved analytics
      await this.recordAnalytics(escalation.chatId, 'resolved');
    }
  }

  /**
   * Join chat as participant
   */
  async joinChat(chatId, userId, role) {
    const [participant, created] = await ChatParticipant.findOrCreate({
      where: { chatId, userId },
      defaults: {
        chatId,
        userId,
        role,
        joinedAt: new Date(),
      },
    });

    if (!created) {
      // Update lastReadAt to show activity
      await participant.update({ lastReadAt: new Date() });
    }

    return participant;
  }

  /**
   * Mark messages as read for participant
   */
  async markMessagesAsRead(chatId, userId, lastMessageId) {
    const participant = await ChatParticipant.findOne({
      where: { chatId, userId },
    });

    if (!participant) {
      throw { status: 404, message: 'Participant not found' };
    }

    await participant.update({
      lastReadMessageId: lastMessageId,
      lastReadAt: new Date(),
    });

    logger.info('LESSON_MESSAGES_READ', {
      chatId,
      userId,
      lastReadMessageId: lastMessageId,
    });

    return participant;
  }

  /**
   * Get participant read status
   */
  async getPendingEscalations(userId, role) {
    const where = { status: { [Op.in]: ['ai_failed', 'notified_teacher'] } };
    
    if (role === 'teacher') {
      // Only show for courses owned by this teacher
      const courses = await Course.findAll({
        where: { createdBy: userId },
        attributes: ['id'],
      });
      const courseIds = courses.map(c => c.id);
      
      const chats = await LessonChat.findAll({
        where: { courseId: { [Op.in]: courseIds } },
        attributes: ['id'],
      });
      const chatIds = chats.map(c => c.id);
      
      where.chatId = { [Op.in]: chatIds };
    }

    return await ChatEscalation.findAll({
      where,
      include: [
        {
          model: LessonMessage,
          as: 'message',
          include: [
            { model: User, as: 'sender', attributes: ['id', 'name', 'avatar'] },
          ],
        },
        {
          model: LessonChat,
          as: 'chat',
          include: [{ model: Course, as: 'course', attributes: ['id', 'title'] }],
        },
      ],
      order: [['created_at', 'ASC']],
    });
  }

  /**
   * Admin escalation check - called by cron job
   */
  async checkAdminEscalation() {
    const ESCALATION_TIMEOUT_HOURS = 24;
    const cutoffTime = new Date(Date.now() - ESCALATION_TIMEOUT_HOURS * 60 * 60 * 1000);

    const pendingEscalations = await ChatEscalation.findAll({
      where: {
        status: 'notified_teacher',
        teacherNotifiedAt: { [Op.lt]: cutoffTime },
      },
      include: [{ model: LessonChat, as: 'chat' }],
    });

    for (const escalation of pendingEscalations) {
      // Find admin users
      const admins = await User.findAll({
        where: { role: 'admin' },
        attributes: ['id'],
      });

      // Notify admins
      for (const admin of admins) {
        await Notification.create({
          userId: admin.id,
          type: 'system',
          title: 'Câu hỏi cần xử lý khẩn',
          message: `Giảng viên chưa trả lời sau ${ESCALATION_TIMEOUT_HOURS}h. Cần admin hỗ trợ.`,
          payload: {
            chatId: escalation.chatId,
            messageId: escalation.messageId,
            escalationId: escalation.id,
            type: 'chat_escalation_admin',
          },
        });
      }

      await escalation.update({
        status: 'notified_admin',
        adminNotifiedAt: new Date(),
      });

      logger.info('LESSON_ESCALATED_ADMIN', {
        escalationId: escalation.id,
        chatId: escalation.chatId,
      });
    }

    return pendingEscalations.length;
  }

  /**
   * ==================== PERMISSION METHODS ====================
   */

  /**
   * Check if user has permission for an action
   * @param {string} action - Action to check
   * @param {string} userRole - User role
   * @param {number} userId - User ID
   * @param {Object} chat - Chat object
   * @returns {boolean}
   */
  hasPermission(action, userRole, userId, chat) {
    const permissions = {
      // Student: view, send, reply
      student: ['view', 'send', 'reply'],
      // Teacher: view, send, reply, pin, delete, mute, analytics
      teacher: ['view', 'send', 'reply', 'pin', 'delete', 'mute', 'analytics'],
      // Admin: all permissions
      admin: ['view', 'send', 'reply', 'pin', 'delete', 'mute', 'ban', 'clear_history', 'enable_disable', 'analytics'],
    };

    const rolePermissions = permissions[userRole] || [];
    
    // Teacher can only manage their own course chats
    if (userRole === 'teacher' && chat && chat.course) {
      if (chat.course.createdBy !== userId) {
        return action === 'view' ? rolePermissions.includes(action) : false;
      }
    }

    return rolePermissions.includes(action);
  }

  /**
   * Pin/Unpin a message (Teacher/Admin only)
   */
  async pinMessage(messageId, userId, userRole) {
    const message = await LessonMessage.findByPk(messageId, {
      include: [{ model: LessonChat, as: 'chat', include: [{ model: Course, as: 'course' }] }],
    });

    if (!message) {
      throw { status: 404, message: 'Không tìm thấy tin nhắn' };
    }

    if (!this.hasPermission('pin', userRole, userId, message.chat)) {
      throw { status: 403, message: 'Bạn không có quyền pin tin nhắn' };
    }

    const isPinned = !message.isPinned;
    await message.update({
      isPinned,
      pinnedBy: isPinned ? userId : null,
      pinnedAt: isPinned ? new Date() : null,
    });

    logger.info('MESSAGE_PINNED', { messageId, userId, isPinned });

    return {
      message: isPinned ? 'Đã pin tin nhắn' : 'Đã bỏ pin tin nhắn',
      isPinned,
    };
  }

  /**
   * Edit a message (Student can edit own message within 10 minutes, Teacher/Admin can edit any)
   */
  async editMessage(messageId, userId, userRole, newContent) {
    const message = await LessonMessage.findByPk(messageId, {
      include: [{ model: LessonChat, as: 'chat', include: [{ model: Course, as: 'course' }] }],
    });

    if (!message) {
      throw { status: 404, message: 'Không tìm thấy tin nhắn' };
    }

    if (message.isDeleted) {
      throw { status: 400, message: 'Không thể sửa tin nhắn đã xóa' };
    }

    // Check permissions
    const isOwner = message.senderId === userId;
    const canEditAny = this.hasPermission('delete', userRole, userId, message.chat); // Teacher/Admin can edit any

    if (userRole === 'student') {
      // Student can only edit own messages within 10 minutes
      if (!isOwner) {
        throw { status: 403, message: 'Bạn chỉ có thể sửa tin nhắn của mình' };
      }
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      const TEN_MINUTES = 10 * 60 * 1000;
      if (messageAge > TEN_MINUTES) {
        throw { status: 403, message: 'Chỉ có thể sửa tin nhắn trong vòng 10 phút' };
      }
    } else if (!canEditAny) {
      throw { status: 403, message: 'Bạn không có quyền sửa tin nhắn này' };
    }

    await message.update({
      content: newContent,
      editedAt: new Date(),
    });

    logger.info('MESSAGE_EDITED', { messageId, userId, userRole });

    return {
      message: 'Đã sửa tin nhắn',
      editedAt: message.editedAt,
    };
  }

  /**
   * Delete a message (Teacher/Admin only)
   */
  async deleteMessage(messageId, userId, userRole) {
    const message = await LessonMessage.findByPk(messageId, {
      include: [{ model: LessonChat, as: 'chat', include: [{ model: Course, as: 'course' }] }],
    });

    if (!message) {
      throw { status: 404, message: 'Không tìm thấy tin nhắn' };
    }

    // Check permissions
    const isOwner = message.senderId === userId;
    const canDeleteAny = this.hasPermission('delete', userRole, userId, message.chat); // Teacher/Admin

    if (userRole === 'student') {
      // Student can only delete own messages within 10 minutes
      if (!isOwner) {
        throw { status: 403, message: 'Bạn chỉ có thể xóa tin nhắn của mình' };
      }
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      const TEN_MINUTES = 10 * 60 * 1000;
      if (messageAge > TEN_MINUTES) {
        throw { status: 403, message: 'Chỉ có thể xóa tin nhắn trong vòng 10 phút' };
      }
    } else if (!canDeleteAny) {
      throw { status: 403, message: 'Bạn không có quyền xóa tin nhắn này' };
    }

    await message.update({
      isDeleted: true,
      deletedBy: userId,
      deletedAt: new Date(),
    });

    logger.info('MESSAGE_DELETED', { messageId, userId });

    return { message: 'Đã xóa tin nhắn' };
  }

  /**
   * Mute/Unmute chat (Teacher/Admin only)
   */
  async muteChat(chatId, userId, userRole, durationMinutes = null) {
    const chat = await LessonChat.findByPk(chatId, {
      include: [{ model: Course, as: 'course' }],
    });

    if (!chat) {
      throw { status: 404, message: 'Không tìm thấy chat' };
    }

    if (!this.hasPermission('mute', userRole, userId, chat)) {
      throw { status: 403, message: 'Bạn không có quyền khóa chat' };
    }

    const mutedUntil = durationMinutes ? new Date(Date.now() + durationMinutes * 60000) : null;
    await chat.update({ mutedUntil });

    logger.info('CHAT_MUTED', { chatId, userId, mutedUntil });

    return {
      message: durationMinutes ? `Đã khóa chat trong ${durationMinutes} phút` : 'Đã mở khóa chat',
      mutedUntil,
    };
  }

  /**
   * Ban/Unban user from chat (Admin only)
   */
  async banUser(chatId, targetUserId, userId, userRole, reason = null) {
    const chat = await LessonChat.findByPk(chatId, {
      include: [{ model: Course, as: 'course' }],
    });

    if (!chat) {
      throw { status: 404, message: 'Không tìm thấy chat' };
    }

    if (!this.hasPermission('ban', userRole, userId, chat)) {
      throw { status: 403, message: 'Chỉ admin có quyền ban user' };
    }

    const participant = await ChatParticipant.findOne({
      where: { chatId, userId: targetUserId },
    });

    if (!participant) {
      throw { status: 404, message: 'User không tham gia chat này' };
    }

    const isBanned = !participant.isBanned;
    await participant.update({
      isBanned,
      bannedAt: isBanned ? new Date() : null,
      bannedBy: isBanned ? userId : null,
      banReason: isBanned ? reason : null,
    });

    logger.info(isBanned ? 'USER_BANNED' : 'USER_UNBANNED', {
      chatId,
      targetUserId,
      userId,
      reason,
    });

    return {
      message: isBanned ? 'Đã ban user' : 'Đã unban user',
      isBanned,
    };
  }

  /**
   * Enable/Disable chat (Admin only)
   */
  async toggleChat(chatId, userId, userRole) {
    const chat = await LessonChat.findByPk(chatId, {
      include: [{ model: Course, as: 'course' }],
    });

    if (!chat) {
      throw { status: 404, message: 'Không tìm thấy chat' };
    }

    if (!this.hasPermission('enable_disable', userRole, userId, chat)) {
      throw { status: 403, message: 'Chỉ admin có quyền bật/tắt chat' };
    }

    const isEnabled = !chat.isEnabled;
    await chat.update({ isEnabled });

    logger.info(isEnabled ? 'CHAT_ENABLED' : 'CHAT_DISABLED', { chatId, userId });

    return {
      message: isEnabled ? 'Đã bật chat' : 'Đã tắt chat',
      isEnabled,
    };
  }

  /**
   * Clear chat history (Admin only)
   */
  async clearHistory(chatId, userId, userRole) {
    const chat = await LessonChat.findByPk(chatId, {
      include: [{ model: Course, as: 'course' }],
    });

    if (!chat) {
      throw { status: 404, message: 'Không tìm thấy chat' };
    }

    if (!this.hasPermission('clear_history', userRole, userId, chat)) {
      throw { status: 403, message: 'Chỉ admin có quyền xóa lịch sử chat' };
    }

    await LessonMessage.destroy({ where: { chatId } });
    await chat.update({
      deletedAt: new Date(),
      deletedBy: userId,
    });

    logger.info('CHAT_HISTORY_CLEARED', { chatId, userId });

    return { message: 'Đã xóa toàn bộ lịch sử chat' };
  }

  /**
   * Get chat analytics (Teacher/Admin only)
   */
  async getAnalytics(chatId, userId, userRole, startDate = null, endDate = null) {
    const chat = await LessonChat.findByPk(chatId, {
      include: [{ model: Course, as: 'course' }],
    });

    if (!chat) {
      throw { status: 404, message: 'Không tìm thấy chat' };
    }

    if (!this.hasPermission('analytics', userRole, userId, chat)) {
      throw { status: 403, message: 'Bạn không có quyền xem analytics' };
    }

    const where = { chatId };
    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    }

    const analytics = await ChatAnalytics.findAll({
      where,
      order: [['date', 'DESC']],
    });

    const summary = await ChatAnalytics.findOne({
      where: { chatId },
      attributes: [
        [sequelize.fn('SUM', sequelize.col('total_messages')), 'totalMessages'],
        [sequelize.fn('SUM', sequelize.col('student_messages')), 'studentMessages'],
        [sequelize.fn('SUM', sequelize.col('teacher_messages')), 'teacherMessages'],
        [sequelize.fn('SUM', sequelize.col('admin_messages')), 'adminMessages'],
        [sequelize.fn('SUM', sequelize.col('ai_responses')), 'aiResponses'],
        [sequelize.fn('SUM', sequelize.col('escalations')), 'escalations'],
        [sequelize.fn('SUM', sequelize.col('resolved_questions')), 'resolvedQuestions'],
      ],
    });

    // Normalize summary values (convert null to 0)
    const normalize = (val) => val === null ? 0 : Number(val);
    const summaryData = summary?.dataValues || {};
    const normalizedSummary = {
      totalMessages: normalize(summaryData.totalMessages),
      studentMessages: normalize(summaryData.studentMessages),
      teacherMessages: normalize(summaryData.teacherMessages),
      adminMessages: normalize(summaryData.adminMessages),
      aiResponses: normalize(summaryData.aiResponses),
      escalations: normalize(summaryData.escalations),
      resolvedQuestions: normalize(summaryData.resolvedQuestions),
    };

    return {
      daily: analytics,
      summary: normalizedSummary,
    };
  }

  /**
   * Record analytics event
   */
  async recordAnalytics(chatId, type) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      logger.info('RECORD_ANALYTICS_START', { chatId, type, date: today });
      
      const [analytics, created] = await ChatAnalytics.findOrCreate({
        where: { chatId, date: today },
        defaults: { chatId, date: today },
      });

      logger.info('RECORD_ANALYTICS_DB', { chatId, type, created, analyticsId: analytics.id });

      const fieldMap = {
        student: 'studentMessages',
        teacher: 'teacherMessages',
        admin: 'adminMessages',
        ai: 'aiResponses',
        escalation: 'escalations',
        resolved: 'resolvedQuestions',
      };

      const field = fieldMap[type];
      if (field) {
        await analytics.increment(field);
        logger.info('RECORD_ANALYTICS_INCREMENT', { chatId, type, field });
      }
      await analytics.increment('totalMessages');

      return analytics;
    } catch (error) {
      logger.error('RECORD_ANALYTICS_FAILED', { chatId, type, error: error.message });
      return null;
    }
  }

  /**
   * Check if chat is available for user
   */
  async checkChatAccess(chatId, userId, userRole) {
    const chat = await LessonChat.findByPk(chatId, {
      include: [
        { model: Course, as: 'course' },
        { model: ChatParticipant, as: 'participants', where: { userId }, required: false },
      ],
    });

    if (!chat) {
      throw { status: 404, message: 'Không tìm thấy chat' };
    }

    // Check if chat is enabled
    if (!chat.isEnabled) {
      throw { status: 403, message: 'Chat đã bị tắt' };
    }

    // Check if chat is muted
    if (chat.mutedUntil && new Date() < new Date(chat.mutedUntil)) {
      throw { status: 403, message: 'Chat đang bị khóa tạm thời' };
    }

    // Check if user is banned
    const participant = chat.participants?.[0];
    if (participant?.isBanned) {
      throw { status: 403, message: 'Bạn đã bị ban khỏi chat này' };
    }

    return { chat, participant };
  }
}

module.exports = new LessonChatService();
