const teacherStatisticsService = require('./teacher_statistics.service');

/**
 * Handle service errors
 */
const handleServiceError = (error, res) => {
  console.error('Teacher Statistics error:', error);
  const status = error.status || 500;
  const message = error.message || 'Lỗi máy chủ';
  res.status(status).json({
    success: false,
    message,
    ...(error.errors && { errors: error.errors }),
  });
};

/**
 * Teacher Statistics Controller - HTTP request handling
 */
class TeacherStatisticsController {
  async getTeacherDetailedStatistics(req, res) {
    try {
      const instructorId = req.user.id;
      const result = await teacherStatisticsService.getTeacherDetailedStatistics(instructorId, req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new TeacherStatisticsController();
