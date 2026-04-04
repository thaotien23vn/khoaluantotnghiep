const db = require('../../models');
const logger = require('../../utils/logger');
const aiPolicy = require('../../services/aiPolicy.service');
const aiPrompt = require('../../services/aiPrompt.service');
const aiRag = require('../../services/aiRag.service');
const aiGateway = require('../../services/aiGateway.service');
const aiAudit = require('../../services/aiAudit.service');
const aiPersonalization = require('../../services/aiPersonalization.service');
const aiAnalytics = require('../../services/aiAnalytics.service');
const aiContent = require('../../services/aiContent.service');
const aiLearningPath = require('../../services/aiLearningPath.service');
const chatPermissionService = require('../../services/chatPermission.service');
const { courseGenerationQueue } = require('../../services/courseGeneration.queue');

const {
  Enrollment,
  Course,
  Chapter,
  Lecture,
  Quiz,
  Question,
  AiConversation,
  AiMessage,
  AiSetting,
  AiRolePolicy,
  AiPromptTemplate,
  AiAuditLog,
} = db.models;

class AiService {
  // Policy
  getAiSetting = aiPolicy.getAiSetting;
  getRolePolicy = aiPolicy.getRolePolicy;

  // Prompt
  getTemplateOrDefault = aiPrompt.getTemplateOrDefault;

  // Gateway
  generateText = aiGateway.generateText;
  embedText = aiGateway.embedText;

  // RAG
  ingestLecture = aiRag.ingestLecture;
  retrieveTopChunks = aiRag.retrieveTopChunks;

  // New enhanced services
  // Personalization
  generateRecommendations = (...args) => aiPersonalization.generateRecommendations(...args);
  getUserRecommendations = aiPersonalization.getUserRecommendations;
  updateRecommendationStatus = aiPersonalization.updateRecommendationStatus;
  upsertUserLearningProfile = aiPersonalization.upsertUserLearningProfile;
  updateProfileFromAnalytics = aiPersonalization.updateProfileFromAnalytics;

  // Analytics
  trackLearningEvent = (...args) => aiAnalytics.trackLearningEvent(...args);
  getUserLearningAnalytics = (...args) => aiAnalytics.getUserLearningAnalytics(...args);
  getCourseAnalytics = (...args) => aiAnalytics.getCourseAnalytics(...args);
  getPlatformAnalytics = (...args) => aiAnalytics.getPlatformAnalytics(...args);

  // Content
  generateLectureContent = aiContent.generateLectureContent;
  generateQuizQuestions = (...args) => aiContent.generateQuizQuestions(...args);
  generateRAGQuizQuestions = (...args) => aiContent.generateRAGQuizQuestions(...args);
  generateAndSaveQuiz = (...args) => aiContent.generateAndSaveQuiz(...args);
  publishQuiz = (...args) => aiContent.publishQuiz(...args);
  generatePracticeExercises = (...args) => aiContent.generatePracticeExercises(...args);
  analyzeContentQuality = aiContent.analyzeContentQuality;
  getContentQualityReport = (...args) => aiContent.getContentQualityReport(...args);
  generateCourseOutline = (...args) => aiContent.generateCourseOutline(...args);
  saveCourseOutline = (...args) => aiContent.saveCourseOutline(...args);
  generateAndSaveCourseOutline = (...args) => aiContent.generateAndSaveCourseOutline(...args);

  // Learning Path
  generateLearningPath = aiLearningPath.generateLearningPath;
  getUserLearningPath = aiLearningPath.generateLearningPath.bind(aiLearningPath);
  analyzeKnowledgeGaps = aiLearningPath.analyzeKnowledgeGaps;
  getStudyScheduleRecommendation = aiLearningPath.getStudyScheduleRecommendation;

  // Helpers
  async ensureStudentEnrolled(userId, courseId) {
    const row = await Enrollment.findOne({ where: { userId, courseId, status: 'enrolled' } });
    return !!row;
  }

