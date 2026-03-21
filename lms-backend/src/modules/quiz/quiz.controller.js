const { validationResult } = require('express-validator');
const quizService = require('./quiz.service');
const mediaService = require('../../services/media.service');

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
 * Quiz Controller - HTTP request handling
 */
class QuizController {
  async uploadQuizMedia(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng chọn file',
        });
      }

      const uploadResult = await mediaService.uploadLectureMedia(req.file);

      return res.status(201).json({
        success: true,
        message: 'Upload thành công',
        data: {
          url: uploadResult.url,
          bytes: uploadResult.bytes,
          format: uploadResult.format,
          publicId: uploadResult.publicId,
        },
      });
    } catch (error) {
      console.error('Upload quiz media error:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ',
        error: error.message,
      });
    }
  }

  async createQuiz(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId } = req.params;
      const { id: userId, role } = req.user;
      const result = await quizService.createQuiz(courseId, userId, role, req.body);

      res.status(201).json({
        success: true,
        message: 'Tạo quiz thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getCourseQuizzes(req, res) {
    try {
      const { courseId } = req.params;
      const { id: userId, role } = req.user;
      const result = await quizService.getCourseQuizzes(courseId, userId, role);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getStudentCourseQuizzes(req, res) {
    try {
      const { courseId } = req.params;
      const { id: userId, role } = req.user;
      const result = await quizService.getStudentCourseQuizzes(courseId, userId, role);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getAllMyQuizzes(req, res) {
    try {
      const { id: userId } = req.user;
      const result = await quizService.getAllMyQuizzes(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getQuiz(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { quizId } = req.params;
      const { id: userId, role } = req.user;
      const result = await quizService.getQuiz(quizId, userId, role);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async updateQuiz(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { quizId } = req.params;
      const { id: userId, role } = req.user;
      const result = await quizService.updateQuiz(quizId, userId, role, req.body);

      res.json({
        success: true,
        message: 'Cập nhật quiz thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async deleteQuiz(req, res) {
    try {
      const { quizId } = req.params;
      const { id: userId, role } = req.user;
      const result = await quizService.deleteQuiz(quizId, userId, role);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async addQuestion(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { quizId } = req.params;
      const { id: userId, role } = req.user;
      const result = await quizService.addQuestion(quizId, userId, role, req.body);

      res.status(201).json({
        success: true,
        message: 'Thêm câu hỏi thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async updateQuestion(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { questionId } = req.params;
      const { id: userId, role } = req.user;
      const result = await quizService.updateQuestion(questionId, userId, role, req.body);

      res.json({
        success: true,
        message: 'Cập nhật câu hỏi thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async deleteQuestion(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { questionId } = req.params;
      const { id: userId, role } = req.user;
      const result = await quizService.deleteQuestion(questionId, userId, role);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new QuizController();
