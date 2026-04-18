const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const progressController = require('../modules/progress/progress.controller');
const {
  updateLectureProgressValidation,
  getStudentCourseProgressValidation,
  getLastAccessedLectureValidation,
  getCertificateEligibilityValidation,
} = require('../modules/progress/progress.validation');

const router = express.Router();

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

/**
 * @route   GET /api/progress/courses/:courseId/continue
 * @desc    Get last accessed lecture for a course (Continue Learning)
 * @access  Private (Student)
 */
router.get(
  '/courses/:courseId/continue',
  authMiddleware,
  authorizeRole('student'),
  getLastAccessedLectureValidation,
  progressController.getLastAccessedLecture
);

/**
 * @route   GET /api/progress/courses/:courseId/certificate
 * @desc    Get certificate eligibility (100% completion check)
 * @access  Private (Student)
 */
router.get(
  '/courses/:courseId/certificate',
  authMiddleware,
  authorizeRole('student'),
  getCertificateEligibilityValidation,
  progressController.getCertificateEligibility
);


/**
 * @route   GET /api/progress/dashboard
 * @desc    Get student dashboard summary (enrollments, progress, quizzes, streak)
 * @access  Private (Student)
 */
router.get(
  '/dashboard',
  authMiddleware,
  authorizeRole('student'),
  progressController.getStudentDashboard
);

module.exports = router;
