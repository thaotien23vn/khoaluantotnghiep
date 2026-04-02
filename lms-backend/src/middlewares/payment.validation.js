const { body, param, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Payment validation rules
 */
const createPaymentValidation = [
  body('courseId')
    .notEmpty()
    .withMessage('Course ID là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Số tiền phải >= 0'),
  body('currency')
    .optional()
    .isIn(['VND', 'USD'])
    .withMessage('Currency phải là VND hoặc USD'),
  body('provider')
    .optional()
    .isIn(['stripe', 'paypal', 'bank_transfer', 'mock', 'vnpay'])
    .withMessage('Provider không hợp lệ'),
  handleValidationErrors,
];

const processPaymentValidation = [
  body('paymentId')
    .notEmpty()
    .withMessage('Payment ID là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('Payment ID phải là số nguyên dương'),
  body('status')
    .optional()
    .isIn(['pending', 'completed', 'failed', 'cancelled', 'refunded'])
    .withMessage('Status không hợp lệ'),
  handleValidationErrors,
];

const getPaymentDetailValidation = [
  param('paymentId')
    .isInt({ min: 1 })
    .withMessage('Payment ID phải là số nguyên dương'),
  handleValidationErrors,
];

const getPaymentHistoryValidation = [
  param('courseId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  handleValidationErrors,
];

const processRefundValidation = [
  param('paymentId')
    .isInt({ min: 1 })
    .withMessage('Payment ID phải là số nguyên dương'),
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Lý do hoàn tiền không được vượt quá 500 ký tự'),
  handleValidationErrors,
];

const createVNPayPaymentValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  handleValidationErrors,
];

const stripeVerifyValidation = [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID là bắt buộc')
    .trim()
    .isLength({ min: 10, max: 255 }),
  handleValidationErrors,
];

const stripeStatusValidation = [
  query('session_id')
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
  processRefundValidation,
  createVNPayPaymentValidation,
  stripeVerifyValidation,
  handleValidationErrors,
};
