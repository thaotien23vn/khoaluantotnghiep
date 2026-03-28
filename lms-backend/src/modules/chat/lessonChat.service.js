const db = require('../../models/index');
const aiGateway = require('../../services/aiGateway.service');
const logger = require('../../utils/logger');
const { Op } = require('sequelize');

const {
  LessonChat,
  LessonMessage,
  ChatParticipant,
  ChatEscalation,
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
        { model: LessonMessage, as: 'messages', limit: 50, order: [['createdAt', 'DESC']] },
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
          attributes: ['id', 'firstName', 'lastName', 'avatar'],
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
              attributes: ['id', 'firstName', 'lastName', 'avatar'],
            },
          ],
        }] : []),
      ],
      order: [['createdAt', 'DESC']],
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

    // Get lesson content for RAG context
    const context = await this.getLessonContext(chat.lessonId);

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

      return {
        message,
        aiResponse: aiMessage,
        answeredBy: 'ai',
      };
    }

    // AI not confident - escalate
    return this.escalateToTeacher(
      chatId,
      message.id,
      `AI confidence too low: ${aiResult.confidence}`,
      aiResult
    );
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
      return {
        content: '',
        confidence: 0,
        sources: [],
      };
    }
  }

  /**
   * Build RAG prompt with lesson context
   */
  async getLessonContext(lessonId) {
    const lecture = await Lecture.findByPk(lessonId);
    return {
      content: lecture?.content || '',
      title: lecture?.title || '',
      sources: [{ type: 'lecture', id: lessonId }],
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
            { model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName'] },
          ],
        },
        {
          model: LessonChat,
          as: 'chat',
          include: [{ model: Course, as: 'course', attributes: ['id', 'title'] }],
        },
      ],
      order: [['createdAt', 'ASC']],
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
}

module.exports = new LessonChatService();
