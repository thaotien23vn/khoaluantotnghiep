const db = require('../../models/index');
const aiGateway = require('../../services/aiGateway.service');
const logger = require('../../utils/logger');
const { Op } = require('sequelize');

const {
  AiConversation,
  AiMessage,
  AiChunk,
  Course,
  User,
  PlacementSession,
  UserLearningProfile,
  Enrollment,
  Quiz,
  Attempt,
} = db.models;

const MAX_CONTEXT_CHUNKS = 8;

/**
 * AI Support 24/7 Service - Intelligent assistant with full system knowledge
 * Reuses: aiGateway, AiConversation, AiMessage, AiChunk models
 */
class AiSupportService {
  /**
   * Get or create a support conversation for user
   */
  async getOrCreateConversation(userId, options = {}) {
    try {
      const { context = {}, forceCreate = false } = options;
      
      // If forceCreate, always create new conversation
      if (!forceCreate) {
        // Try to find existing active conversation
        let conversation = await AiConversation.findOne({
          where: {
            userId,
            role: 'support',
            courseId: null, // Global support, not tied to specific course
          },
          order: [['createdAt', 'DESC']],
        });

        // Create new if not exists or too old (> 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (conversation && conversation.createdAt >= sevenDaysAgo) {
          return { conversation };
        }
      }

      // Create new conversation
      const conversation = await AiConversation.create({
        userId,
        role: 'support',
        courseId: null,
        lectureId: null,
        title: 'AI Hỗ trợ 24/7',
      });

      // Add welcome message
      const welcomeMsg = await this.buildWelcomeMessage(userId, context);
      await AiMessage.create({
        conversationId: conversation.id,
        sender: 'ai',
        content: welcomeMsg,
      });

      return { conversation };
    } catch (error) {
      logger.error('GET_OR_CREATE_CONVERSATION_FAILED', {
        userId,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể tạo cuộc trò chuyện',
        code: 'CONVERSATION_CREATION_FAILED',
      };
    }
  }

