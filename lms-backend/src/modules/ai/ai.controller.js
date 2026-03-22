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
}

module.exports = new AiController();
