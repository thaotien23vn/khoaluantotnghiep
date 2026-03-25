const aiService = require('./ai.service');

/**
 * Handle service errors
 */
const handleServiceError = (error, res) => {
  console.error('AI Service error:', error);
  const status = error.status || 500;
  const message = error.message || 'Lỗi máy chủ';
  res.status(status).json({
    success: false,
    message,
    ...(error.errors && { errors: error.errors }),
  });
};

/**
 * AI Controller - HTTP request handling
 */
class AiController {
  // ===================== Student Operations =====================

  async createStudentConversation(req, res) {
    try {
      const userId = Number(req.user.id);
      const role = req.user.role;
      const result = await aiService.createStudentConversation(userId, role, req.body);
      res.status(201).json({ success: true, message: 'Tạo hội thoại AI', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async sendStudentMessage(req, res) {
    try {
      const userId = Number(req.user.id);
      const role = req.user.role;
      const conversationId = req.params.id;
      const result = await aiService.sendStudentMessage(userId, role, conversationId, req.body.message);
      res.status(201).json({ success: true, message: 'AI trả lời', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  // ===================== Teacher Operations =====================

  async updateTeacherLectureAiNotes(req, res) {
    try {
      const lectureId = req.params.id;
      const result = await aiService.updateTeacherLectureAiNotes(req.user, lectureId, req.body.aiNotes);
      res.json({ success: true, message: 'Cập nhật aiNotes', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async ingestTeacherLecture(req, res) {
    try {
      const lectureId = req.params.lectureId;
      const result = await aiService.ingestTeacherLecture(req.user, lectureId);
      res.json({ success: true, message: 'Ingest lecture', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  // ===================== Admin Operations =====================

  async getAdminAiSettings(req, res) {
    try {
      const result = await aiService.getAdminAiSettings();
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async upsertAdminAiSettings(req, res) {
    try {
      const result = await aiService.upsertAdminAiSettings(req.body);
      res.status(201).json({ success: true, message: 'Cập nhật AI settings', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getAdminAiPolicies(req, res) {
    try {
      const result = await aiService.getAdminAiPolicies();
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async createAdminAiPolicy(req, res) {
    try {
      const result = await aiService.createAdminAiPolicy(req.body);
      res.status(201).json({ success: true, message: 'Tạo policy', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getAdminPromptTemplates(req, res) {
    try {
      const result = await aiService.getAdminPromptTemplates();
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async createAdminPromptTemplate(req, res) {
    try {
      const result = await aiService.createAdminPromptTemplate(req.user, req.body);
      res.status(201).json({ success: true, message: 'Tạo prompt template', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getAdminAiAuditLogs(req, res) {
    try {
      const result = await aiService.getAdminAiAuditLogs();
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  // ===================== Student AI Enhancement Operations =====================

  async getStudentLearningPath(req, res) {
    try {
      const userId = Number(req.user.id);
      const courseId = Number(req.query.courseId);
      const result = await aiService.getStudentLearningPath(userId, courseId);
      res.json({ success: true, message: 'Lộ trình học tập', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getStudentRecommendations(req, res) {
    try {
      const userId = Number(req.user.id);
      const options = {
        courseId: req.query.courseId ? Number(req.query.courseId) : null,
        type: req.query.type,
        status: req.query.status,
        page: req.query.page,
        limit: req.query.limit,
      };
      const result = await aiService.getStudentRecommendations(userId, options);
      res.json({ success: true, message: 'AI Recommendations', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async updateStudentRecommendationStatus(req, res) {
    try {
      const userId = Number(req.user.id);
      const recommendationId = Number(req.params.id);
      const { status } = req.body;
      const result = await aiService.updateStudentRecommendationStatus(userId, recommendationId, status);
      res.json({ success: true, message: 'Cập nhật recommendation', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getStudentKnowledgeGaps(req, res) {
    try {
      const userId = Number(req.user.id);
      const courseId = Number(req.query.courseId);
      const result = await aiService.getStudentKnowledgeGaps(userId, courseId);
      res.json({ success: true, message: 'Knowledge gap analysis', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getStudentLearningAnalytics(req, res) {
    try {
      const userId = Number(req.user.id);
      const courseId = Number(req.query.courseId);
      const options = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        eventType: req.query.eventType,
        page: req.query.page,
        limit: req.query.limit,
      };
      const result = await aiService.getStudentLearningAnalytics(userId, courseId, options);
      res.json({ success: true, message: 'Learning analytics', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async trackStudentLearningEvent(req, res) {
    try {
      const userId = Number(req.user.id);
      const courseId = Number(req.body.courseId);
      const eventData = req.body.eventData;
      const result = await aiService.trackStudentLearningEvent(userId, courseId, eventData);
      res.status(201).json({ success: true, message: 'Event tracked', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getStudentStudySchedule(req, res) {
    try {
      const userId = Number(req.user.id);
      const courseId = Number(req.query.courseId);
      const constraints = {
        availableHoursPerDay: req.query.hoursPerDay ? Number(req.query.hoursPerDay) : 2,
        preferredDays: req.query.preferredDays?.split(','),
        deadline: req.query.deadline,
      };
      const result = await aiService.getStudentStudySchedule(userId, courseId, constraints);
      res.json({ success: true, message: 'Study schedule', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  // ===================== Teacher AI Enhancement Operations =====================

  async generateTeacherLectureContent(req, res) {
    try {
      const { courseId, chapterId, outlineData } = req.body;
      const result = await aiService.generateTeacherLectureContent(req.user, courseId, chapterId, outlineData);
      res.status(201).json({ success: true, message: 'Content generated', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async generateTeacherQuizQuestions(req, res) {
    try {
      const lectureId = Number(req.body.lectureId);
      const options = req.body.options || {};
      const result = await aiService.generateTeacherQuizQuestions(req.user, lectureId, options);
      res.status(201).json({ success: true, message: 'Quiz questions generated', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async generateTeacherPracticeExercises(req, res) {
    try {
      const lectureId = Number(req.body.lectureId);
      const options = req.body.options || {};
      const result = await aiService.generateTeacherPracticeExercises(req.user, lectureId, options);
      res.status(201).json({ success: true, message: 'Practice exercises generated', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async analyzeTeacherContentQuality(req, res) {
    try {
      const contentId = Number(req.query.contentId);
      const contentType = req.query.contentType;
      const result = await aiService.analyzeTeacherContentQuality(req.user, contentId, contentType);
      res.json({ success: true, message: 'Content quality analysis', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getTeacherCourseAnalytics(req, res) {
    try {
      const courseId = Number(req.query.courseId);
      const options = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        groupBy: req.query.groupBy,
      };
      const result = await aiService.getTeacherCourseAnalytics(req.user, courseId, options);
      res.json({ success: true, message: 'Course analytics', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getTeacherContentQualityReport(req, res) {
    try {
      const courseId = Number(req.query.courseId);
      const options = {
        contentType: req.query.contentType,
        minScore: req.query.minScore ? Number(req.query.minScore) : null,
        maxScore: req.query.maxScore ? Number(req.query.maxScore) : null,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
      };
      const result = await aiService.getTeacherContentQualityReport(req.user, courseId, options);
      res.json({ success: true, message: 'Content quality report', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  // ===================== Admin AI Enhancement Operations =====================

  async getAdminPlatformAnalytics(req, res) {
    try {
      const options = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        groupBy: req.query.groupBy || 'day',
      };
      const result = await aiService.getAdminPlatformAnalytics(options);
      res.json({ success: true, message: 'Platform analytics', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getAdminContentQualityReport(req, res) {
    try {
      const options = {
        courseId: req.query.courseId ? Number(req.query.courseId) : null,
        minScore: req.query.minScore ? Number(req.query.minScore) : null,
        maxScore: req.query.maxScore ? Number(req.query.maxScore) : null,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
      };
      const result = await aiService.getAdminContentQualityReport(options);
      res.json({ success: true, message: 'Content quality report', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async triggerAdminRecommendationsGeneration(req, res) {
    try {
      const courseId = Number(req.body.courseId);
      const result = await aiService.triggerAdminRecommendationsGeneration(courseId);
      res.json({ success: true, message: 'Recommendations generation triggered', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getAdminSystemHealth(req, res) {
    try {
      const result = await aiService.getAdminSystemHealth();
      res.json({ success: true, message: 'System health', data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new AiController();
