/**
 * Rate limiting middleware
 * Prevents brute force attacks on authentication endpoints
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

// General API rate limit: 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProd ? 300 : 500,
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
  max: isProd ? 20 : 100,
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
  max: isProd ? 5 : 10,
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
  max: isProd ? 3 : 5,
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
  placementRateLimiter: rateLimit({
    windowMs: 10000, // 10 seconds
    max: 5, // 5 requests per 10 seconds
    message: {
      success: false,
      message: 'Quá nhiều yêu cầu placement test, vui lòng thử lại sau',
    },
    handler: (req, res) => {
      logger.warn('RATE_LIMIT_PLACEMENT', {
        ip: req.ip,
        userId: req.user?.id,
        method: req.method,
        path: req.path,
      });
      res.status(429).json({
        success: false,
        message: 'Quá nhiều yêu cầu placement test, vui lòng thử lại sau',
      });
    },
  }),
};
