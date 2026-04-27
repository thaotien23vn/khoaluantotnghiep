const { validationResult } = require('express-validator');
const attemptService = require('./attempt.service');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array(),
    });
  }
  return null;
};

/**
 * Handle service errors
 */
const handleServiceError = (error, res) => {
  if (error.status && error.message) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      data: error.data,
    });
  }
  console.error('Lỗi:', error);
  return res.status(500).json({
    success: false,
    message: 'Lỗi máy chủ',
    error: error.message,
  });
};

/**
 * Attempt Controller - HTTP request handling
 */
class AttemptController {
  async startAttempt(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { quizId } = req.params;
      const { id: userId, role } = req.user;
      const result = await attemptService.startAttempt(quizId, userId, role);

      res.status(201).json({
        success: true,
        message: 'Bắt đầu làm bài thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async submitAttempt(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { attemptId } = req.params;
      const { id: userId, role } = req.user;
      const { answers } = req.body;
      const result = await attemptService.submitAttempt(attemptId, userId, role, answers);

      res.json({
        success: true,
        message: 'Nộp bài thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getQuizAttempts(req, res) {
    try {
      const { quizId } = req.params;
      const { id: userId, role } = req.user;
      const result = await attemptService.getQuizAttempts(quizId, userId, role);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getAttempt(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { attemptId } = req.params;
      const { id: userId, role } = req.user;
      const result = await attemptService.getAttempt(attemptId, userId, role);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getQuizAttemptsForTeacher(req, res) {
    try {
      const { quizId } = req.params;
      const { id: userId, role } = req.user;
      const result = await attemptService.getQuizAttemptsForTeacher(quizId, userId, role);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async deleteAttempt(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { attemptId } = req.params;
      const { id: userId, role } = req.user;
      const result = await attemptService.deleteAttempt(attemptId, userId, role);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getAttemptForTeacher(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { attemptId } = req.params;
      const { id: userId, role } = req.user;
      const result = await attemptService.getAttemptForTeacher(attemptId, userId, role);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async gradeQuestion(req, res) {
    try {
      const { attemptId, questionId } = req.params;
      const { id: userId, role } = req.user;
      const { points, feedback } = req.body;

      const result = await attemptService.gradeQuestion(attemptId, questionId, userId, role, points, feedback);

      res.json(result);
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new AttemptController();
