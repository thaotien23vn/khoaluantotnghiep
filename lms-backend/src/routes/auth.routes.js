const express = require('express');
const multer = require('multer');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth');
const uploadMedia = require('../middlewares/uploadMedia');
const {
  authLimiter,
  emailVerificationLimiter,
  passwordResetLimiter,
} = require('../middlewares/rateLimiter');
const {
  registerValidation,
  loginValidation,
  verifyEmailValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateCurrentUserValidation,
  resendVerificationValidation,
  checkResetTokenValidation,
} = require('../validators/auth.validator');

const router = express.Router();

// ============= Đăng ký =============
router.post(
  '/register',
  authLimiter, // Rate limit: 5 attempts per 15 minutes
  registerValidation,
  authController.register
);

// ============= Xác nhận email (qua link) =============
router.get('/verify-email/:token', emailVerificationLimiter, authController.verifyEmail);

// ============= Xác nhận email (qua code) =============
router.post('/verify-email-code', emailVerificationLimiter, verifyEmailValidation, authController.verifyEmailByCode);

// ============= Gửi lại email xác nhận =============
router.post('/resend-verification-email', emailVerificationLimiter, resendVerificationValidation, authController.resendVerificationEmail);

// ============= Đăng nhập =============
router.post(
  '/login',
  authLimiter, // Rate limit: 5 attempts per 15 minutes
  loginValidation,
  authController.login
);

// ============= Quên mật khẩu =============
router.post(
  '/forgot-password',
  passwordResetLimiter, // Rate limit: 3 attempts per hour
  forgotPasswordValidation,
  authController.forgotPassword
);

// ============= Đặt lại mật khẩu =============
router.post(
  '/reset-password',
  passwordResetLimiter, // Rate limit: 3 attempts per hour
  resetPasswordValidation,
  authController.resetPassword
);

// ============= Kiểm tra token đặt lại mật khẩu (qua link) =============
// Dùng cho link trong email: GET /api/auth/reset-password/:token
router.get(
  '/reset-password/:token',
  passwordResetLimiter,
  authController.checkResetPasswordToken
);

// ============= Lấy thông tin user hiện tại (yêu cầu token) =============
router.get('/me', authMiddleware, authController.getCurrentUser);

// ============= Cập nhật thông tin user hiện tại (yêu cầu token) =============
router.put(
  '/me',
  authMiddleware,
  updateCurrentUserValidation,
  authController.updateCurrentUser
);

// ============= Upload avatar (image only) =============
router.post(
  '/me/avatar',
  authMiddleware,
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!String(file.mimetype || '').startsWith('image/')) {
        return cb(new Error('Chỉ hỗ trợ upload ảnh'), false);
      }
      cb(null, true);
    },
  }).single('file'),
  authController.uploadAvatar
);

module.exports = router;
