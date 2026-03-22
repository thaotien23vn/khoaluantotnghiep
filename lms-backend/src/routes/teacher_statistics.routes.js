const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const teacherStatsController = require('../modules/teacher_statistics/teacher_statistics.controller');
const {
  getTeacherStatisticsValidation,
} = require('../modules/teacher_statistics/teacher_statistics.validation');

const router = express.Router();

/**
 * @route   GET /api/teacher/statistics
 * @desc    Get detailed statistics for teacher dashboard
 * @access  Private (Teacher & Admin)
 */
router.get(
  '/statistics',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  getTeacherStatisticsValidation,
  teacherStatsController.getTeacherDetailedStatistics
);

module.exports = router;
