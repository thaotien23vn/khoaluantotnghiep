const { validationResult } = require('express-validator');
const paymentService = require('./payment.service');

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
  console.error('Lỗi thanh toán:', error);
  return res.status(500).json({
    success: false,
    message: 'Lỗi máy chủ',
    error: error.message,
  });
};

/**
 * Payment Controller - HTTP request handling
 */
class PaymentController {
  /**
   * Create payment for a course
   */
  async createPayment(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId } = req.params;
      const { id: userId } = req.user;
      const result = await paymentService.createPayment(userId, courseId, req.body);
      
      const statusCode = result.isNew ? 201 : 200;
      const message = result.isNew 
        ? 'Tạo giao dịch thanh toán thành công' 
        : 'Giao dịch thanh toán đang chờ xử lý';

      res.status(statusCode).json({
        success: true,
        message,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Process payment callback (success/failure)
   * Also handles creating payment if courseId is provided
   */
  async processPayment(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId } = req.user;
      const result = await paymentService.processPayment(userId, req.body);
      
      const statusCode = result.isNew ? 201 : 200;
      const message = result.payment.status === 'completed'
        ? 'Thanh toán thành công và đã ghi danh khóa học'
        : 'Thanh toán thất bại';

      res.status(statusCode).json({
        success: true,
        message,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(req, res) {
    try {
      const { id: userId } = req.user;
      const result = await paymentService.getPaymentHistory(userId, req.query);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get payment detail
   */
  async getPaymentDetail(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id } = req.params;
      const { id: userId } = req.user;
      const result = await paymentService.getPaymentDetail(id, userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get payment detail (alias for backward compatibility - uses :paymentId param)
   */
  async getPayment(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { paymentId } = req.params;
      const { id: userId } = req.user;
      const result = await paymentService.getPaymentDetail(paymentId, userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Verify payment (alias for processPayment - backward compatibility)
   */
  async verifyPayment(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId } = req.user;
      // Map verify to process with completed status
      const processData = {
        ...req.body,
        status: 'completed',
      };
      const result = await paymentService.processPayment(userId, processData);

      res.json({
        success: true,
        message: 'Thanh toán xác nhận thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new PaymentController();
