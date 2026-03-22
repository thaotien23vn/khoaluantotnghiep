const { query } = require('express-validator');

/**
 * Teacher Statistics validation schemas
 */

const getTeacherStatisticsValidation = [
  query('courseId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

module.exports = {
  getTeacherStatisticsValidation,
};
