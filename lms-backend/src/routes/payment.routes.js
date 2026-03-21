const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const paymentController = require('../modules/payment/payment.controller');
const { body, query } = require('express-validator');

const router = express.Router();

// Payment validation rules
const paymentValidation = [
  body('courseId').isInt().withMessage('ID khóa học phải là số nguyên'),
  body('paymentMethod').isIn(['stripe', 'paypal', 'bank_transfer', 'mock']).withMessage('Phương thức thanh toán không hợp lệ'),
  body('paymentDetails').optional().isObject().withMessage('Chi tiết thanh toán phải là object')
];

const verificationValidation = [
  body('paymentId').isInt().withMessage('ID thanh toán phải là số nguyên'),
  body('verificationData').optional().isObject().withMessage('Dữ liệu xác thực phải là object')
];

/**
 * @route   POST /api/student/payments/process
 * @desc    Process payment for course enrollment
 * @access  Private (Student & Admin)
 */
router.post(
  '/process',
  authMiddleware,
  authorizeRole('student', 'admin'),
  paymentValidation,
  paymentController.processPayment
);

/**
 * @route   POST /api/student/payments/verify
 * @desc    Verify payment and complete enrollment
 * @access  Private (Student & Admin)
 */
router.post(
  '/verify',
  authMiddleware,
  authorizeRole('student', 'admin'),
  verificationValidation,
  paymentController.verifyPayment
);

/**
 * @route   GET /api/student/payments
 * @desc    Get payment history
 * @access  Private (Student & Admin)
 */
router.get(
  '/',
  authMiddleware,
  authorizeRole('student', 'admin'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Trang phải là số nguyên dương'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Giới hạn phải là số nguyên từ 1-100'),
    query('status').optional().isIn(['pending', 'completed', 'failed', 'cancelled']).withMessage('Trạng thái không hợp lệ')
  ],
  paymentController.getPaymentHistory
);

/**
 * @route   GET /api/student/payments/:paymentId
 * @desc    Get payment details
 * @access  Private (Student & Admin)
 */
router.get(
  '/:paymentId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  paymentController.getPayment
);

module.exports = router;
