const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Get chat validation
 */
const getChatValidation = [
  param('lessonId')
    .notEmpty()
    .withMessage('lessonId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('lessonId phải là số nguyên dương'),
  query('courseId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit phải từ 1-100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('offset không được âm'),
  handleValidationErrors,
];

/**
 * Get course chat validation
 */
const getCourseChatValidation = [
  param('courseId')
    .notEmpty()
    .withMessage('courseId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit phải từ 1-100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('offset không được âm'),
  handleValidationErrors,
];

/**
 * Send message validation
 */
const sendMessageValidation = [
  param('chatId')
    .notEmpty()
    .withMessage('chatId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('chatId phải là số nguyên dương'),
  body('content')
    .notEmpty()
    .withMessage('Nội dung tin nhắn là bắt buộc')
    .isString()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Nội dung tin nhắn từ 1-2000 ký tự'),
  body('parentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('parentId phải là số nguyên dương'),
  handleValidationErrors,
];

/**
 * Reply message validation (teacher/admin)
 */
const replyMessageValidation = [
  param('chatId')
    .notEmpty()
    .withMessage('chatId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('chatId phải là số nguyên dương'),
  body('content')
    .notEmpty()
    .withMessage('Nội dung trả lời là bắt buộc')
    .isString()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Nội dung trả lời từ 1-2000 ký tự'),
  body('parentId')
    .notEmpty()
    .withMessage('parentId là bắt buộc (phải trả lời 1 tin nhắn)')
    .isInt({ min: 1 })
    .withMessage('parentId phải là số nguyên dương'),
  handleValidationErrors,
];

module.exports = {
  getChatValidation,
  getCourseChatValidation,
  sendMessageValidation,
  replyMessageValidation,
  handleValidationErrors,
};
