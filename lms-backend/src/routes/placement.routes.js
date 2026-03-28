const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const { placementRateLimiter } = require('../middlewares/rateLimiter');
const { body, param } = require('express-validator');
const placementController = require('../modules/placement/placement.controller');
const placementAnalyticsController = require('../modules/placement/placementAnalytics.controller');
const placementQuestionCron = require('../modules/placement/placementQuestion.cron');
const logger = require('../utils/logger');

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
  placementRateLimiter,
  submitAnswerValidation,
  placementController.submitAnswer
);

// Skip a question
router.post(
  '/student/placement/:sessionId/skip',
  authMiddleware,
  authorizeRole('student', 'admin'),
  placementRateLimiter,
  sessionIdValidation,
  placementController.skipQuestion
);

// Get test progress
router.get(
  '/student/placement/:sessionId/progress',
  authMiddleware,
  authorizeRole('student', 'admin'),
  sessionIdValidation,
  placementController.getProgress
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

// Check retake eligibility
router.get(
  '/student/placement/retake-eligibility',
  authMiddleware,
  authorizeRole('student', 'admin'),
  placementController.checkRetakeEligibility
);

// Get placement history
router.get(
  '/student/placement/history',
  authMiddleware,
  authorizeRole('student', 'admin'),
  placementController.getUserPlacementHistory
);

// Admin: Get question bank statistics
router.get(
  '/admin/placement/question-bank/stats',
  authMiddleware,
  authorizeRole('admin'),
  async (req, res, next) => {
    try {
      const stats = await placementQuestionGenerator.getBankStatistics();
      res.json({
        success: true,
        data: stats,
      });
    } catch (err) {
      logger.error('PLACEMENT_STATS_ERROR', { error: err.message });
      next(err);
    }
  }
);

// Admin: Trigger batch generation manually
router.post(
  '/admin/placement/question-bank/generate',
  authMiddleware,
  authorizeRole('admin'),
  async (req, res, next) => {
    try {
      const results = await placementQuestionCron.runNow();
      res.json({
        success: true,
        data: results,
      });
    } catch (err) {
      logger.error('PLACEMENT_MANUAL_GENERATE_ERROR', { error: err.message });
      next(err);
    }
  }
);

// ====================
// ADMIN MANAGEMENT ROUTES
// ====================

// Admin: Get user placement history
router.get(
  '/admin/placement/user/:userId/history',
  authMiddleware,
  authorizeRole('admin'),
  placementController.adminGetUserHistory
);

// Admin: Reset cooldown for user
router.post(
  '/admin/placement/user/:userId/reset-cooldown',
  authMiddleware,
  authorizeRole('admin'),
  placementController.adminResetCooldown
);

// Admin: Delete a placement session
router.delete(
  '/admin/placement/session/:sessionId',
  authMiddleware,
  authorizeRole('admin'),
  placementController.adminDeleteSession
);

// ====================
// ANALYTICS ROUTES
// ====================

// Admin: Get comprehensive dashboard report
router.get(
  '/admin/placement/analytics/dashboard',
  authMiddleware,
  authorizeRole('admin'),
  placementAnalyticsController.getDashboard
);

// Admin: Get overall statistics
router.get(
  '/admin/placement/analytics/stats',
  authMiddleware,
  authorizeRole('admin'),
  placementAnalyticsController.getOverallStats
);

// Admin: Get level distribution
router.get(
  '/admin/placement/analytics/levels',
  authMiddleware,
  authorizeRole('admin'),
  placementAnalyticsController.getLevelDistribution
);

// Admin: Get skill performance
router.get(
  '/admin/placement/analytics/skill-performance',
  authMiddleware,
  authorizeRole('admin'),
  placementAnalyticsController.getSkillPerformance
);

// Admin: Get most difficult questions
router.get(
  '/admin/placement/analytics/difficult-questions',
  authMiddleware,
  authorizeRole('admin'),
  placementAnalyticsController.getDifficultQuestions
);

// Admin: Get question bank usage stats
router.get(
  '/admin/placement/analytics/question-bank',
  authMiddleware,
  authorizeRole('admin'),
  placementAnalyticsController.getQuestionBankStats
);

// Admin: Get completion trends
router.get(
  '/admin/placement/analytics/trends',
  authMiddleware,
  authorizeRole('admin'),
  placementAnalyticsController.getTrends
);

module.exports = router;
