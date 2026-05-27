const { validationResult } = require('express-validator');
const learningPathService = require('./learningPath.service');

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ', errors: errors.array() });
  }
  return null;
};

const handleServiceError = (error, res) => {
  if (error.status && error.message) {
    const response = { success: false, message: error.message };
    if (error.data) response.data = error.data;
    return res.status(error.status).json(response);
  }
  console.error('Lỗi lộ trình học:', error);
  return res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
};

class LearningPathController {
  /** Get all learning paths */
  async getAllPaths(req, res) {
    try {
      const paths = await learningPathService.getAllPaths();
      res.json({ success: true, data: paths });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /** Get current user's learning path progress */
  async getMyProgress(req, res) {
    try {
      const { id: userId } = req.user;
      const progress = await learningPathService.getMyProgress(userId);
      if (!progress) {
        return res.json({
          success: true,
          data: null,
          message: 'Bạn chưa có lộ trình học tập. Hãy khám phá các khóa học phù hợp.',
        });
      }
      res.json({ success: true, data: progress });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /** Get single path detail */
  async getPathById(req, res) {
    try {
      const { id } = req.user;
      const { pathId } = req.params;
      const result = await learningPathService.getPathById(pathId, id);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /** Check if user can enroll in a course */
  async canEnrollCourse(req, res) {
    try {
      const { id: userId } = req.user;
      const { courseId } = req.params;
      const result = await learningPathService.canEnrollCourse(userId, courseId);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /** Trigger level progress update after course completion */
  async updateLevelProgress(req, res) {
    try {
      const { id: userId } = req.user;
      const { courseId } = req.params;
      const result = await learningPathService.updateLevelProgress(userId, courseId);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new LearningPathController();