  async ensureTeacherOwnsCourseOrAdmin(reqUser, course) {
    if (!course) return false;
    if (reqUser?.role === 'admin') return true;
    if (reqUser?.role !== 'teacher') return false;
    if (!course.createdBy) return false;
    return Number(course.createdBy) === Number(reqUser.id);
  }

  // Student Operations
  async createStudentConversation(userId, role, data) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    const courseId = data?.courseId != null ? Number(data.courseId) : null;
    const lectureId = data?.lectureId != null ? Number(data.lectureId) : null;

    if (!Number.isFinite(courseId)) {
      throw { status: 400, message: 'courseId không hợp lệ' };
    }

    const enrolled = await this.ensureStudentEnrolled(userId, courseId);
    if (!enrolled && role !== 'admin') {
      throw { status: 403, message: 'Bạn chưa đăng ký khóa học này' };
    }

    if (lectureId != null && Number.isFinite(lectureId)) {
      const lecture = await Lecture.findByPk(lectureId, {
        include: [{ model: Chapter, as: 'chapter', attributes: ['courseId'], required: true }],
      });
      if (!lecture || Number(lecture.chapter.courseId) !== courseId) {
        throw { status: 400, message: 'lectureId không thuộc courseId' };
      }
    }

    // Tìm conversation hiện có (1 lecture chỉ có 1 conversation)
    const whereClause = { userId, courseId };
    if (lectureId != null && Number.isFinite(lectureId)) {
      whereClause.lectureId = lectureId;
    }
    
    let conv = await AiConversation.findOne({
      where: whereClause,
      order: [['createdAt', 'DESC']],
    });
    
    // Nếu chưa có mới tạo mới
    if (!conv) {
      conv = await AiConversation.create({
        userId,
        role: String(role),
        courseId,
        lectureId: lectureId != null && Number.isFinite(lectureId) ? lectureId : null,
        title: data?.title ? String(data.title) : null,
      });
    }

