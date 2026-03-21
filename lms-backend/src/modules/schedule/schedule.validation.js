const { body, param, query } = require('express-validator');

/**
 * Schedule validation schemas
 */

const getMyScheduleValidation = [
  query('courseId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  query('type')
    .optional()
    .isIn(['lesson', 'assignment', 'exam', 'event'])
    .withMessage('Type không hợp lệ'),
  query('status')
    .optional()
    .isIn(['upcoming', 'ongoing', 'completed', 'cancelled'])
    .withMessage('Status không hợp lệ'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page phải là số nguyên dương'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit phải từ 1-100'),
];

const updateScheduleEventValidation = [
  param('eventId')
    .isInt({ min: 1 })
    .withMessage('Event ID phải là số nguyên dương'),
  body('type')
    .optional()
    .isIn(['lesson', 'assignment', 'exam', 'event'])
    .withMessage('Type không hợp lệ'),
  body('status')
    .optional()
    .isIn(['upcoming', 'ongoing', 'completed', 'cancelled'])
    .withMessage('Status không hợp lệ'),
];

const deleteScheduleEventValidation = [
  param('eventId')
    .isInt({ min: 1 })
    .withMessage('Event ID phải là số nguyên dương'),
];

const listCourseScheduleEventsValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

const createScheduleEventValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  body('title')
    .notEmpty()
    .withMessage('Tiêu đề là bắt buộc'),
  body('type')
    .notEmpty()
    .isIn(['lesson', 'assignment', 'exam', 'event'])
    .withMessage('Type không hợp lệ'),
  body('startAt')
    .notEmpty()
    .withMessage('startAt là bắt buộc'),
  body('endAt')
    .notEmpty()
    .withMessage('endAt là bắt buộc'),
];

module.exports = {
  getMyScheduleValidation,
  updateScheduleEventValidation,
  deleteScheduleEventValidation,
  listCourseScheduleEventsValidation,
  createScheduleEventValidation,
};
