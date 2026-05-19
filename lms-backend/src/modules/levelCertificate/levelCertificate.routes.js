const express = require('express');
const router = express.Router();
const levelCertificateController = require('./levelCertificate.controller');
const authMiddleware = require('../../middlewares/auth');
const { authorizeRole } = require('../../middlewares/authorize');

// Public verify endpoint - verify course completion certificate (no authentication required)
// Note: This verifies internal platform achievement only, not official language proficiency
router.get(
  '/verify/:certificateId',
  levelCertificateController.verifyLevelCertificate
);

// Download Course Path Completion Certificate PDF (Requires authentication and Student role)
router.get(
  '/download/:level',
  authMiddleware,
  authorizeRole('student'),
  levelCertificateController.downloadLevelCertificate
);

// Get My Course Path Completion Certificates (Requires authentication and Student role)
router.get(
  '/my-certificates',
  authMiddleware,
  authorizeRole('student'),
  levelCertificateController.getMyLevelCertificates
);

module.exports = router;
