const db = require('../../models/index');
const aiGateway = require('../../services/aiGateway.service');
const logger = require('../../utils/logger');
const { Op } = require('sequelize');
const { sequelize } = db;

const {
  CourseChat,
  CourseMessage,
  CourseChatParticipant,
  CourseChatEscalation,
  CourseChatAnalytics,
  Course,
  User,
  Notification,
  AiChunk,
} = db.models;

const AI_SYSTEM_USER_ID = 0;

/**
 * Course Chat Service
 * Handles public chat for courses with AI RAG from all course chunks
 */
class CourseChatService {
  /**
   * Get or create chat for course
   */
  async getOrCreateChat(courseId) {
    let chat = await CourseChat.findOne({
      where: { courseId },
      include: [{ model: Course, as: 'course' }],
    });

    if (!chat) {
      const course = await Course.findByPk(courseId);
      if (!course) {
        throw { status: 404, message: 'Không tìm thấy khóa học' };
      }

      chat = await CourseChat.create({
        courseId,
        title: `Thảo luận: ${course.title}`,
        isActive: true,
        aiEnabled: true,
        isEnabled: true,
      });

      // Auto-join course teacher as participant
      await this.joinChat(chat.id, course.createdBy, 'teacher');

      logger.info('COURSE_CHAT_CREATED', { chatId: chat.id, courseId });
    }

    return chat;
  }

