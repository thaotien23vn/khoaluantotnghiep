const { validationResult } = require('express-validator');
const chapterService = require('./chapter.service');

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
 * Chapter Controller - HTTP request handling
 */
class ChapterController {
  /**
   * Create a chapter
   */
  async createChapter(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId } = req.params;
      const { id: userId, role } = req.user;
      const result = await chapterService.createChapter(courseId, userId, role, req.body);
      res.status(201).json({
        success: true,
        message: 'Tạo chương mới thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Update a chapter
   */
  async updateChapter(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id } = req.params;
      const { id: userId, role } = req.user;
      const result = await chapterService.updateChapter(id, userId, role, req.body);
      res.json({
        success: true,
        message: 'Cập nhật chương thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Delete a chapter
   */
  async deleteChapter(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id } = req.params;
      const { id: userId, role } = req.user;
      const result = await chapterService.deleteChapter(id, userId, role);
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new ChapterController();
