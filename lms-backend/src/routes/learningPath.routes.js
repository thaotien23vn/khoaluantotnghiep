const express = require('express');
const authMiddleware = require('../middlewares/auth');
const { body, param } = require('express-validator');
const learningPathController = require('../modules/learningPath/learningPath.controller');

const router = express.Router();

/**
 * @route   GET /api/learning-paths
 * @desc    Get all active learning paths
 * @access  Public
 */
router.get('/', learningPathController.getAllPaths);

/**
 * @route   GET /api/learning-paths/my-progress
 * @desc    Get current user's learning path progress
 * @access  Private
 */
router.get('/my-progress', authMiddleware, learningPathController.getMyProgress);

/**
 * @route   POST /api/learning-paths/assign
 * @desc    Assign learning path to user (after placement test)
 * @access  Private
 */
router.post(
  '/assign',
  authMiddleware,
  [
    body('cefrLevel')
      .notEmpty()
      .withMessage('CEFR level là bắt buộc')
      .isIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
      .withMessage('CEFR level không hợp lệ'),
  ],
  learningPathController.assignPath
);

/**
 * @route   GET /api/learning-paths/:pathId
 * @desc    Get single learning path detail with courses
 * @access  Private
 */
router.get(
  '/:pathId',
  authMiddleware,
  [param('pathId').isInt().withMessage('Path ID phải là số')],
  learningPathController.getPathById
);

/**
 * @route   GET /api/learning-paths/enroll-check/:courseId
 * @desc    Check if user can enroll in a course (level prerequisites)
 * @access  Private
 */
router.get(
  '/enroll-check/:courseId',
  authMiddleware,
  [param('courseId').isInt().withMessage('Course ID phải là số')],
  learningPathController.canEnrollCourse
);

/**
 * @route   POST /api/learning-paths/update-progress/:courseId
 * @desc    Update level progress after course completion
 * @access  Private
 */
router.post(
  '/update-progress/:courseId',
  authMiddleware,
  [param('courseId').isInt().withMessage('Course ID phải là số')],
  learningPathController.updateLevelProgress
);

module.exports = router;
