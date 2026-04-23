const express = require('express');
const router = express.Router();
const trackingController = require('../modules/tracking/tracking.controller');
const authMiddleware = require('../middlewares/auth');
const { authorizeRole } = require('../middlewares/authorize');

// POST /api/tracking/log - Log a tracking activity (public but auth optional)
router.post('/log', authMiddleware, trackingController.logActivity);

// GET /api/tracking/analytics - Get analytics (admin only)
router.get(
  '/analytics',
  authMiddleware,
  authorizeRole('admin'),
  trackingController.getAnalytics
);

// GET /api/tracking/user-activities - Get current user activities
router.get(
  '/user-activities',
  authMiddleware,
  trackingController.getUserActivities
);

// DELETE /api/tracking/clean - Clean old data (admin only)
router.delete(
  '/clean',
  authMiddleware,
  authorizeRole('admin'),
  trackingController.cleanOldData
);

module.exports = router;
