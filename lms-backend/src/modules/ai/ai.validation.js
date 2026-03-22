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
 * Student AI Conversation Validation
 */
const createStudentConversationValidation = [
  body('courseId')
    .notEmpty()
    .withMessage('courseId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  body('lectureId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('lectureId phải là số nguyên dương'),
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Tiêu đề tối đa 200 ký tự'),
  handleValidationErrors,
];

/**
 * Student AI Message Validation
 */
const sendStudentMessageValidation = [
  param('id')
    .notEmpty()
    .withMessage('conversationId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('conversationId phải là số nguyên dương'),
  body('message')
    .notEmpty()
    .withMessage('message là bắt buộc')
    .isString()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message phải từ 1-2000 ký tự'),
  handleValidationErrors,
];

/**
 * Teacher Lecture AI Notes Validation
 */
const updateTeacherLectureAiNotesValidation = [
  param('id')
    .notEmpty()
    .withMessage('lectureId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('lectureId phải là số nguyên dương'),
  body('aiNotes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('aiNotes tối đa 5000 ký tự'),
  handleValidationErrors,
];

/**
 * Teacher Ingest Lecture Validation
 */
const ingestTeacherLectureValidation = [
  param('lectureId')
    .notEmpty()
    .withMessage('lectureId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('lectureId phải là số nguyên dương'),
  handleValidationErrors,
];

/**
 * Admin AI Settings Validation
 */
const upsertAdminAiSettingsValidation = [
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('enabled phải là boolean'),
  body('provider')
    .optional()
    .isString()
    .trim()
    .isIn(['gemini', 'openai'])
    .withMessage('provider phải là gemini hoặc openai'),
  body('model')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Model tối đa 100 ký tự'),
  handleValidationErrors,
];

/**
 * Admin AI Policy Validation
 */
const createAdminAiPolicyValidation = [
  body('role')
    .notEmpty()
    .withMessage('role là bắt buộc')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('role phải từ 1-50 ký tự'),
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('enabled phải là boolean'),
  body('dailyLimit')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('dailyLimit phải từ 1-10000'),
  body('maxOutputTokens')
    .optional()
    .isInt({ min: 1, max: 8192 })
    .withMessage('maxOutputTokens phải từ 1-8192'),
  body('ragTopK')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('ragTopK phải từ 1-20'),
  handleValidationErrors,
];

/**
 * Admin Prompt Template Validation
 */
const createAdminPromptTemplateValidation = [
  body('key')
    .notEmpty()
    .withMessage('key là bắt buộc')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('key phải từ 1-100 ký tự'),
  body('template')
    .notEmpty()
    .withMessage('template là bắt buộc')
    .isString()
    .trim()
    .isLength({ min: 10, max: 10000 })
    .withMessage('template phải từ 10-10000 ký tự'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive phải là boolean'),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  createStudentConversationValidation,
  sendStudentMessageValidation,
  updateTeacherLectureAiNotesValidation,
  ingestTeacherLectureValidation,
  upsertAdminAiSettingsValidation,
  createAdminAiPolicyValidation,
  createAdminPromptTemplateValidation,
};