  /**
   * Get chat history
   */
  async getChatHistory(chatId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const messages = await CourseMessage.findAll({
      where: { 
        chatId,
        isDeleted: false,
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'avatar', 'role'],
        },
        {
          model: CourseMessage,
          as: 'replies',
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'name', 'avatar', 'role'],
            },
          ],
        },
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    // Get pinned messages separately
    const pinnedMessages = await CourseMessage.findAll({
      where: { chatId, isPinned: true, isDeleted: false },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'avatar', 'role'],
        },
      ],
      order: [['pinned_at', 'DESC']],
    });

    return { messages: messages.reverse(), pinnedMessages };
  }

  /**
   * Send message with AI processing (RAG from all course chunks)
   */
  async sendMessage(chatId, userId, content, options = {}) {
    const { parentId = null, senderType = 'student' } = options;

    // Check chat access
    await this.checkChatAccess(chatId, userId, senderType);

    // Create message
    const message = await CourseMessage.create({
      chatId,
      senderId: userId,
      senderType,
      content,
      parentId,
      status: 'active',
    });

    // Record analytics
    await this.recordAnalytics(chatId, senderType);

    // If it's a question from student and AI is enabled, process with AI
    let aiResponse = null;
    let answeredBy = null;
    let escalation = null;

    const chat = await CourseChat.findByPk(chatId);
    if (senderType === 'student' && chat?.aiEnabled) {
      const aiResult = await this.processWithAI(content, chat.courseId);

      if (aiResult.confidence >= 0.7) {
        // AI can answer confidently
        aiResponse = await CourseMessage.create({
          chatId,
          senderId: AI_SYSTEM_USER_ID,
          senderType: 'ai',
          content: aiResult.content,
          parentId: message.id,
          status: 'answered',
          answeredBy: 'ai',
          aiConfidence: aiResult.confidence,
          aiContext: { sources: aiResult.sources },
        });

        await this.markAsAnswered(message.id, 'ai');
        answeredBy = 'ai';

        // Record AI analytics
        await this.recordAnalytics(chatId, 'ai');
      } else {
        // AI confidence low - escalate to teacher
        escalation = await this.escalateToTeacher(chatId, message.id, 'low_confidence', aiResult);
      }
    }

    return {
      message: await CourseMessage.findByPk(message.id, {
        include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'avatar', 'role'] }],
      }),
      aiResponse: aiResponse
        ? await CourseMessage.findByPk(aiResponse.id, {
            include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'avatar', 'role'] }],
          })
        : null,
      answeredBy,
      escalation,
    };
  }

  /**
   * Process with AI using RAG from all course chunks
   */
  async processWithAI(question, courseId) {
    try {
      // Get all chunks for this course
      const context = await this.getCourseContext(courseId);

      const prompt = this.buildRagPrompt(question, context);

      const response = await aiGateway.generateText({
        system: `Bạn là trợ lý AI cho khóa học. Hãy trả lời câu hỏi dựa trên nội dung khóa học được cung cấp.
Nếu không đủ thông tin, hãy nói "Tôi không chắc chắn" và giải thích lý do.
Hãy trả lời ngắn gọn, rõ ràng và hữu ích.`,
        prompt,
        maxOutputTokens: 1024,
      });

      // Parse confidence from response or estimate
      const confidence = this.estimateConfidence(response.text, context);

      return {
        content: response.text,
        confidence,
        sources: context.sources || [],
      };
    } catch (err) {
      logger.error('COURSE_AI_FAILED', { error: err.message });

      if (err.statusCode === 429 || err.code === 'GLOBAL_RATE_LIMITED' || err.code === 'ALL_KEYS_RATE_LIMITED') {
        return {
          content: 'Hệ thống AI hiện đang bận do quá tải. Vui lòng thử lại sau.',
          confidence: 0,
          sources: [],
          error: 'RATE_LIMIT',
        };
      }

      return {
        content: 'Xin lỗi, tôi gặp lỗi kỹ thuật. Vui lòng thử lại sau.',
        confidence: 0,
        sources: [],
        error: 'GENERIC_ERROR',
      };
    }
  }

  /**
   * Build RAG context from all course chunks
   */
  async getCourseContext(courseId) {
    // Get all chunks for this course
    const chunks = await AiChunk.findAll({
      where: { courseId },
      order: [['chunkIndex', 'ASC']],
      limit: 100, // Limit to prevent token overflow
    });

    const course = await Course.findByPk(courseId, {
      attributes: ['id', 'title', 'description'],
    });

    // Combine all chunk texts
    const combinedContent = chunks.map(c => c.text).join('\n\n---\n\n');

    // Build sources list
    const sources = chunks.map(c => ({
      type: 'chunk',
      id: c.id,
      documentId: c.documentId,
      chunkIndex: c.chunkIndex,
    }));

    return {
      title: course?.title || 'Khóa học',
      description: course?.description || '',
      content: combinedContent,
      sources,
      chunkCount: chunks.length,
    };
  }

  /**
   * Build RAG prompt with full course context
   */
  buildRagPrompt(question, context) {
    return `Khóa học: ${context.title}
Mô tả: ${context.description?.substring(0, 500) || 'Không có mô tả'}

Nội dung khóa học (tổng hợp từ ${context.chunkCount} phần):
${context.content?.substring(0, 8000) || 'Không có nội dung'}

Câu hỏi: ${question}

Trả lời dựa trên toàn bộ nội dung khóa học trên. Nếu thông tin không đầy đủ, hãy nói "Tôi không chắc chắn". Chỉ trả lời nếu bạn tự tin > 70%.`;
  }

  /**
   * Estimate AI confidence
   */
  estimateConfidence(response, context) {
    const hasUncertainty = /không chắc|không biết|không có thông tin|không tìm thấy|không đủ thông tin/i.test(response);
    const isRelevant = context.content && context.content.length > 100;
    const hasSubstantialContent = response.length > 100;

    if (hasUncertainty) return 0.3;
    if (!isRelevant) return 0.4;
    if (!hasSubstantialContent) return 0.5;
    return 0.85;
  }

  /**
   * Escalate to teacher
   */
  async escalateToTeacher(chatId, messageId, reason, aiResult = null) {
    const chat = await CourseChat.findByPk(chatId, {
      include: [{ model: Course, as: 'course' }],
    });

    const escalation = await CourseChatEscalation.create({
      messageId,
      chatId,
      status: 'ai_failed',
      aiConfidence: aiResult?.confidence || 0,
      escalationReason: reason,
    });

    const course = await Course.findByPk(chat.courseId);
    const teacher = await User.findByPk(course?.createdBy);

    if (teacher) {
      await Notification.create({
        userId: teacher.id,
        type: 'system',
        title: 'Câu hỏi cần trả lời',
        message: `Học viên đã hỏi trong khóa học và cần sự hỗ trợ của bạn.`,
        payload: {
          chatId,
          messageId,
          escalationId: escalation.id,
          type: 'course_chat_escalation',
        },
      });

      await escalation.update({
        status: 'notified_teacher',
        teacherNotifiedAt: new Date(),
      });

      logger.info('COURSE_ESCALATED_TEACHER', {
        escalationId: escalation.id,
        teacherId: teacher.id,
        messageId,
      });
    }

    return {
      id: escalation.id,
      status: 'needs_teacher',
      reason,
    };
  }

  /**
   * Mark message as answered
   */
  async markAsAnswered(messageId, answeredBy, userId) {
    await CourseMessage.update(
      { status: 'answered', answeredBy },
      { where: { id: messageId } }
    );

    const escalation = await CourseChatEscalation.findOne({
      where: { messageId },
    });

    if (escalation) {
      await escalation.update({
        status: 'answered',
        answeredAt: new Date(),
        answeredBy: userId,
      });
    }
  }

  /**
   * Join chat as participant
   */
  async joinChat(chatId, userId, role) {
    const [participant, created] = await CourseChatParticipant.findOrCreate({
      where: { chatId, userId },
      defaults: {
        chatId,
        userId,
        role,
        joinedAt: new Date(),
      },
    });

    if (!created && participant.isBanned) {
      throw { status: 403, message: 'Bạn đã bị ban khỏi chat này' };
    }

    if (!created) {
      await participant.update({ lastReadAt: new Date() });
    }

    return participant;
  }

  /**
   * Get pending escalations
   */
  async getPendingEscalations(userId, role) {
    const where = { status: { [Op.in]: ['ai_failed', 'notified_teacher'] } };

    if (role === 'teacher') {
      const courses = await Course.findAll({
        where: { createdBy: userId },
        attributes: ['id'],
      });
      const courseIds = courses.map(c => c.id);

      const chats = await CourseChat.findAll({
        where: { courseId: { [Op.in]: courseIds } },
        attributes: ['id'],
      });
      const chatIds = chats.map(c => c.id);

      where.chatId = { [Op.in]: chatIds };
    }

    return await CourseChatEscalation.findAll({
      where,
      include: [
        {
          model: CourseMessage,
          as: 'message',
          include: [
            { model: User, as: 'sender', attributes: ['id', 'name', 'avatar'] },
          ],
        },
        {
          model: CourseChat,
          as: 'chat',
          include: [{ model: Course, as: 'course', attributes: ['id', 'title'] }],
        },
      ],
      order: [['created_at', 'ASC']],
    });
  }

  /**
   * Admin escalation check
   */
  async checkAdminEscalation() {
    const ESCALATION_TIMEOUT_HOURS = 24;
    const cutoffTime = new Date(Date.now() - ESCALATION_TIMEOUT_HOURS * 60 * 60 * 1000);

    const pendingEscalations = await CourseChatEscalation.findAll({
      where: {
        status: 'notified_teacher',
        teacherNotifiedAt: { [Op.lt]: cutoffTime },
      },
      include: [{ model: CourseChat, as: 'chat' }],
    });

    for (const escalation of pendingEscalations) {
      const admins = await User.findAll({
        where: { role: 'admin' },
        attributes: ['id'],
      });

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
            type: 'course_chat_escalation_admin',
          },
        });
      }

      await escalation.update({
        status: 'notified_admin',
        adminNotifiedAt: new Date(),
      });

      logger.info('COURSE_ESCALATED_ADMIN', {
        escalationId: escalation.id,
        chatId: escalation.chatId,
      });
    }

    return pendingEscalations.length;
  }

  // ==================== PERMISSION METHODS ====================

  hasPermission(action, userRole, userId, chat) {
    const permissions = {
      student: ['view', 'send', 'reply'],
      teacher: ['view', 'send', 'reply', 'pin', 'delete', 'mute', 'analytics'],
      admin: ['view', 'send', 'reply', 'pin', 'delete', 'mute', 'ban', 'clear_history', 'enable_disable', 'analytics'],
    };

    const rolePermissions = permissions[userRole] || [];

    if (userRole === 'teacher' && chat && chat.course) {
      if (chat.course.createdBy !== userId) {
        return action === 'view' ? rolePermissions.includes(action) : false;
      }
    }

    return rolePermissions.includes(action);
  }

  async pinMessage(messageId, userId, userRole) {
    const message = await CourseMessage.findByPk(messageId, {
      include: [{ model: CourseChat, as: 'chat', include: [{ model: Course, as: 'course' }] }],
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

    logger.info('COURSE_MESSAGE_PINNED', { messageId, userId, isPinned });

    return {
      message: isPinned ? 'Đã pin tin nhắn' : 'Đã bỏ pin tin nhắn',
      isPinned,
    };
  }

  /**
   * Edit a message (Student can edit own message within 10 minutes, Teacher/Admin can edit any)
   */
  async editMessage(messageId, userId, userRole, newContent) {
    const message = await CourseMessage.findByPk(messageId, {
      include: [{ model: CourseChat, as: 'chat', include: [{ model: Course, as: 'course' }] }],
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

    logger.info('COURSE_MESSAGE_EDITED', { messageId, userId, userRole });

    return {
      message: 'Đã sửa tin nhắn',
      editedAt: message.editedAt,
    };
  }

  async deleteMessage(messageId, userId, userRole) {
    const message = await CourseMessage.findByPk(messageId, {
      include: [{ model: CourseChat, as: 'chat', include: [{ model: Course, as: 'course' }] }],
    });

    if (!message) {
      throw { status: 404, message: 'Không tìm thấy tin nhắn' };
    }

    if (!this.hasPermission('delete', userRole, userId, message.chat)) {
      throw { status: 403, message: 'Bạn không có quyền xóa tin nhắn' };
    }

    await message.update({
      isDeleted: true,
      deletedBy: userId,
      deletedAt: new Date(),
    });

    logger.info('COURSE_MESSAGE_DELETED', { messageId, userId });

    return { message: 'Đã xóa tin nhắn' };
  }

  async muteChat(chatId, userId, userRole, durationMinutes = null) {
    const chat = await CourseChat.findByPk(chatId, {
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

    logger.info('COURSE_CHAT_MUTED', { chatId, userId, mutedUntil });

    return {
      message: durationMinutes ? `Đã khóa chat trong ${durationMinutes} phút` : 'Đã mở khóa chat',
      mutedUntil,
    };
  }

  async banUser(chatId, targetUserId, userId, userRole, reason = null) {
    const chat = await CourseChat.findByPk(chatId, {
      include: [{ model: Course, as: 'course' }],
    });

    if (!chat) {
      throw { status: 404, message: 'Không tìm thấy chat' };
    }

    if (!this.hasPermission('ban', userRole, userId, chat)) {
      throw { status: 403, message: 'Chỉ admin có quyền ban user' };
    }

    const participant = await CourseChatParticipant.findOne({
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

    logger.info(isBanned ? 'COURSE_USER_BANNED' : 'COURSE_USER_UNBANNED', {
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

  async toggleChat(chatId, userId, userRole) {
    const chat = await CourseChat.findByPk(chatId, {
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

    logger.info(isEnabled ? 'COURSE_CHAT_ENABLED' : 'COURSE_CHAT_DISABLED', { chatId, userId });

    return {
      message: isEnabled ? 'Đã bật chat' : 'Đã tắt chat',
      isEnabled,
    };
  }

  async clearHistory(chatId, userId, userRole) {
    const chat = await CourseChat.findByPk(chatId, {
      include: [{ model: Course, as: 'course' }],
    });

    if (!chat) {
      throw { status: 404, message: 'Không tìm thấy chat' };
    }

    if (!this.hasPermission('clear_history', userRole, userId, chat)) {
      throw { status: 403, message: 'Chỉ admin có quyền xóa lịch sử chat' };
    }

    await CourseMessage.destroy({ where: { chatId } });
    await chat.update({
      deletedAt: new Date(),
      deletedBy: userId,
    });

    logger.info('COURSE_CHAT_HISTORY_CLEARED', { chatId, userId });

    return { message: 'Đã xóa toàn bộ lịch sử chat' };
  }

  async getAnalytics(chatId, userId, userRole, startDate = null, endDate = null) {
    const chat = await CourseChat.findByPk(chatId, {
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

    const analytics = await CourseChatAnalytics.findAll({
      where,
      order: [['date', 'DESC']],
    });

    const summary = await CourseChatAnalytics.findOne({
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

    return {
      daily: analytics,
      summary: summary?.dataValues || {},
    };
  }

  async recordAnalytics(chatId, type) {
    const today = new Date().toISOString().split('T')[0];

    const [analytics, created] = await CourseChatAnalytics.findOrCreate({
      where: { chatId, date: today },
      defaults: { chatId, date: today },
    });

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
    }
    await analytics.increment('totalMessages');

    return analytics;
  }

  async checkChatAccess(chatId, userId, userRole) {
    const chat = await CourseChat.findByPk(chatId, {
      include: [
        { model: Course, as: 'course' },
        { model: CourseChatParticipant, as: 'participants', where: { userId }, required: false },
      ],
    });

    if (!chat) {
      throw { status: 404, message: 'Không tìm thấy chat' };
    }

    if (!chat.isEnabled) {
      throw { status: 403, message: 'Chat đã bị tắt' };
    }

    if (chat.mutedUntil && new Date() < new Date(chat.mutedUntil)) {
      throw { status: 403, message: 'Chat đang bị khóa tạm thời' };
    }

    const participant = chat.participants?.[0];
    if (participant?.isBanned) {
      throw { status: 403, message: 'Bạn đã bị ban khỏi chat này' };
    }

    return { chat, participant };
  }
}

module.exports = new CourseChatService();
