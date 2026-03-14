const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const teacherStatsController = require('../controllers/teacher_statistics.controller');

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
  teacherStatsController.getTeacherDetailedStatistics
);

module.exports = router;
