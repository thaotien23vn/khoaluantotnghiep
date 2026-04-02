const { body, param } = require('express-validator');

/**
 * Payment validation schemas
 */

const createPaymentValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  
  body('provider')
    .optional()
    .isIn(['stripe', 'paypal', 'bank_transfer', 'mock', 'vnpay'])
    .withMessage('Provider không hợp lệ'),
  
  body('amount')
    .optional()
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Số tiền không hợp lệ'),
];

const processPaymentValidation = [
  body('paymentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Payment ID phải là số nguyên dương'),
  
  body('courseId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  
  body('status')
    .optional()
    .isIn(['completed', 'failed'])
    .withMessage('Status phải là completed hoặc failed'),
  
  body('providerTxn')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Transaction ID không hợp lệ'),
];

const getPaymentHistoryValidation = [
  param('courseId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

const getPaymentDetailValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Payment ID phải là số nguyên dương'),
];

// VNPay specific validations
const createVNPayPaymentValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

// Refund validation
const processRefundValidation = [
  body('reason')
    .notEmpty()
    .withMessage('Vui lòng cung cấp lý do hoàn tiền')
    .isLength({ min: 10, max: 500 })
    .withMessage('Lý do hoàn tiền phải từ 10 đến 500 ký tự'),
];

// Stripe verify validation
const stripeVerifyValidation = [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID là bắt buộc')
    .trim()
    .isLength({ min: 10, max: 255 }),
  handleValidationErrors,
];

module.exports = {
  createPaymentValidation,
  processPaymentValidation,
  getPaymentHistoryValidation,
  getPaymentDetailValidation,
  createVNPayPaymentValidation,
  processRefundValidation,
  stripeVerifyValidation,
};
