const { validationResult } = require('express-validator');
const adminService = require('./admin.service');

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
  console.error('Lỗi admin:', error);
  return res.status(500).json({
    success: false,
    message: 'Lỗi máy chủ',
    error: error.message,
  });
};

/**
 * Admin Controller - HTTP request handling
 */
class AdminController {
  /**
   * Get dashboard statistics
   */
  async getDashboard(req, res) {
    try {
      const result = await adminService.getDashboardStats();
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get all users
   */
  async getUsers(req, res) {
    try {
      const result = await adminService.getUsers();
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Create new user
   */
  async createUser(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await adminService.createUser(req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Update user
   */
  async updateUser(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id } = req.params;
      const result = await adminService.updateUser(id, req.body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Delete user
   */
  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const result = await adminService.deleteUser(id);
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get all payments
   */
  async getPayments(req, res) {
    try {
      const result = await adminService.getPayments(req.query);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Enroll user to course
   */
  async enrollUserToCourse(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { userId, courseId } = req.body;
      const result = await adminService.enrollUserToCourse(userId, courseId, req.user.id);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Unenroll user from course
   */
  async unenrollUserFromCourse(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { userId, courseId } = req.body;
      const result = await adminService.unenrollUserFromCourse(userId, courseId);
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get course enrollments
   */
  async getCourseEnrollments(req, res) {
    try {
      const { courseId } = req.params;
      const result = await adminService.getCourseEnrollments(courseId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get user enrollments
   */
  async getUserEnrollments(req, res) {
    try {
      const { userId } = req.params;
      const result = await adminService.getUserEnrollments(userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get all reviews
   */
  async getReviews(req, res) {
    try {
      const result = await adminService.getReviews(req.query);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Delete review
   */
  async deleteReview(req, res) {
    try {
      const { id } = req.params;
      const result = await adminService.deleteReview(id);
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get all categories
   */
  async getCategoriesAdmin(req, res) {
    try {
      const result = await adminService.getCategories();
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Create category
   */
  async createCategory(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await adminService.createCategory(req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Update category
   */
  async updateCategory(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id } = req.params;
      const result = await adminService.updateCategory(id, req.body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      const result = await adminService.deleteCategory(id);
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new AdminController();
