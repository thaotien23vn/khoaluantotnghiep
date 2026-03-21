const { validationResult } = require('express-validator');
const courseService = require('./course.service');

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
 * Course Controller - HTTP request handling
 */
class CourseController {
  /**
   * Get published courses (public)
   */
  async getPublishedCourses(req, res) {
    try {
      const result = await courseService.getPublishedCourses(req.query);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get course detail (public)
   */
  async getCourseDetail(req, res) {
    try {
      const { id } = req.params;
      const course = await courseService.getCourseDetail(id);
      res.json({
        success: true,
        data: { course },
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get my courses (teacher/admin)
   */
  async getMyCourses(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId, role } = req.user;
      const result = await courseService.getMyCourses(userId, role, req.query);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Create a new course
   */
  async createCourse(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId, role, name, username } = req.user;
      const result = await courseService.createCourse(userId, role, { name, username }, req.body);
      res.status(201).json({
        success: true,
        message: 'Tạo khóa học thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get course for owner
   */
  async getCourseForOwner(req, res) {
    try {
      const { id } = req.params;
      const { id: userId, role } = req.user;
      const result = await courseService.getCourseForOwner(id, userId, role);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Update a course
   */
  async updateCourse(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id } = req.params;
      const { id: userId, role } = req.user;
      const result = await courseService.updateCourse(id, userId, role, req.body);
      res.json({
        success: true,
        message: 'Cập nhật khóa học thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Delete a course
   */
  async deleteCourse(req, res) {
    try {
      const { id } = req.params;
      const { id: userId, role } = req.user;
      const result = await courseService.deleteCourse(id, userId, role);
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Set course published status
   */
  async setCoursePublished(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id } = req.params;
      const { id: userId, role } = req.user;
      const { published } = req.body;
      const result = await courseService.setCoursePublished(id, userId, role, published);
      res.json({
        success: true,
        message: result.message,
        data: { course: result.course },
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get course enrollments
   */
  async getCourseEnrollmentsForOwner(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId } = req.params;
      const { id: userId, role } = req.user;
      const result = await courseService.getCourseEnrollments(courseId, userId, role);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get course content for owner
   */
  async getCourseContentForOwner(req, res) {
    try {
      const { courseId } = req.params;
      const { id: userId, role } = req.user;
      const result = await courseService.getCourseContentForOwner(courseId, userId, role);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new CourseController();
