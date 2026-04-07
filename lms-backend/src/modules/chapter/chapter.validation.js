const { param, body } = require('express-validator');

/**
 * Chapter validation schemas
 */

const createChapterValidation = [
  body('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Tiêu đề chương không được để trống')
    .isLength({ min: 2, max: 200 })
    .withMessage('Tiêu đề chương phải có độ dài từ 2 đến 200 ký tự'),
  
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Thứ tự phải là số nguyên không âm'),
];

const updateChapterValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Chapter ID phải là số nguyên dương'),
  
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Tiêu đề chương không được để trống')
    .isLength({ min: 2, max: 200 })
    .withMessage('Tiêu đề chương phải có độ dài từ 2 đến 200 ký tự'),
  
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Thứ tự phải là số nguyên không âm'),
];

const deleteChapterValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Chapter ID phải là số nguyên dương'),
];

module.exports = {
  createChapterValidation,
  updateChapterValidation,
  deleteChapterValidation,
};
