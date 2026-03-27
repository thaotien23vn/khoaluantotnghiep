const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const { body, param } = require('express-validator');
const placementController = require('../modules/placement/placement.controller');

const router = express.Router();

// Validation rules
const startPlacementValidation = [
  body('targetCourseId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('targetCourseId phải là số nguyên dương'),
  body('selfAssessedLevel')
    .optional()
    .isIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'unknown'])
    .withMessage('selfAssessedLevel không hợp lệ'),
];

const submitAnswerValidation = [
  param('sessionId')
    .isInt({ min: 1 })
    .withMessage('sessionId phải là số nguyên dương'),
  body('questionId')
    .isInt({ min: 1 })
    .withMessage('questionId là bắt buộc'),
  body('answer')
    .notEmpty()
    .withMessage('answer là bắt buộc'),
  body('timeSpentSeconds')
    .optional()
    .isInt({ min: 0 })
    .withMessage('timeSpentSeconds phải là số nguyên không âm'),
];

const sessionIdValidation = [
  param('sessionId')
    .isInt({ min: 1 })
    .withMessage('sessionId phải là số nguyên dương'),
];

const quickCheckValidation = [
  body('targetCourseId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('targetCourseId phải là số nguyên dương'),
];

// Routes
// Start placement test (student or guest)
router.post(
  '/student/placement/start',
  authMiddleware,
  authorizeRole('student', 'admin'),
  startPlacementValidation,
  placementController.startSession
);

// Quick check (2-3 questions)
router.post(
  '/student/placement/quick-check',
  authMiddleware,
  authorizeRole('student', 'admin'),
  quickCheckValidation,
  placementController.quickCheck
);

// Get next question
router.get(
  '/student/placement/:sessionId/question',
  authMiddleware,
  authorizeRole('student', 'admin'),
  sessionIdValidation,
  placementController.getNextQuestion
);

// Submit answer
router.post(
  '/student/placement/:sessionId/answer',
  authMiddleware,
  authorizeRole('student', 'admin'),
  submitAnswerValidation,
  placementController.submitAnswer
);

// Complete test manually
router.post(
  '/student/placement/:sessionId/complete',
  authMiddleware,
  authorizeRole('student', 'admin'),
  sessionIdValidation,
  placementController.completeSession
);

// Get result
router.get(
  '/student/placement/:sessionId/result',
  authMiddleware,
  authorizeRole('student', 'admin'),
  sessionIdValidation,
  placementController.getResult
);

module.exports = router;
