const { body, param, query } = require('express-validator');

/**
 * Admin validation schemas
 */

const createUserValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username là bắt buộc'),
  
  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password là bắt buộc'),
  
  body('role')
    .optional()
    .isIn(['student', 'teacher'])
    .withMessage('Role phải là student hoặc teacher'),
];

const updateUserValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID phải là số nguyên dương'),
  
  body('role')
    .optional()
    .isIn(['student', 'teacher'])
    .withMessage('Role phải là student hoặc teacher'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive phải là boolean'),
  
  body('newPassword')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password mới phải có ít nhất 6 ký tự'),
];

const deleteUserValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID phải là số nguyên dương'),
];

const getPaymentsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page phải là số nguyên dương'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit phải là số nguyên từ 1-100'),
  
  query('status')
    .optional()
    .isIn(['pending', 'completed', 'failed', 'cancelled'])
    .withMessage('Status không hợp lệ'),
  
  query('provider')
    .optional()
    .isIn(['stripe', 'paypal', 'bank_transfer', 'mock'])
    .withMessage('Provider không hợp lệ'),
];

const enrollUserValidation = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID phải là số nguyên dương'),
  
  body('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

const unenrollUserValidation = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID phải là số nguyên dương'),
  
  body('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

const getCourseEnrollmentsValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

const getUserEnrollmentsValidation = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID phải là số nguyên dương'),
];

const getReviewsValidation = [
  query('courseId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

const deleteReviewValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Review ID phải là số nguyên dương'),
];

const createCategoryValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Tên category là bắt buộc')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên category phải có độ dài từ 2 đến 100 ký tự'),
  
  body('menuSection')
    .optional()
    .trim(),
];

const updateCategoryValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Category ID phải là số nguyên dương'),
  
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Tên category không được để trống')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên category phải có độ dài từ 2 đến 100 ký tự'),
  
  body('menuSection')
    .optional()
    .trim(),
];

const deleteCategoryValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Category ID phải là số nguyên dương'),
];

module.exports = {
  createUserValidation,
  updateUserValidation,
  deleteUserValidation,
  getPaymentsValidation,
  enrollUserValidation,
  unenrollUserValidation,
  getCourseEnrollmentsValidation,
  getUserEnrollmentsValidation,
  getReviewsValidation,
  deleteReviewValidation,
  createCategoryValidation,
  updateCategoryValidation,
  deleteCategoryValidation,
};
