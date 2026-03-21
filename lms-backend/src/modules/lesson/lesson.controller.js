const { validationResult } = require('express-validator');
const lessonService = require('./lesson.service');

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
      error: error.message,
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
 * Lesson Controller - HTTP request handling
 */
class LessonController {
  /**
   * Create a lesson
   */
  async createLesson(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { chapterId } = req.params;
      const { id: userId, role } = req.user;
      const result = await lessonService.createLesson(chapterId, userId, role, req.body, req.file);
      res.status(201).json({
        success: true,
        message: 'Tạo bài giảng mới thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Update a lesson
   */
  async updateLesson(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id } = req.params;
      const { id: userId, role } = req.user;
      const result = await lessonService.updateLesson(id, userId, role, req.body, req.file);
      res.json({
        success: true,
        message: 'Cập nhật bài giảng thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Delete a lesson
   */
  async deleteLesson(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id } = req.params;
      const { id: userId, role } = req.user;
      const result = await lessonService.deleteLesson(id, userId, role);
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new LessonController();
