/**
 * Rate limiting middleware
 * Prevents brute force attacks on authentication endpoints
 */

const rateLimit = require('express-rate-limit');

// General API rate limit: 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limit for authentication: 10 attempts per 15 minutes (increased for development)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Quá nhiều lần đăng nhập không thành công, vui lòng thử lại sau 15 phút',
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict limit for email verification: 10 attempts per hour (increased for development)
const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Quá nhiều lần xác nhận email, vui lòng thử lại sau 1 giờ',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset limit: 3 attempts per hour
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    message: 'Quá nhiều lần yêu cầu đặt lại mật khẩu, vui lòng thử lại sau 1 giờ',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  emailVerificationLimiter,
  passwordResetLimiter,
};
