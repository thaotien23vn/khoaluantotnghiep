const { body, param } = require('express-validator');

/**
 * Attempt validation schemas
 */

const startAttemptValidation = [
  param('quizId')
    .isInt({ min: 1 })
    .withMessage('Quiz ID phải là số nguyên dương'),
];

const submitAttemptValidation = [
  param('attemptId')
    .isInt({ min: 1 })
    .withMessage('Attempt ID phải là số nguyên dương'),
  body('answers')
    .isObject()
    .withMessage('Đáp án phải là object'),
];

const getQuizAttemptsValidation = [
  param('quizId')
    .isInt({ min: 1 })
    .withMessage('Quiz ID phải là số nguyên dương'),
];

const getAttemptValidation = [
  param('attemptId')
    .isInt({ min: 1 })
    .withMessage('Attempt ID phải là số nguyên dương'),
];

const deleteAttemptValidation = [
  param('attemptId')
    .isInt({ min: 1 })
    .withMessage('Attempt ID phải là số nguyên dương'),
];

module.exports = {
  startAttemptValidation,
  submitAttemptValidation,
  getQuizAttemptsValidation,
  getAttemptValidation,
  deleteAttemptValidation,
};
