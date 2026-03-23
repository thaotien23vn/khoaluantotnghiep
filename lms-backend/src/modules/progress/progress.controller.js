const { validationResult } = require('express-validator');
const progressService = require('./progress.service');

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
    const response = {
      success: false,
      message: error.message,
      error: error.message,
    };
    if (error.data) {
      response.data = error.data;
    }
    return res.status(error.status).json(response);
  }
  console.error('Lỗi tiến độ:', error);
  return res.status(500).json({
    success: false,
    message: 'Lỗi máy chủ',
    error: error.message,
  });
};

class ProgressController {
  /**
   * Update lecture progress (when watching video)
   */
  async updateLectureProgress(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId } = req.user;
      const { lectureId } = req.params;
      const { watchedPercent } = req.body;

      const result = await progressService.updateLectureProgress(
        userId,
        lectureId,
        watchedPercent
      );

      res.json({
        success: true,
        message: 'Cập nhật tiến độ thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get student's course progress
   */
  async getStudentCourseProgress(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId } = req.user;
      const { courseId } = req.params;

      const result = await progressService.getStudentCourseProgress(userId, courseId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get student progress detail (teacher view)
   */
  async getTeacherStudentProgress(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: teacherId } = req.user;
      const { courseId, studentId } = req.params;

      const result = await progressService.getTeacherStudentProgress(
        teacherId,
        courseId,
        studentId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get all students progress for a course (teacher view)
   */
  async getCourseStudentsProgress(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: teacherId } = req.user;
      const { courseId } = req.params;

      const result = await progressService.getCourseStudentsProgress(
        teacherId,
        courseId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new ProgressController();
