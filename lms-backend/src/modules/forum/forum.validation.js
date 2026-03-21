const { body, param, query } = require('express-validator');

/**
 * Forum validation schemas
 */

const listTopicsValidation = [
  query('type')
    .optional()
    .isIn(['global', 'course', 'lecture'])
    .withMessage('Type không hợp lệ'),
  query('courseId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  query('lectureId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Lecture ID phải là số nguyên dương'),
  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'most_viewed', 'most_posts'])
    .withMessage('Sort không hợp lệ'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page phải là số nguyên dương'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit phải từ 1-100'),
];

const createTopicValidation = [
  body('title')
    .notEmpty()
    .withMessage('Tiêu đề là bắt buộc')
    .isLength({ max: 200 })
    .withMessage('Tiêu đề không được vượt quá 200 ký tự'),
  body('content')
    .notEmpty()
    .withMessage('Nội dung là bắt buộc'),
  body('type')
    .optional()
    .isIn(['global', 'course', 'lecture'])
    .withMessage('Type không hợp lệ'),
  body('courseId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  body('lectureId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Lecture ID phải là số nguyên dương'),
];

const getTopicValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Topic ID phải là số nguyên dương'),
];

const createPostValidation = [
  param('topicId')
    .isInt({ min: 1 })
    .withMessage('Topic ID phải là số nguyên dương'),
  body('content')
    .notEmpty()
    .withMessage('Nội dung là bắt buộc'),
  body('parentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Parent ID phải là số nguyên dương'),
];

const toggleLikeValidation = [
  param('postId')
    .isInt({ min: 1 })
    .withMessage('Post ID phải là số nguyên dương'),
];

const markAsSolutionValidation = [
  param('postId')
    .isInt({ min: 1 })
    .withMessage('Post ID phải là số nguyên dương'),
];

const deleteTopicValidation = [
  param('topicId')
    .isInt({ min: 1 })
    .withMessage('Topic ID phải là số nguyên dương'),
];

const deletePostValidation = [
  param('postId')
    .isInt({ min: 1 })
    .withMessage('Post ID phải là số nguyên dương'),
];

const editTopicValidation = [
  param('topicId')
    .isInt({ min: 1 })
    .withMessage('Topic ID phải là số nguyên dương'),
  body('title')
    .optional()
    .notEmpty()
    .withMessage('Tiêu đề không được để trống')
    .isLength({ max: 200 })
    .withMessage('Tiêu đề không được vượt quá 200 ký tự'),
  body('content')
    .optional()
    .notEmpty()
    .withMessage('Nội dung không được để trống'),
];

const lockTopicValidation = [
  param('topicId')
    .isInt({ min: 1 })
    .withMessage('Topic ID phải là số nguyên dương'),
  body('isLocked')
    .isBoolean()
    .withMessage('isLocked phải là boolean'),
];

const editPostValidation = [
  param('postId')
    .isInt({ min: 1 })
    .withMessage('Post ID phải là số nguyên dương'),
  body('content')
    .notEmpty()
    .withMessage('Nội dung là bắt buộc'),
];

const reportPostValidation = [
  param('postId')
    .isInt({ min: 1 })
    .withMessage('Post ID phải là số nguyên dương'),
  body('reason')
    .notEmpty()
    .withMessage('Lý do là bắt buộc'),
  body('category')
    .optional()
    .isString()
    .withMessage('Category phải là chuỗi'),
];

const reportTopicValidation = [
  param('topicId')
    .isInt({ min: 1 })
    .withMessage('Topic ID phải là số nguyên dương'),
  body('reason')
    .notEmpty()
    .withMessage('Lý do là bắt buộc'),
  body('category')
    .optional()
    .isString()
    .withMessage('Category phải là chuỗi'),
];

const updateReportStatusValidation = [
  param('reportId')
    .isInt({ min: 1 })
    .withMessage('Report ID phải là số nguyên dương'),
  body('status')
    .notEmpty()
    .isIn(['pending', 'resolved', 'rejected'])
    .withMessage('Status không hợp lệ'),
];

const banUserForumValidation = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID phải là số nguyên dương'),
  body('chatBannedUntil')
    .optional()
    .isISO8601()
    .withMessage('chatBannedUntil phải là datetime hợp lệ'),
  body('chatBanReason')
    .optional()
    .isString()
    .withMessage('chatBanReason phải là chuỗi'),
];

module.exports = {
  listTopicsValidation,
  createTopicValidation,
  getTopicValidation,
  createPostValidation,
  toggleLikeValidation,
  markAsSolutionValidation,
  deleteTopicValidation,
  deletePostValidation,
  editTopicValidation,
  lockTopicValidation,
  editPostValidation,
  reportPostValidation,
  reportTopicValidation,
  updateReportStatusValidation,
  banUserForumValidation,
};
