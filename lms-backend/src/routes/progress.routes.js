const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const progressController = require('../modules/progress/progress.controller');
const {
  updateLectureProgressValidation,
  getStudentCourseProgressValidation,
} = require('../modules/progress/progress.validation');

const router = express.Router();

console.log('[Routes] progress.routes.js loaded');

/**
 * @route   PUT /api/progress/lectures/:lectureId
 * @desc    Update lecture progress when watching video
 * @access  Private (Student)
 */
router.put(
  '/lectures/:lectureId',
  authMiddleware,
  authorizeRole('student'),
  updateLectureProgressValidation,
  progressController.updateLectureProgress
);

/**
 * @route   POST /api/progress/lectures/:lectureId
 * @desc    Update lecture progress (for sendBeacon on page close)
 * @access  Private (Student)
 */
router.post(
  '/lectures/:lectureId',
  authMiddleware,
  authorizeRole('student'),
  updateLectureProgressValidation,
  progressController.updateLectureProgress
);

/**
 * @route   GET /api/progress/courses/:courseId
 * @desc    Get student's detailed progress for a course
 * @access  Private (Student)
 */
router.get(
  '/courses/:courseId',
  authMiddleware,
  authorizeRole('student'),
  getStudentCourseProgressValidation,
  progressController.getStudentCourseProgress
);

module.exports = router;
