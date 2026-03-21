const { body, param, query } = require('express-validator');

/**
 * Notification validation schemas
 */

const getNotificationsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page phải là số nguyên dương'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit phải từ 1-100'),
  query('type')
    .optional()
    .isString()
    .withMessage('Type phải là chuỗi'),
  query('read')
    .optional()
    .isBoolean()
    .withMessage('Read phải là boolean'),
];

const markAsReadValidation = [
  param('notificationId')
    .isInt({ min: 1 })
    .withMessage('Notification ID phải là số nguyên dương'),
];

const deleteNotificationValidation = [
  param('notificationId')
    .isInt({ min: 1 })
    .withMessage('Notification ID phải là số nguyên dương'),
];

const sendNotificationValidation = [
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('userIds phải là mảng không rỗng'),
  body('userIds.*')
    .isInt({ min: 1 })
    .withMessage('Mỗi userId phải là số nguyên dương'),
  body('title')
    .notEmpty()
    .withMessage('Tiêu đề là bắt buộc'),
  body('message')
    .notEmpty()
    .withMessage('Nội dung là bắt buộc'),
  body('type')
    .optional()
    .isString()
    .withMessage('Type phải là chuỗi'),
];

module.exports = {
  getNotificationsValidation,
  markAsReadValidation,
  deleteNotificationValidation,
  sendNotificationValidation,
};
