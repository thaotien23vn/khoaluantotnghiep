const { validationResult } = require('express-validator');
const scheduleService = require('./schedule.service');

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
 * Schedule Controller - HTTP request handling
 */
class ScheduleController {
  async getTeacherSchedule(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: teacherId } = req.user;
      const result = await scheduleService.getTeacherSchedule(teacherId, req.query);

      res.json({
        success: true,
        message: 'Lịch giảng dạy của bạn',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getMySchedule(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId } = req.user;
      console.log('[DEBUG] getMySchedule called, userId:', userId, 'query:', req.query);
      const result = await scheduleService.getMySchedule(userId, req.query);

      res.json({
        success: true,
        message: 'Lịch học của bạn',
        data: result,
      });
    } catch (error) {
      console.error('[DEBUG] getMySchedule error:', error);
      handleServiceError(error, res);
    }
  }

  async getNextScheduleEvent(req, res) {
    try {
      const { id: userId } = req.user;
      const result = await scheduleService.getNextScheduleEvent(userId);

      res.json({
        success: true,
        message: 'Sự kiện sắp tới',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async updateScheduleEvent(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { eventId } = req.params;
      const { id: userId, role } = req.user;
      const result = await scheduleService.updateScheduleEvent(eventId, userId, role, req.body);

      res.json({
        success: true,
        message: 'Cập nhật lịch học thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async deleteScheduleEvent(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { eventId } = req.params;
      const { id: userId, role } = req.user;
      const result = await scheduleService.deleteScheduleEvent(eventId, userId, role);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async listCourseScheduleEvents(req, res) {
    try {
      const { courseId } = req.params;
      const { id: userId, role } = req.user;
      const result = await scheduleService.listCourseScheduleEvents(courseId, userId, role);

      res.json({
        success: true,
        message: 'Danh sách lịch học của khóa học',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async createCourseScheduleEvent(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId } = req.params;
      const { id: userId, role } = req.user;
      const result = await scheduleService.createCourseScheduleEvent(courseId, userId, role, req.body);

      res.status(201).json({
        success: true,
        message: 'Tạo lịch học thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  // Student schedule notes
  async createStudentNote(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId } = req.user;
      const result = await scheduleService.createStudentNote(userId, req.body);

      res.status(201).json({
        success: true,
        message: 'Tạo ghi chú thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async updateStudentNote(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { noteId } = req.params;
      const { id: userId } = req.user;
      const result = await scheduleService.updateStudentNote(noteId, userId, req.body);

      res.json({
        success: true,
        message: 'Cập nhật ghi chú thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async deleteStudentNote(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { noteId } = req.params;
      const { id: userId } = req.user;
      const result = await scheduleService.deleteStudentNote(noteId, userId);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new ScheduleController();
