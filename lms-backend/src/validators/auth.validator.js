const { body } = require('express-validator');

/**
 * Validation schemas for authentication endpoints
 * Follows naming convention: "token" = random secure string, "code" = numeric verification
 */

/**
 * Register validation schema
 */
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Tên không được trống')
    .isLength({ min: 2, max: 50 })
    .withMessage('Tên phải có độ dài từ 2 đến 50 ký tự'),
  
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Tên đăng nhập không được trống')
    .isLength({ min: 3, max: 30 })
    .withMessage('Tên đăng nhập phải có độ dài từ 3 đến 30 ký tự')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới'),
  
  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Số điện thoại không hợp lệ')
    .trim(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số'),
  
  // Only allow 'student' role for self-registration
  body('role')
    .optional()
    .equals('student')
    .withMessage('Role không hợp lệ. Người dùng tự đăng ký chỉ có thể là học viên (student).'),
];

/**
 * Login validation schema
 */
const loginValidation = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  
  body('username')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Tên đăng nhập không được trống')
    .isLength({ min: 3, max: 30 })
    .withMessage('Tên đăng nhập phải có độ dài từ 3 đến 30 ký tự'),
  
  body('password')
    .notEmpty()
    .withMessage('Mật khẩu không được trống'),
  
  // Custom validation: either email or username must be provided
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.username) {
      throw new Error('Email hoặc tên đăng nhập phải được cung cấp');
    }
    return true;
  }),
];

/**
 * Email verification validation schema
 */
const verifyEmailValidation = [
  body('token')
    .optional()
    .isLength({ min: 32, max: 64 })
    .withMessage('Token xác nhận không hợp lệ'),
  
  body('code')
    .optional()
    .isNumeric()
    .withMessage('Mã xác nhận phải là số')
    .isLength({ min: 6, max: 6 })
    .withMessage('Mã xác nhận phải có 6 chữ số'),
  
  // Custom validation: either token or code must be provided
  body().custom((value, { req }) => {
    if (!req.body.token && !req.body.code) {
      throw new Error('Token hoặc mã xác nhận phải được cung cấp');
    }
    return true;
  }),
];

/**
 * Forgot password validation schema
 */
const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
];

/**
 * Reset password validation schema
 */
const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token đặt lại mật khẩu không được trống')
    .isLength({ min: 32, max: 64 })
    .withMessage('Token đặt lại mật khẩu không hợp lệ'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số'),
  
  body('confirmPassword')
    .notEmpty()
    .withMessage('Xác nhận mật khẩu không được trống')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Mật khẩu xác nhận không khớp');
      }
      return true;
    }),
];

/**
 * Update current user validation schema
 */
const updateCurrentUserValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Tên không được trống')
    .isLength({ min: 2, max: 50 })
    .withMessage('Tên phải có độ dài từ 2 đến 50 ký tự'),
  
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Số điện thoại không hợp lệ')
    .trim(),
  
  body('avatar')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Avatar không được trống')
    .isURL()
    .withMessage('Avatar phải là một URL hợp lệ'),
];

/**
 * Resend verification email validation schema
 */
const resendVerificationValidation = [
  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
];

/**
 * Check reset password token validation schema
 */
const checkResetTokenValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token không được trống')
    .isLength({ min: 32, max: 64 })
    .withMessage('Token không hợp lệ'),
];

module.exports = {
  registerValidation,
  loginValidation,
  verifyEmailValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateCurrentUserValidation,
  resendVerificationValidation,
  checkResetTokenValidation,
};
