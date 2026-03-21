const { validationResult } = require('express-validator');
const reviewService = require('./review.service');

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
  console.error('Review error:', error);
  const status = error.status || 500;
  const message = error.message || 'Lỗi máy chủ';
  res.status(status).json({
    success: false,
    message,
    ...(error.errors && { errors: error.errors }),
  });
};

/**
 * Review Controller - HTTP request handling
 */
class ReviewController {
  async createReview(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId } = req.params;
      const result = await reviewService.createReview(req.user.id, courseId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getCourseReviews(req, res) {
    try {
      const { courseId } = req.params;
      const result = await reviewService.getCourseReviews(courseId, req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async updateReview(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { reviewId } = req.params;
      const result = await reviewService.updateReview(req.user.id, reviewId, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async deleteReview(req, res) {
    try {
      const { reviewId } = req.params;
      const isAdmin = req.user.role === 'admin';
      const result = await reviewService.deleteReview(req.user.id, reviewId, isAdmin);
      res.json({ success: true, message: result.message });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
  async getUserReviews(req, res) {
    try {
      const result = await reviewService.getUserReviews(req.user.id, req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getReview(req, res) {
    try {
      const { reviewId } = req.params;
      const result = await reviewService.getReview(reviewId);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getAllReviews(req, res) {
    try {
      const result = await reviewService.getAllReviews(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new ReviewController();
