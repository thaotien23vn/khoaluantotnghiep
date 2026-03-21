const { body, param } = require('express-validator');

/**
 * Enrollment validation schemas
 */

const enrollCourseValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

const unenrollCourseValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

const getEnrollmentByCourseValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

const updateProgressValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  
  body('progressPercent')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Tiến độ phải là số từ 0 đến 100'),
];

module.exports = {
  enrollCourseValidation,
  unenrollCourseValidation,
  getEnrollmentByCourseValidation,
  updateProgressValidation,
};
