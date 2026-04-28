const express = require('express');
const router = express.Router();
const certificateController = require('../modules/certificate/certificate.controller');
const authMiddleware = require('../middlewares/auth');
const { authorizeRole } = require('../middlewares/authorize');

// Download Certificate (Requires authentication and Student role)
router.get(
  '/download/:courseId',
  authMiddleware,
  authorizeRole('student'),
  certificateController.downloadCertificate
);

// Get My Certificates (Requires authentication and Student role)
router.get(
  '/my-certificates',
  authMiddleware,
  authorizeRole('student'),
  certificateController.getMyCertificates
);

module.exports = router;
