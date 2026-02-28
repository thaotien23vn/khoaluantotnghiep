const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

// ============= Đăng ký =============
router.post(
  '/register',
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
    body('role')
      .optional()
      .isIn(['student', 'teacher', 'admin'])
      .withMessage('Role không hợp lệ'),
  ],
  authController.register
);

// ============= Xác nhận email (qua link) =============
router.get('/verify-email/:token', authController.verifyEmail);

// ============= Xác nhận email (qua code) =============
router.post('/verify-email-code', authController.verifyEmailByCode);

// ============= Gửi lại email xác nhận =============
router.post('/resend-verification-email', authController.resendVerificationEmail);

// ============= Đăng nhập =============
router.post(
  '/login',
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
  [body('email').isEmail().withMessage('Email không hợp lệ')],
  authController.forgotPassword
);

// ============= Đặt lại mật khẩu =============
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token không được trống'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
    body('confirmPassword').notEmpty().withMessage('Xác nhận mật khẩu không được trống'),
  ],
  authController.resetPassword
);

// ============= Lấy thông tin user hiện tại (yêu cầu token) =============
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router;