    return { conversation: conv };
  }

  async sendStudentMessage(userId, role, conversationId, message) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    const convId = Number(conversationId);
    const msg = String(message || '').trim();

    if (!Number.isFinite(convId)) {
      throw { status: 400, message: 'conversationId không hợp lệ' };
    }
    if (!msg) {
      throw { status: 400, message: 'message không được trống' };
    }

    const conv = await AiConversation.findByPk(convId);
    if (!conv) throw { status: 404, message: 'Không tìm thấy hội thoại' };

    if (Number(conv.userId) !== userId && role !== 'admin') {
      throw { status: 403, message: 'Không có quyền truy cập hội thoại' };
    }

    // Check chat permission
    const permissionCheck = await chatPermissionService.canChat(
      userId,
      conv.courseId,
      conv.lectureId,
      role
    );
    
    if (!permissionCheck.allowed) {
      throw { 
        status: 403, 
        message: permissionCheck.reason || 'Bạn không có quyền chat',
        mutedUntil: permissionCheck.mutedUntil,
      };
    }

    if (!conv.courseId) {
      throw { status: 400, message: 'Hội thoại thiếu courseId' };
    }

    const enrolled = await this.ensureStudentEnrolled(userId, Number(conv.courseId));
    if (!enrolled && role !== 'admin') {
      throw { status: 403, message: 'Bạn chưa đăng ký khóa học này' };
    }

    await AiMessage.create({ conversationId: convId, sender: 'user', content: msg });

    const topK = Number(policy.ragTopK) || Number(process.env.AI_RAG_TOP_K || 5) || 5;
    const chunks = await this.retrieveTopChunks({
      courseId: Number(conv.courseId),
      lectureId: conv.lectureId != null ? Number(conv.lectureId) : null,
      query: msg,
      topK,
    });

    const contextText = chunks.map((c, idx) => `#${idx + 1} (score=${c.score?.toFixed?.(3) || 0}):\n${c.text}`).join('\n\n');
    const system = await this.getTemplateOrDefault('tutor');

    const prompt = [
      'CONTEXT:',
      contextText || '(no context found)',
      '',
      'QUESTION:',
      msg,
    ].join('\n');

    const aiRes = await this.generateText({
      system,
      prompt,
      maxOutputTokens: Number(policy.maxOutputTokens) || Number(process.env.AI_MAX_OUTPUT_TOKENS || 1024) || 1024,
      timeoutMs: 60000,
    });

    await AiMessage.create({ conversationId: convId, sender: 'ai', content: aiRes.text, tokenUsage: null });

    await aiAudit.logAiCall({
      userId,
      role,
      endpoint: 'student_ai_tutor',
      provider: setting.provider,
      model: setting.model,
      status: 'ok',
      courseId: conv.courseId,
      lectureId: conv.lectureId,
    });

    return { answer: aiRes.text, chunks };
  }

  // Teacher Operations
  async updateTeacherLectureAiNotes(reqUser, lectureId, aiNotes) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(reqUser.role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    const lid = Number(lectureId);
    if (!Number.isFinite(lid)) {
      throw { status: 400, message: 'lectureId không hợp lệ' };
    }

    const lecture = await Lecture.findByPk(lid, {
      include: [{ model: Chapter,
            as: 'chapter', attributes: ['courseId'], required: true }],
    });
    if (!lecture) throw { status: 404, message: 'Không tìm thấy lecture' };

    const course = await Course.findByPk(lecture.chapter.courseId);
    const allowed = await this.ensureTeacherOwnsCourseOrAdmin(reqUser, course);
    if (!allowed) {
      throw { status: 403, message: 'Bạn không có quyền cập nhật lecture này' };
    }

    const notes = aiNotes != null ? String(aiNotes) : null;
    await lecture.update({ aiNotes: notes });

    return { lecture };
  }

  async ingestTeacherLecture(reqUser, lectureId) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(reqUser.role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    const lid = Number(lectureId);
    if (!Number.isFinite(lid)) {
      throw { status: 400, message: 'lectureId không hợp lệ' };
    }

    const lecture = await Lecture.findByPk(lid, {
      include: [{ model: Chapter,
            as: 'chapter', attributes: ['courseId'], required: true }],
    });
    if (!lecture) throw { status: 404, message: 'Không tìm thấy lecture' };

    const course = await Course.findByPk(lecture.chapter.courseId);
    const allowed = await this.ensureTeacherOwnsCourseOrAdmin(reqUser, course);
    if (!allowed) {
      throw { status: 403, message: 'Bạn không có quyền ingest lecture này' };
    }

    return this.ingestLecture(lid);
  }

  // Admin Operations
  async getAdminAiSettings() {
    const row = await this.getAiSetting();
    return { setting: row };
  }

  async upsertAdminAiSettings(data) {
    const enabled = data?.enabled;
    const provider = data?.provider;
    const model = data?.model;

    const setting = await AiSetting.create({
      enabled: enabled != null ? Boolean(enabled) : false,
      provider: provider != null ? String(provider) : 'gemini',
      model: model != null ? String(model) : 'gemini-1.5-flash',
    });

    return { setting };
  }

  async getAdminAiPolicies() {
    const rows = await AiRolePolicy.findAll({ order: [['id', 'DESC']] });
    return { policies: rows };
  }

  async createAdminAiPolicy(data) {
    const role = String(data?.role || '').toLowerCase();
    if (!role) throw { status: 400, message: 'role không được trống' };

    const policy = await AiRolePolicy.create({
      role,
      enabled: data?.enabled != null ? Boolean(data.enabled) : true,
      dailyLimit: data?.dailyLimit != null ? Number(data.dailyLimit) : 50,
      maxOutputTokens: data?.maxOutputTokens != null ? Number(data.maxOutputTokens) : 1024,
      ragTopK: data?.ragTopK != null ? Number(data.ragTopK) : 5,
    });

    return { policy };
  }

  async getAdminPromptTemplates() {
    const rows = await AiPromptTemplate.findAll({ order: [['id', 'DESC']] });
    return { templates: rows };
  }

  async createAdminPromptTemplate(reqUser, data) {
    const key = String(data?.key || '').trim();
    const template = String(data?.template || '').trim();
    if (!key || !template) {
      throw { status: 400, message: 'key/template không hợp lệ' };
    }

    const row = await AiPromptTemplate.create({
      key,
      template,
      isActive: data?.isActive != null ? Boolean(data.isActive) : true,
      createdByAdminId: reqUser?.id ? Number(reqUser.id) : null,
    });

    return { template: row };
  }

  async getAdminAiAuditLogs() {
    const rows = await AiAuditLog.findAll({
      order: [['id', 'DESC']],
      limit: 200,
    });
    return { logs: rows };
  }

  // ==========================================
  // STUDENT AI ENHANCEMENT METHODS
  // ==========================================

  /**
   * Get personalized learning path for student
   */
  async getStudentLearningPath(userId, courseId) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    // Check if course exists first
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    const enrolled = await this.ensureStudentEnrolled(userId, courseId);
    if (!enrolled) {
      throw { status: 403, message: 'Bạn chưa đăng ký khóa học này' };
    }

    return this.getUserLearningPath(userId, courseId);
  }

  /**
   * Get AI recommendations for student
   */
  async getStudentRecommendations(userId, options = {}) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const { courseId, type, status, page, limit } = options;
    
    if (courseId) {
      const enrolled = await this.ensureStudentEnrolled(userId, courseId);
      if (!enrolled) {
        throw { status: 403, message: 'Bạn chưa đăng ký khóa học này' };
      }
    }

    return this.getUserRecommendations(userId, { courseId, type, status, page, limit });
  }

  /**
   * Update recommendation status
   */
  async updateStudentRecommendationStatus(userId, recommendationId, status) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    return this.updateRecommendationStatus(userId, recommendationId, status);
  }

  /**
   * Get knowledge gap analysis
   */
  async getStudentKnowledgeGaps(userId, courseId) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const enrolled = await this.ensureStudentEnrolled(userId, courseId);
    if (!enrolled) {
      throw { status: 403, message: 'Bạn chưa đăng ký khóa học này' };
    }

    return this.analyzeKnowledgeGaps(userId, courseId);
  }

  /**
   * Get student's learning analytics
   */
  async getStudentLearningAnalytics(userId, courseId, options = {}) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const enrolled = await this.ensureStudentEnrolled(userId, courseId);
    if (!enrolled) {
      throw { status: 403, message: 'Bạn chưa đăng ký khóa học này' };
    }

    return this.getUserLearningAnalytics(userId, courseId, options);
  }

  /**
   * Track learning event
   */
  async trackStudentLearningEvent(userId, courseId, eventData) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const enrolled = await this.ensureStudentEnrolled(userId, courseId);
    if (!enrolled) {
      throw { status: 403, message: 'Bạn chưa đăng ký khóa học này' };
    }

    return this.trackLearningEvent(userId, courseId, eventData);
  }

  /**
   * Get study schedule recommendation
   */
  async getStudentStudySchedule(userId, courseId, constraints = {}) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const enrolled = await this.ensureStudentEnrolled(userId, courseId);
    if (!enrolled) {
      throw { status: 403, message: 'Bạn chưa đăng ký khóa học này' };
    }

    return this.getStudyScheduleRecommendation(userId, courseId, constraints);
  }

  // ==========================================
  // TEACHER AI ENHANCEMENT METHODS
  // ==========================================

  /**
   * Generate lecture content from outline
   */
  async generateTeacherLectureContent(reqUser, courseId, chapterId, outlineData) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(reqUser.role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    const course = await Course.findByPk(courseId);
    const allowed = await this.ensureTeacherOwnsCourseOrAdmin(reqUser, course);
    if (!allowed) {
      throw { status: 403, message: 'Bạn không có quyền tạo content cho course này' };
    }

    return this.generateLectureContent(courseId, chapterId, outlineData);
  }

  /**
   * Generate quiz questions for lecture
   */
  async generateTeacherQuizQuestions(reqUser, lectureId, options = {}) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(reqUser.role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    // Verify teacher owns the lecture's course
    const lecture = await Lecture.findByPk(lectureId, {
      include: [{ model: Chapter,
            as: 'chapter', attributes: ['courseId'], required: true }],
    });
    
    if (!lecture) {
      throw { status: 404, message: 'Không tìm thấy lecture' };
    }

    const course = await Course.findByPk(lecture.chapter.courseId);
    const allowed = await this.ensureTeacherOwnsCourseOrAdmin(reqUser, course);
    if (!allowed) {
      throw { status: 403, message: 'Bạn không có quyền tạo quiz cho lecture này' };
    }

    return this.generateQuizQuestions(lectureId, options);
  }

  /**
   * Generate RAG-based quiz questions for teacher
   * Supports multiple scopes: course, chapter, lecture, multi-lecture
   */
  async generateTeacherRAGQuiz(reqUser, courseId, options = {}) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(reqUser.role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    // Verify teacher owns the course
    const course = await Course.findByPk(courseId);
    const allowed = await this.ensureTeacherOwnsCourseOrAdmin(reqUser, course);
    if (!allowed) {
      throw { status: 403, message: 'Bạn không có quyền tạo quiz cho khóa học này' };
    }

    return this.generateRAGQuizQuestions(courseId, options);
  }

  /**
   * Generate and save RAG-based quiz as draft
   */
  async generateAndSaveTeacherRAGQuiz(reqUser, courseId, quizData, options = {}) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(reqUser.role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    // Verify teacher owns the course
    const course = await Course.findByPk(courseId);
    const allowed = await this.ensureTeacherOwnsCourseOrAdmin(reqUser, course);
    if (!allowed) {
      throw { status: 403, message: 'Bạn không có quyền tạo quiz cho khóa học này' };
    }

    // Generate questions using RAG
    const generatedQuestions = await this.generateRAGQuizQuestions(courseId, options);

    // Determine lectureId and chapterId based on scope
    let lectureId = null;
    let chapterId = null;
    
    if (options.scope === 'chapter') {
      // Scope: chapter - use provided chapterId
      chapterId = options.chapterId || null;
    } else if (options.scope === 'lecture' || options.scope === 'multi') {
      // Scope: lecture or multi - use first lecture's chapter
      lectureId = options.lectureIds?.[0] || null;
      if (lectureId) {
        const lecture = await Lecture.findByPk(lectureId, {
          include: [{ model: Chapter, as: 'chapter', attributes: ['id'], required: true }],
        });
        if (lecture) {
          chapterId = lecture.chapter?.id || null;
        }
      }
    }
    // For scope 'course', both lectureId and chapterId remain null (course-level quiz)
    
    // Create quiz in database
    const quiz = await db.models.Quiz.create({
      courseId,
      lectureId,
      chapterId,
      title: quizData.title || `Quiz: ${course.title}`,
      description: quizData.description || `Quiz được tạo tự động bằng AI`,
      timeLimit: quizData.timeLimit || 30,
      passingScore: quizData.passingScore || 60,
      maxScore: quizData.maxScore || 100,
      status: 'draft',
      showResults: true,
      createdBy: reqUser.id,
    });

    // Create questions
    const questionRecords = [];
    for (const q of generatedQuestions.questions) {
      const question = await db.models.Question.create({
        quizId: quiz.id,
        type: q.type,
        content: q.question,
        options: q.options || null,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || null,
        points: 1,
        order: q.order,
      });
      questionRecords.push(question);
    }

    return {
      quiz,
      questions: questionRecords,
      metadata: {
        ...generatedQuestions.metadata,
        generatedAt: new Date(),
      },
    };
  }

  /**
   * Generate and save quiz as draft
   */
  async generateAndSaveTeacherQuiz(reqUser, lectureId, quizData, options = {}) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(reqUser.role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    const lecture = await Lecture.findByPk(lectureId, {
      include: [{ model: Chapter,
            as: 'chapter', attributes: ['courseId'], required: true }],
    });

    if (!lecture) {
      throw { status: 404, message: 'Không tìm thấy lecture' };
    }

    const course = await Course.findByPk(lecture.chapter.courseId);
    const allowed = await this.ensureTeacherOwnsCourseOrAdmin(reqUser, course);
    if (!allowed) {
      throw { status: 403, message: 'Bạn không có quyền tạo quiz cho lecture này' };
    }

    return this.generateAndSaveQuiz(lectureId, quizData, options, reqUser.id);
  }

  /**
   * Publish a draft quiz
   */
  async publishTeacherQuiz(reqUser, quizId) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(reqUser.role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    return this.publishQuiz(quizId, reqUser.id);
  }

  /**
   * Generate practice exercises
   */
  async generateTeacherPracticeExercises(reqUser, lectureId, options = {}) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(reqUser.role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    const lecture = await Lecture.findByPk(lectureId, {
      include: [{ model: Chapter,
            as: 'chapter', attributes: ['courseId'], required: true }],
    });
    
    if (!lecture) {
      throw { status: 404, message: 'Không tìm thấy lecture' };
    }

    const course = await Course.findByPk(lecture.chapter.courseId);
    const allowed = await this.ensureTeacherOwnsCourseOrAdmin(reqUser, course);
    if (!allowed) {
      throw { status: 403, message: 'Bạn không có quyền tạo exercises cho lecture này' };
    }

    return this.generatePracticeExercises(lectureId, options);
  }

  /**
   * Analyze content quality
   */
  async analyzeTeacherContentQuality(reqUser, contentId, contentType) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(reqUser.role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    // Get content based on type
    let content;
    if (contentType === 'lecture') {
      const lecture = await Lecture.findByPk(contentId);
      content = lecture?.content || lecture?.aiNotes || '';
    } else if (contentType === 'quiz') {
      const quiz = await Quiz.findByPk(contentId, { include: [Question] });
      content = JSON.stringify(quiz, null, 2);
    } else {
      throw { status: 400, message: 'Content type không được hỗ trợ' };
    }

    return this.analyzeContentQuality(contentId, content, contentType);
  }

  /**
   * Get course analytics for teacher
   */
  async getTeacherCourseAnalytics(reqUser, courseId, options = {}) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(reqUser.role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    const course = await Course.findByPk(courseId);
    const allowed = await this.ensureTeacherOwnsCourseOrAdmin(reqUser, course);
    if (!allowed) {
      throw { status: 403, message: 'Bạn không có quyền xem analytics của course này' };
    }

    return this.getCourseAnalytics(courseId, options);
  }

  /**
   * Get content quality report for teacher's course
   */
  async getTeacherContentQualityReport(reqUser, courseId, options = {}) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(reqUser.role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    const course = await Course.findByPk(courseId);
    const allowed = await this.ensureTeacherOwnsCourseOrAdmin(reqUser, course);
    if (!allowed) {
      throw { status: 403, message: 'Bạn không có quyền xem quality report của course này' };
    }

    return this.getContentQualityReport(courseId, options);
  }

  // ==========================================
  // ADMIN AI ENHANCEMENT METHODS
  // ==========================================

  /**
   * Get platform analytics
   */
  async getAdminPlatformAnalytics(options = {}) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    return this.getPlatformAnalytics(options);
  }

  /**
   * Get comprehensive content quality report
   */
  async getAdminContentQualityReport(options = {}) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const { courseId, minScore, maxScore, page, limit } = options;

    if (courseId) {
      return this.getContentQualityReport(courseId, { minScore, maxScore, page, limit });
    }

    // Get quality reports for all courses
    const courses = await Course.findAll({ attributes: ['id', 'title'] });
    const reports = [];

    for (const course of courses) {
      try {
        const report = await this.getContentQualityReport(course.id, { minScore, maxScore, page, limit });
        reports.push({
          courseId: course.id,
          courseTitle: course.title,
          ...report,
        });
      } catch (err) {
        // Skip courses with errors
        logger.warn('CONTENT_QUALITY_REPORT_COURSE_FAILED', { courseId: course.id, error: err.message });
      }
    }

    return { reports };
  }

  /**
   * Trigger AI recommendations generation for all users
   */
  async triggerAdminRecommendationsGeneration(courseId) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const enrollments = await Enrollment.findAll({
      where: { courseId, status: 'enrolled' },
      attributes: ['userId'],
    });

    const results = {
      totalUsers: enrollments.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const enrollment of enrollments) {
      try {
        await this.generateRecommendations(enrollment.userId, courseId);
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ userId: enrollment.userId, error: err.message });
      }
    }

    return { results };
  }

  /**
   * Get system health status
   */
  async getAdminSystemHealth() {
    const setting = await this.getAiSetting();
    
    const health = {
      aiEnabled: setting?.enabled || false,
      provider: setting?.provider || 'unknown',
      model: setting?.model || 'unknown',
      timestamp: new Date().toISOString(),
    };

    // Test AI gateway
    try {
      await this.generateText({
        system: 'Health check',
        prompt: 'Test',
        maxOutputTokens: 10,
      });
      health.aiGatewayStatus = 'operational';
    } catch (err) {
      health.aiGatewayStatus = 'degraded';
      health.aiGatewayError = err.message;
    }

    return { health };
  }

  /**
   * Trigger course content generation via queue (Phase 2)
   */
  async triggerCourseContentGeneration(reqUser, courseId, chapterIds, options = {}) {
    const setting = await this.getAiSetting();
    if (!setting?.enabled) {
      throw { status: 503, message: 'AI đang tạm tắt' };
    }

    const policy = await this.getRolePolicy(reqUser.role);
    if (!policy?.enabled) {
      throw { status: 403, message: 'Role không được phép sử dụng AI' };
    }

    // Verify teacher owns the course
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy course' };
    }

    const allowed = await this.ensureTeacherOwnsCourseOrAdmin(reqUser, course);
    if (!allowed) {
      throw { status: 403, message: 'Bạn không có quyền tạo content cho course này' };
    }

    // Check if course is in outline_ready status
    if (course.generationStatus !== 'outline_ready' && course.generationStatus !== 'failed') {
      throw { 
        status: 400, 
        message: 'Course phải ở trạng thái outline_ready hoặc failed để generate content',
        code: 'INVALID_COURSE_STATUS'
      };
    }

    // Update course status
    await course.update({ generationStatus: 'generating_content' });

    // Add job to queue
    const job = await courseGenerationQueue.add(
      'generateCourseContent',
      {
        courseId,
        chapterIds,
        options,
        userId: reqUser.id,
      },
      {
        jobId: `course-${courseId}-${Date.now()}`,
        priority: 1,
      }
    );

    logger.info('COURSE_CONTENT_GENERATION_QUEUED', {
      jobId: job.id,
      courseId,
      chapterIds,
      userId: reqUser.id,
    });

    return {
      jobId: job.id,
      courseId,
      status: 'queued',
      message: 'Course content generation đã được đưa vào hàng đợi',
    };
  }
}

module.exports = new AiService();
