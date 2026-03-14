const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth');
const uploadMedia = require('../middlewares/uploadMedia');
const {
  authLimiter,
  emailVerificationLimiter,
  passwordResetLimiter,
} = require('../middlewares/rateLimiter');

const router = express.Router();

// ============= Đăng ký =============
router.post(
  '/register',
  authLimiter, // Rate limit: 5 attempts per 15 minutes
  [
    body('name').trim().notEmpty().withMessage('Tên không được trống'),
    body('username').trim().notEmpty().withMessage('Tên đăng nhập không được trống'),
    body('email').isEmail().withMessage('Email không hợp lệ'),
    body('phone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Số điện thoại không hợp lệ'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
    // Người dùng tự đăng ký chỉ được là học viên.
    // Nếu gửi role khác 'student' -> reject để tránh tự nâng quyền.
    body('role')
      .optional()
      .equals('student')
      .withMessage('Role không hợp lệ. Người dùng tự đăng ký chỉ có thể là học viên (student).'),
  ],
  authController.register
);

// ============= Xác nhận email (qua link) =============
router.get('/verify-email/:token', emailVerificationLimiter, authController.verifyEmail);

// ============= Xác nhận email (qua code) =============
router.post('/verify-email-code', emailVerificationLimiter, authController.verifyEmailByCode);

// ============= Gửi lại email xác nhận =============
router.post('/resend-verification-email', emailVerificationLimiter, authController.resendVerificationEmail);

// ============= Đăng nhập =============
router.post(
  '/login',
  authLimiter, // Rate limit: 5 attempts per 15 minutes
  [
    body('email')
      .optional()
      .isEmail()
      .withMessage('Email không hợp lệ'),
    body('username')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Tên đăng nhập không được trống'),
    body('password').notEmpty().withMessage('Mật khẩu không được trống'),
    body().custom(body => {
      if (!body.email && !body.username) {
        throw new Error('Email hoặc tên đăng nhập phải được cung cấp');
      }
      return true;
    }),
  ],
  authController.login
);

// ============= Quên mật khẩu =============
router.post(
  '/forgot-password',
  passwordResetLimiter, // Rate limit: 3 attempts per hour
  [body('email').isEmail().withMessage('Email không hợp lệ')],
  authController.forgotPassword
);

// ============= Đặt lại mật khẩu =============
router.post(
  '/reset-password',
  passwordResetLimiter, // Rate limit: 3 attempts per hour
  [
    body('token').notEmpty().withMessage('Token không được trống'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
    body('confirmPassword').notEmpty().withMessage('Xác nhận mật khẩu không được trống'),
  ],
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
  [
    body('name').optional().trim().notEmpty().withMessage('Tên không được trống'),
    body('phone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Số điện thoại không hợp lệ'),
    body('avatar').optional().trim().notEmpty().withMessage('Avatar không hợp lệ'),
  ],
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

// ============= Google OAuth =============
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleAuthCallback);

module.exports = router;
