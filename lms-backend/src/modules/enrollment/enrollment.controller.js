const { validationResult } = require('express-validator');
const enrollmentService = require('./enrollment.service');

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
  console.error('Lỗi ghi danh:', error);
  return res.status(500).json({
    success: false,
    message: 'Lỗi máy chủ',
    error: error.message,
  });
};

/**
 * Enrollment Controller - HTTP request handling
 */
class EnrollmentController {
  /**
   * Enroll in a course
   */
  async enroll(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId } = req.params;
      const { id: userId, role } = req.user;
      const result = await enrollmentService.enroll(userId, role, courseId);
      
      res.status(201).json({
        success: true,
        message: 'Đăng ký khóa học thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Unenroll from a course
   */
  async unenroll(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId } = req.params;
      const { id: userId } = req.user;
      const result = await enrollmentService.unenroll(userId, courseId);
      
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get my enrollments
   */
  async getMyEnrollments(req, res) {
    try {
      const { id: userId } = req.user;
      const result = await enrollmentService.getMyEnrollments(userId);
      res.json({
        success: true,
        message: 'Danh sách khóa học của bạn',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get enrollment by course
   */
  async getEnrollmentByCourse(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId } = req.params;
      const { id: userId } = req.user;
      const result = await enrollmentService.getEnrollmentByCourse(userId, courseId);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Update progress
   */
  async updateProgress(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId } = req.params;
      const { id: userId } = req.user;
      const { progressPercent } = req.body;
      const result = await enrollmentService.updateProgress(userId, courseId, progressPercent);
      
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
   * Get expiring enrollments (renewal reminders)
   */
  async getExpiringEnrollments(req, res) {
    try {
      const { id: userId } = req.user;
      const daysThreshold = parseInt(req.query.days) || 7;
      const result = await enrollmentService.getExpiringEnrollments(userId, daysThreshold);
      
      res.json({
        success: true,
        message: `Danh sách khóa học sắp hết hạn (trong ${daysThreshold} ngày)`,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get renewal price for an enrollment
   */
  async getRenewalPrice(req, res) {
    try {
      const { id } = req.params;
      const months = parseFloat(req.query.months) || 1; // Support fractional months (0.25 = 1 week)
      const result = await enrollmentService.getRenewalPrice(id, months);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Renew enrollment
   */
  async renewEnrollment(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;
      const { months, paymentId } = req.body;
      
      if (!months || months < 1 || months > 24) {
        return res.status(400).json({
          success: false,
          message: 'Thời gian gia hạn phải từ 1-24 tháng',
        });
      }
      
      const result = await enrollmentService.renewEnrollment(userId, id, months, paymentId);
      
      res.json({
        success: true,
        message: `Gia hạn khóa học thành công thêm ${months} tháng`,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new EnrollmentController();