  /**
   * Build personalized welcome message
   */
  async buildWelcomeMessage(userId, context = {}) {
    try {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'username', 'role'],
      });

      const placement = await PlacementSession.findOne({
        where: { userId, status: 'completed' },
        order: [['completedAt', 'DESC']],
      });

      const enrolledCount = await Enrollment.count({
        where: { userId, status: 'active' },
      });

      let welcomeParts = [`Xin chào ${user?.username || 'bạn'}! 👋`];

      // Add proficiency info
      if (placement?.finalCefrLevel) {
        welcomeParts.push(`\n\n🎯 Trình độ hiện tại của bạn: **${placement.finalCefrLevel}**`);
        if (placement.confidenceScore) {
          welcomeParts.push(` (độ tin cậy: ${Math.round(placement.confidenceScore * 100)}%)`);
        }
      }

      // Add enrollment info
      welcomeParts.push(`\n📚 Bạn đang tham gia **${enrolledCount}** khóa học.`);

      // Add quick suggestions based on context
      welcomeParts.push('\n\n💡 Tôi có thể giúp bạn:');
      welcomeParts.push('• Tìm hiểu về các khóa học phù hợp với trình độ');
      welcomeParts.push('• Giải đáp thắc mắc về nội dung bài học');
      welcomeParts.push('• Gợi ý lộ trình học tập cá nhân hóa');
      welcomeParts.push('• Hỗ trợ kỹ thuật và thao tác trên hệ thống');
      
      if (user?.role === 'student' && enrolledCount === 0) {
        welcomeParts.push('\n\n🎓 **Gợi ý:** Bạn chưa tham gia khóa học nào. Hãy nhắn "tìm khóa học" để tôi gợi ý nhé!');
      }

      return welcomeParts.join('');
    } catch (error) {
      logger.error('BUILD_WELCOME_FAILED', { userId, error: error.message });
      return 'Xin chào! Tôi là AI Hỗ trợ 24/7. Tôi có thể giúp gì cho bạn?';
    }
  }

  /**
   * Get chat history
   */
  async getChatHistory(conversationId, userId, options = {}) {
    try {
      const conversation = await AiConversation.findOne({
        where: { id: conversationId, userId },
      });

      if (!conversation) {
        throw {
          status: 404,
          message: 'Không tìm thấy cuộc trò chuyện',
          code: 'CONVERSATION_NOT_FOUND',
        };
      }

      const { limit = 50, offset = 0 } = options;

      const messages = await AiMessage.findAll({
        where: { conversationId },
        order: [['createdAt', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return {
        messages,
        conversation,
        hasMore: messages.length === parseInt(limit),
      };
    } catch (error) {
      logger.error('GET_CHAT_HISTORY_FAILED', {
        conversationId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Send message and get AI response
   */
  async sendMessage(userId, content, options = {}) {
    try {
      const { context = {}, attachments = [], forceCreate = false } = options;

      // Get or create conversation (forceCreate = true to start fresh chat)
      const { conversation } = await this.getOrCreateConversation(userId, { context, forceCreate });

      // Save user message
      const userMessage = await AiMessage.create({
        conversationId: conversation.id,
        sender: 'user',
        content,
        tokenUsage: { attachments: attachments.length },
      });

      // Process with AI
      const aiResponse = await this.processWithAI(userId, content, {
        conversationId: conversation.id,
        context,
        history: await this.getRecentMessages(conversation.id, 10),
      });

      // Save AI message
      const aiMessage = await AiMessage.create({
        conversationId: conversation.id,
        sender: 'ai',
        content: aiResponse.content,
        tokenUsage: aiResponse.tokenUsage,
      });

      // Update conversation title with first user message
      if (conversation.title === 'AI Hỗ trợ 24/7' && content.length > 0) {
        const shortTitle = content.slice(0, 50) + (content.length > 50 ? '...' : '');
        await conversation.update({ title: shortTitle });
      }

      return {
        message: aiMessage,
        suggestions: aiResponse.suggestions,
        quickActions: aiResponse.quickActions,
        userMessage,
      };
    } catch (error) {
      logger.error('SEND_MESSAGE_FAILED', {
        userId,
        error: error.message,
        stack: error.stack,
      });
      throw {
        status: 500,
        message: 'Không thể xử lý tin nhắn: ' + error.message,
        code: 'MESSAGE_PROCESSING_FAILED',
      };
    }
  }

  /**
   * Get recent messages for context
   */
  async getRecentMessages(conversationId, limit = 10) {
    return await AiMessage.findAll({
      where: { conversationId },
      order: [['createdAt', 'DESC']],
      limit,
    }).then(msgs => msgs.reverse());
  }

  /**
   * Process message with AI using RAG and personalization
   */
  async processWithAI(userId, query, options = {}) {
    try {
      const { conversationId, context = {}, history = [] } = options;
      const currentPage = context.currentPage || '';
      const courseId = context.courseId;

      // 1. Get user profile and placement data
      const userContext = await this.buildUserContext(userId);

      // 2. Get RAG context from all courses (unified knowledge base)
      const ragContext = await this.buildRagContext(query, {
        courseId,
        currentPage,
      });

      // 3. Get course recommendations if relevant
      const recommendations = await this.getSmartRecommendations(userId, query);

      // 4. Build prompt
      const prompt = this.buildPrompt(query, {
        userContext,
        ragContext,
        recommendations,
        history,
        currentPage,
        courseId,
      });

      // 5. Call AI
      const response = await aiGateway.generateText({
        prompt,
        temperature: 0.7,
        maxTokens: 2500,  // Tăng từ 1500 để tránh cắt câu trả lời
      });

      // 6. Post-process response
      const processed = this.processResponse(response.text, {
        recommendations,
        userContext,
      });

      return {
        content: processed.content,
        tokenUsage: response.tokenUsage,
        suggestions: processed.suggestions,
        quickActions: processed.quickActions,
      };
    } catch (error) {
      logger.error('AI_PROCESSING_FAILED', {
        userId,
        query: query.slice(0, 100),
        error: error.message,
      });
      return {
        content: 'Xin lỗi, tôi gặp lỗi khi xử lý câu hỏi của bạn. Vui lòng thử lại sau.',
        tokenUsage: {},
        suggestions: [],
        quickActions: [],
      };
    }
  }

  /**
   * Build comprehensive user context
   */
  async buildUserContext(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'username', 'role', 'email'],
      });

      // Get placement data
      const placement = await PlacementSession.findOne({
        where: { userId, status: 'completed' },
        order: [['completedAt', 'DESC']],
      });

      // Get active enrollments
      const enrollments = await Enrollment.findAll({
        where: { userId, status: 'active' },
        include: [
          {
            model: Course,
            as: 'course',
            attributes: ['id', 'title', 'level', 'description'],
          },
        ],
      });

      // Get learning profiles
      const profiles = await UserLearningProfile.findAll({
        where: { userId },
        include: [
          {
            model: Course,
            as: 'course',
            attributes: ['id', 'title'],
          },
        ],
      });

      // Get recent quiz attempts
      const recentAttempts = await Attempt.findAll({
        where: { userId },
        include: [
          {
            model: Quiz,
            as: 'quiz',
            attributes: ['id', 'title'],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: 5,
      });

      return {
        user: {
          id: userId,
          username: user?.username,
          role: user?.role,
        },
        proficiency: placement ? {
          level: placement.finalCefrLevel,
          confidence: placement.confidenceScore,
          selfAssessed: placement.selfAssessedLevel,
        } : null,
        enrollments: enrollments.map(e => ({
          courseId: e.courseId,
          title: e.course?.title,
          level: e.course?.level,
          enrolledAt: e.enrolledAt,
        })),
        learningProfiles: profiles.map(p => ({
          courseId: p.courseId,
          learningStyle: p.learningStyle,
          weakTopics: p.weakTopics,
          averageScore: p.averageScore,
        })),
        recentQuizzes: recentAttempts.map(a => ({
          quizTitle: a.quiz?.title,
          score: a.score,
          maxScore: a.maxScore,
          percentage: a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0,
        })),
      };
    } catch (error) {
      logger.error('BUILD_USER_CONTEXT_FAILED', { userId, error: error.message });
      return { user: { id: userId }, proficiency: null, enrollments: [] };
    }
  }

  /**
   * Build RAG context from all available chunks using two-step filtering
   * Step 1: Keyword pre-filtering (reduce candidate pool)
   * Step 2: Embedding similarity ranking (fine-grained)
   */
  async buildRagContext(query, options = {}) {
    try {
      const { courseId, currentPage } = options;
      const queryLower = query.toLowerCase();

      // ==========================================
      // STEP 1: KEYWORD PRE-FILTERING (Candidate Selection)
      // Extract keywords from query for text search
      // ==========================================
      const keywords = this.extractKeywords(query);
      
      // Build where clause with keyword filtering
      const whereClause = {};
      
      // If courseId specified, prioritize that course
      if (courseId) {
        whereClause.courseId = courseId;
      }
      
      // Keyword filtering using Op.or (PostgreSQL ILIKE)
      if (keywords.length > 0) {
        whereClause[Op.or] = keywords.map(kw => ({
          text: { [Op.iLike]: `%${kw}%` }
        }));
      }

      // Get pre-filtered candidates (limit 50 for performance)
      const candidateChunks = await AiChunk.findAll({
        where: whereClause,
        attributes: ['id', 'text', 'embeddingJson', 'courseId', 'lectureId', 'chunkIndex'],
        include: [
          {
            model: Course,
            as: 'course',
            attributes: ['id', 'title', 'level'],
            required: false,
          },
        ],
        limit: 50, // Reduced from 200
      });

      // If no candidates with keywords, fall back to all chunks with lower limit
      let chunks = candidateChunks;
      if (!chunks.length && !courseId) {
        chunks = await AiChunk.findAll({
          attributes: ['id', 'text', 'embeddingJson', 'courseId', 'lectureId', 'chunkIndex'],
          include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'level'], required: false }],
          limit: 30, // Even lower for fallback
        });
      }

      if (!chunks.length) {
        return { context: '', sources: [] };
      }

      // ==========================================
      // STEP 2: FINE-GRAINED RANKING (Embedding Similarity)
      // Only compute similarity on filtered candidates
      // ==========================================
      
      // Get embedding for query (only once)
      const { embedding: queryEmbedding } = await aiGateway.embedText({
        text: query.slice(0, 1000),
      });

      // Score and sort by relevance (on reduced set)
      const scored = chunks
        .map((chunk) => {
          const score = this.cosineSimilarity(queryEmbedding, chunk.embeddingJson);
          return {
            ...chunk.toJSON(),
            score,
            courseTitle: chunk.course?.title,
            courseLevel: chunk.course?.level,
          };
        })
        .filter(x => Number.isFinite(x.score))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_CONTEXT_CHUNKS);

      // Format context
      const contextParts = scored.map((chunk, idx) => {
        const source = chunk.courseTitle ? `[${chunk.courseTitle}] ` : '';
        return `[${idx + 1}] ${source}${chunk.text}`;
      });

      return {
        context: contextParts.join('\n\n'),
        sources: scored.map(s => ({
          courseId: s.courseId,
          lectureId: s.lectureId,
          title: s.courseTitle,
          score: s.score,
        })),
      };
    } catch (error) {
      logger.error('BUILD_RAG_CONTEXT_FAILED', { error: error.message });
      return { context: '', sources: [] };
    }
  }

  /**
   * Extract keywords from query for pre-filtering
   */
  extractKeywords(query) {
    // Remove common stop words in Vietnamese and English
    const stopWords = new Set([
      'là', 'của', 'và', 'các', 'có', 'được', 'cho', 'trong', 'với', 'về', 'để', 'một', 'những',
      'the', 'is', 'of', 'and', 'a', 'to', 'in', 'for', 'with', 'on', 'at', 'by', 'from',
      'gì', 'bao', 'nhiêu', 'như', 'thế', 'nào', 'tại', 'sao', 'ai', 'khi', 'này', 'kia',
      'what', 'how', 'why', 'who', 'where', 'when', 'which', 'can', 'you', 'me', 'it',
    ]);
    
    // Extract meaningful words (3+ chars)
    const words = query
      .toLowerCase()
      .replace(/[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w));
    
    // Return unique keywords (max 5)
    return [...new Set(words)].slice(0, 5);
  }

  /**
   * Calculate cosine similarity
   */
  cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return -1;
    const n = Math.min(a.length, b.length);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < n; i += 1) {
      const va = Number(a[i]);
      const vb = Number(b[i]);
      if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
      dot += va * vb;
      na += va * va;
      nb += vb * vb;
    }
    if (na === 0 || nb === 0) return -1;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  /**
   * Get smart recommendations based on user context and query
   */
  async getSmartRecommendations(userId, query) {
    try {
      const queryLower = query.toLowerCase();
      const recommendations = [];

      // Check for course-related queries
      const courseKeywords = ['khóa học', 'học', 'course', 'bắt đầu', 'tìm', 'gợi ý', 'recommend'];
      const isCourseQuery = courseKeywords.some(k => queryLower.includes(k));

      if (isCourseQuery) {
        // Get placement level
        const placement = await PlacementSession.findOne({
          where: { userId, status: 'completed' },
          order: [['completedAt', 'DESC']],
        });

        const level = placement?.finalCefrLevel || 'B1';

        // Find suitable courses
        const suggestedCourses = await Course.findAll({
          where: {
            published: true,
            level: this.mapCefrToCourseLevel(level),
          },
          attributes: ['id', 'slug', 'title', 'description', 'level', 'imageUrl', 'students'],
          limit: 3,
        });

        if (suggestedCourses.length) {
          recommendations.push({
            type: 'course_suggestion',
            title: 'Khóa học phù hợp với trình độ của bạn',
            items: suggestedCourses.map(c => ({
              id: c.id,
              slug: c.slug,
              title: c.title,
              description: c.description,
              level: c.level,
              imageUrl: c.imageUrl,
            })),
          });
        }
      }

      // Check for quiz/practice queries
      const practiceKeywords = ['luyện tập', 'quiz', 'bài tập', 'kiểm tra', 'practice'];
      if (practiceKeywords.some(k => queryLower.includes(k))) {
        const enrollments = await Enrollment.findAll({
          where: { userId, status: 'active' },
          attributes: ['courseId'],
        });

        const courseIds = enrollments.map(e => e.courseId);
        
        if (courseIds.length) {
          const quizzes = await Quiz.findAll({
            where: {
              courseId: { [Op.in]: courseIds },
              isActive: true,
            },
            attributes: ['id', 'title', 'courseId'],
            limit: 3,
          });

          if (quizzes.length) {
            recommendations.push({
              type: 'quiz_suggestion',
              title: 'Bài quiz để luyện tập',
              items: quizzes.map(q => ({
                id: q.id,
                title: q.title,
                courseId: q.courseId,
              })),
            });
          }
        }
      }

      return recommendations;
    } catch (error) {
      logger.error('GET_SMART_RECOMMENDATIONS_FAILED', { userId, error: error.message });
      return [];
    }
  }

  /**
   * Map CEFR level to course level
   */
  mapCefrToCourseLevel(cefr) {
    const mapping = {
      'A1': 'beginner',
      'A2': 'elementary',
      'B1': 'intermediate',
      'B2': 'upper-intermediate',
      'C1': 'advanced',
      'C2': 'proficiency',
    };
    return mapping[cefr] || 'all-levels';
  }

  /**
   * Build comprehensive prompt for AI
   */
  buildPrompt(query, options = {}) {
    const { userContext, ragContext, recommendations, history, currentPage, courseId } = options;

    const parts = [];

    // System instruction
    parts.push(`Bạn là "AI Hỗ trợ 24/7" - trợ lý học tập thông minh của hệ thống LMS.

NHIỆM VỤ:
- Trả lời câu hỏi của học viên dựa trên dữ liệu có sẵn
- Gợi ý khóa học phù hợp với trình độ
- Hỗ trợ kỹ thuật và giải đáp thắc mắc
- Đề xuất lộ trình học tập cá nhân hóa

QUY TẮC VỀ FORMAT GỢI Ý KHÓA HỌC:
Khi gợi ý khóa học cụ thể, hãy sử dụng format: COURSE_CARD(slug|tên khóa học|trình độ)
Ví dụ: COURSE_CARD(master-english-c2|Mastering C2 English|C2)

VÍ DỤ MẪU - CÁCH TRẢ LỜI:

User: "Tôi muốn học tiếng Anh giao tiếp"
AI: "Tôi gợi ý khóa học COURSE_CARD(communicate-english-b1|Tiếng Anh Giao tiếp B1|B1) cho bạn. Khóa học này tập trung vào kỹ năng nói và phản xạ trong giao tiếp hàng ngày."

User: "Khóa học nào phù hợp cho người mới bắt đầu?"
AI: "Với người mới bắt đầu, tôi đề xuất COURSE_CARD(english-basic-a1|Tiếng Anh Cơ bản A1|A1). Đây là khóa học xây dựng nền tảng vững chắc từ đầu."

QUY TẮC CHUNG:
1. Trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp
2. Dựa trên ngữ cảnh (context) được cung cấp để trả lời
3. Nếu không chắc chắn, nói rõ "Tôi không chắc về vấn đề này"
4. Có thể đề xuất khóa học nếu phù hợp (dùng format COURSE_CARD)
5. Format câu trả lời rõ ràng với bullet points khi cần`);

    // User context
    if (userContext) {
      parts.push(`\n=== THÔNG TIN NGƯỜI DÙNG ===`);
      parts.push(`Vai trò: ${userContext.user?.role || 'student'}`);
      
      if (userContext.proficiency) {
        parts.push(`Trình độ: ${userContext.proficiency.level}`);
        parts.push(`Độ tin cậy: ${Math.round(userContext.proficiency.confidence * 100)}%`);
      }
      
      if (userContext.enrollments?.length) {
        parts.push(`\nKhóa học đang tham gia:`);
        userContext.enrollments.forEach(e => {
          parts.push(`- ${e.title} (${e.level})`);
        });
      }
      
      if (userContext.learningProfiles?.length) {
        const weakTopics = userContext.learningProfiles
          .flatMap(p => p.weakTopics || [])
          .filter((v, i, a) => a.indexOf(v) === i);
        if (weakTopics.length) {
          parts.push(`\nChủ đề cần cải thiện: ${weakTopics.join(', ')}`);
        }
      }
      
      if (userContext.recentQuizzes?.length) {
        const avgScore = userContext.recentQuizzes.reduce((s, a) => s + a.percentage, 0) / userContext.recentQuizzes.length;
        parts.push(`\nĐiểm trung bình quiz gần đây: ${Math.round(avgScore)}%`);
      }
    }

    // Current context
    if (currentPage || courseId) {
      parts.push(`\n=== NGỮ CẢNH HIỆN TẠI ===`);
      if (currentPage) parts.push(`Trang: ${currentPage}`);
      if (courseId) parts.push(`Khóa học: ${courseId}`);
    }

    // RAG context
    if (ragContext?.context) {
      parts.push(`\n=== THÔNG TIN TỪ HỆ THỐNG ===`);
      parts.push(ragContext.context);
    }

    // Recommendations
    if (recommendations?.length) {
      parts.push(`\n=== CÁC KHÓA HỌC CÓ THỂ ĐỀ XUẤT ===`);
      recommendations.forEach((rec, idx) => {
        parts.push(`\n${idx + 1}. ${rec.title}`);
        rec.items?.forEach(item => {
          // Format with COURSE_CARD if it's a course
          if (item.slug) {
            const levelText = item.level?.toUpperCase() || 'ALL';
            parts.push(`   COURSE_CARD(${item.slug}|${item.title}|${levelText})`);
            if (item.description) {
              parts.push(`   Mô tả: ${item.description.slice(0, 100)}`);
            }
          } else {
            parts.push(`   - ${item.title}${item.description ? ': ' + item.description.slice(0, 100) : ''}`);
          }
        });
      });
      parts.push(`\nHãy sử dụng format COURSE_CARD(slug|tên|trình độ) khi đề xuất khóa học ở phần trả lời.`);
    }

    // Chat history
    if (history?.length) {
      parts.push(`\n=== LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY ===`);
      history.slice(-5).forEach(msg => {
        const role = msg.sender === 'ai' ? 'AI' : 'User';
        parts.push(`${role}: ${msg.content.slice(0, 200)}`);
      });
    }

    // Current query
    parts.push(`\n=== CÂU HỎI HIỆN TẠI ===`);
    parts.push(`User: ${query}`);
    parts.push(`\nHãy trả lời câu hỏi của user.`);

    return parts.join('\n');
  }

  /**
   * Process AI response and extract suggestions/quick actions
   */
  processResponse(text, options = {}) {
    const { recommendations, userContext } = options;
    
    // Extract suggestions from text
    const suggestions = [];
    const quickActions = [];

    // Add recommendation-based quick actions
    recommendations?.forEach(rec => {
      if (rec.type === 'course_suggestion') {
        quickActions.push({
          type: 'view_course',
          label: '📚 Xem khóa học gợi ý',
          action: 'show_recommendations',
        });
      }
      if (rec.type === 'quiz_suggestion') {
        quickActions.push({
          type: 'take_quiz',
          label: '📝 Làm bài quiz',
          action: 'show_quizzes',
        });
      }
    });

    // Add context-aware actions
    if (!userContext?.enrollments?.length) {
      quickActions.push({
        type: 'find_courses',
        label: '🔍 Tìm khóa học',
        action: 'find_courses',
      });
    }

    quickActions.push({
      type: 'placement_test',
      label: '🎯 Làm bài test trình độ',
      action: 'start_placement',
    });

    return {
      content: text,
      suggestions: suggestions.slice(0, 3),
      quickActions: quickActions.slice(0, 4),
    };
  }

  /**
   * Get user's conversations list
   */
  async getUserConversations(userId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;

      const { count, rows } = await AiConversation.findAndCountAll({
        where: {
          userId,
          role: 'support',
        },
        order: [['updatedAt', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      // Get last message for preview
      const conversationsWithPreview = await Promise.all(
        rows.map(async (conv) => {
          const lastMessage = await AiMessage.findOne({
            where: { conversationId: conv.id },
            order: [['createdAt', 'DESC']],
          });
          const messageCount = await AiMessage.count({
            where: { conversationId: conv.id },
          });

          return {
            ...conv.toJSON(),
            lastMessage: lastMessage?.content?.slice(0, 100) || '',
            messageCount,
          };
        })
      );

      return {
        conversations: conversationsWithPreview,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit)),
        },
      };
    } catch (error) {
      logger.error('GET_USER_CONVERSATIONS_FAILED', { userId, error: error.message });
      throw {
        status: 500,
        message: 'Không thể lấy danh sách cuộc trò chuyện',
        code: 'GET_CONVERSATIONS_FAILED',
      };
    }
  }

  /**
   * Clear conversation history
   */
  async clearConversation(userId, conversationId) {
    try {
      const conversation = await AiConversation.findOne({
        where: { id: conversationId, userId },
      });

      if (!conversation) {
        throw {
          status: 404,
          message: 'Không tìm thấy cuộc trò chuyện',
          code: 'CONVERSATION_NOT_FOUND',
        };
      }

      await AiMessage.destroy({
        where: { conversationId },
      });

      // Add system message
      await AiMessage.create({
        conversationId,
        sender: 'system',
        content: 'Lịch sử trò chuyện đã được xóa. Bắt đầu cuộc trò chuyện mới.',
      });

      return { message: 'Đã xóa lịch sử trò chuyện' };
    } catch (error) {
      logger.error('CLEAR_CONVERSATION_FAILED', { userId, conversationId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(userId, conversationId) {
    try {
      const conversation = await AiConversation.findOne({
        where: { id: conversationId, userId },
      });

      if (!conversation) {
        throw {
          status: 404,
          message: 'Không tìm thấy cuộc trò chuyện',
          code: 'CONVERSATION_NOT_FOUND',
        };
      }

      await AiMessage.destroy({ where: { conversationId } });
      await conversation.destroy();

      return { message: 'Đã xóa cuộc trò chuyện' };
    } catch (error) {
      logger.error('DELETE_CONVERSATION_FAILED', { userId, conversationId, error: error.message });
      throw error;
    }
  }

  /**
   * Get quick suggestions for user
   */
  async getQuickSuggestions(userId, context = {}) {
    try {
      const suggestions = [];
      const { currentPage } = context;

      // Check if user has placement
      const hasPlacement = await PlacementSession.count({
        where: { userId, status: 'completed' },
      });

      if (!hasPlacement) {
        suggestions.push({
          text: 'Làm bài test trình độ',
          action: 'start_placement',
          icon: '🎯',
        });
      }

      // Check enrollments
      const enrollmentCount = await Enrollment.count({
        where: { userId, status: 'active' },
      });

      if (enrollmentCount === 0) {
        suggestions.push({
          text: 'Tìm khóa học phù hợp',
          action: 'find_courses',
          icon: '🔍',
        });
      } else {
        suggestions.push({
          text: 'Tiếp tục học',
          action: 'continue_learning',
          icon: '📚',
        });
        suggestions.push({
          text: 'Luyện tập quiz',
          action: 'practice_quiz',
          icon: '📝',
        });
      }

      // Page-specific suggestions
      if (currentPage?.includes('course')) {
        suggestions.push({
          text: 'Giải thích bài học',
          action: 'explain_lesson',
          icon: '💡',
        });
      }

      suggestions.push({
        text: 'Hỗ trợ kỹ thuật',
        action: 'tech_support',
        icon: '🔧',
      });

      return { suggestions: suggestions.slice(0, 5) };
    } catch (error) {
      logger.error('GET_QUICK_SUGGESTIONS_FAILED', { userId, error: error.message });
      return { suggestions: [] };
    }
  }

  /**
   * Handle quick action
   */
  async handleQuickAction(userId, action, context = {}) {
    try {
      switch (action) {
        case 'find_courses':
          return this.handleFindCourses(userId);
        case 'show_recommendations':
          return this.handleShowRecommendations(userId);
        case 'start_placement':
          return { type: 'redirect', url: '/placement-test', message: 'Đang chuyển đến bài test...' };
        case 'continue_learning':
          return this.handleContinueLearning(userId);
        case 'practice_quiz':
          return this.handlePracticeQuiz(userId);
        case 'show_quizzes':
          return this.handleShowQuizzes(userId);
        default:
          return { type: 'message', message: 'Tôi không hiểu yêu cầu này.' };
      }
    } catch (error) {
      logger.error('HANDLE_QUICK_ACTION_FAILED', { userId, action, error: error.message });
      return { type: 'error', message: 'Có lỗi xảy ra' };
    }
  }

  /**
   * Handle find courses action
   */
  async handleFindCourses(userId) {
    try {
      // Get placement level
      const placement = await PlacementSession.findOne({
        where: { userId, status: 'completed' },
        order: [['completedAt', 'DESC']],
      });

      const level = placement?.finalCefrLevel;
      const courseLevel = level ? this.mapCefrToCourseLevel(level) : null;

      const where = { published: true };
      if (courseLevel) {
        where.level = courseLevel;
      }

      const courses = await Course.findAll({
        where,
        attributes: ['id', 'title', 'description', 'level', 'imageUrl', 'students', 'rating'],
        order: [['rating', 'DESC']],
        limit: 5,
      });

      const levelText = level ? `phù hợp với trình độ ${level}` : 'phổ biến';
      
      return {
        type: 'course_list',
        title: `Khóa học ${levelText}`,
        courses: courses.map(c => ({
          id: c.id,
          title: c.title,
          description: c.description,
          level: c.level,
          imageUrl: c.imageUrl,
          students: c.students,
          rating: c.rating,
        })),
        message: `Dựa trên trình độ ${level || 'chưa xác định'} của bạn, đây là các khóa học phù hợp:`,
      };
    } catch (error) {
      logger.error('HANDLE_FIND_COURSES_FAILED', { userId, error: error.message });
      return { type: 'error', message: 'Không thể tìm khóa học' };
    }
  }

  /**
   * Handle continue learning action
   */
  async handleContinueLearning(userId) {
    try {
      // Get most recent enrollment with progress
      const enrollment = await Enrollment.findOne({
        where: { userId, status: 'active' },
        include: [
          {
            model: Course,
            as: 'course',
            attributes: ['id', 'title'],
          },
        ],
        order: [['lastAccessedAt', 'DESC']],
      });

      if (!enrollment) {
        return { type: 'message', message: 'Bạn chưa có khóa học nào. Hãy tìm khóa học để bắt đầu!' };
      }

      return {
        type: 'redirect',
        url: `/courses/${enrollment.courseId}/learn`,
        message: `Tiếp tục học **${enrollment.course?.title}**...`,
      };
    } catch (error) {
      logger.error('HANDLE_CONTINUE_LEARNING_FAILED', { userId, error: error.message });
      return { type: 'error', message: 'Không thể tiếp tục học' };
    }
  }

  /**
   * Handle practice quiz action
   */
  async handlePracticeQuiz(userId) {
    try {
      const enrollments = await Enrollment.findAll({
        where: { userId, status: 'active' },
        attributes: ['courseId'],
      });

      const courseIds = enrollments.map(e => e.courseId);

      if (!courseIds.length) {
        return { type: 'message', message: 'Bạn cần tham gia khóa học trước để làm bài quiz.' };
      }

      const quizzes = await Quiz.findAll({
        where: {
          courseId: { [Op.in]: courseIds },
          isActive: true,
        },
        attributes: ['id', 'title', 'courseId'],
        limit: 5,
      });

      return {
        type: 'quiz_list',
        title: 'Bài quiz luyện tập',
        quizzes: quizzes.map(q => ({
          id: q.id,
          title: q.title,
          courseId: q.courseId,
        })),
        message: 'Chọn bài quiz để luyện tập:',
      };
    } catch (error) {
      logger.error('HANDLE_PRACTICE_QUIZ_FAILED', { userId, error: error.message });
      return { type: 'error', message: 'Không thể lấy danh sách quiz' };
    }
  }

  /**
   * Get system statistics for admin
   */
  async getSystemStats(options = {}) {
    try {
      const { days = 7 } = options;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [
        totalConversations,
        totalMessages,
        activeUsers,
        avgMessagesPerConversation,
      ] = await Promise.all([
        AiConversation.count({ where: { role: 'support' } }),
        AiMessage.count({
          where: {
            sender: { [Op.in]: ['user', 'ai'] },
          },
        }),
        AiConversation.count({
          where: { role: 'support' },
          distinct: true,
          col: 'user_id',
        }),
        AiMessage.count({
          where: { createdAt: { [Op.gte]: since } },
        }),
      ]);

      return {
        totalConversations,
        totalMessages,
        activeUsers,
        recentMessages: avgMessagesPerConversation,
        avgMessagesPerConversation: totalConversations > 0 
          ? Math.round(totalMessages / totalConversations) 
          : 0,
      };
    } catch (error) {
      logger.error('GET_SYSTEM_STATS_FAILED', { error: error.message });
      throw {
        status: 500,
        message: 'Không thể lấy thống kê',
        code: 'GET_STATS_FAILED',
      };
    }
  }
}

module.exports = new AiSupportService();
