const express = require('express');
const router = express.Router();
const levelCertificateController = require('./levelCertificate.controller');
const authMiddleware = require('../../middlewares/auth');
const { authorizeRole } = require('../../middlewares/authorize');

// Public verify endpoint (no authentication required)
router.get(
  '/verify/:certificateId',
  levelCertificateController.verifyLevelCertificate
);

// Download Level Certificate PDF (Requires authentication and Student role)
router.get(
  '/download/:level',
  authMiddleware,
  authorizeRole('student'),
  levelCertificateController.downloadLevelCertificate
);

// Get My Level Certificates (Requires authentication and Student role)
router.get(
  '/my-certificates',
  authMiddleware,
  authorizeRole('student'),
  levelCertificateController.getMyLevelCertificates
);

module.exports = router;
