const { body, param, query } = require('express-validator');

/**
 * Review validation schemas
 */

const createReviewValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating phải từ 1-5'),
  body('comment')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Bình luận không quá 1000 ký tự'),
];

const getCourseReviewsValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page phải là số nguyên dương'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit phải từ 1-100'),
];

const updateReviewValidation = [
  param('reviewId')
    .isInt({ min: 1 })
    .withMessage('Review ID phải là số nguyên dương'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating phải từ 1-5'),
  body('comment')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Bình luận không quá 1000 ký tự'),
];

const deleteReviewValidation = [
  param('reviewId')
    .isInt({ min: 1 })
    .withMessage('Review ID phải là số nguyên dương'),
];

const getUserReviewsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page phải là số nguyên dương'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit phải từ 1-100'),
];

const getAllReviewsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page phải là số nguyên dương'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit phải từ 1-100'),
  query('courseId')
    .optional()
    .isInt()
    .withMessage('ID khóa học phải là số nguyên'),
  query('userId')
    .optional()
    .isInt()
    .withMessage('ID người dùng phải là số nguyên'),
  query('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Đánh giá phải từ 1-5'),
];

module.exports = {
  createReviewValidation,
  getCourseReviewsValidation,
  updateReviewValidation,
  deleteReviewValidation,
  getUserReviewsValidation,
  getAllReviewsValidation,
};
