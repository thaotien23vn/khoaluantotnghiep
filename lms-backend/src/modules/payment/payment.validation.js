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
    .isIn(['stripe', 'paypal', 'bank_transfer', 'mock'])
    .withMessage('Provider không hợp lệ'),
  
  body('amount')
    .optional()
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Số tiền không hợp lệ'),
];

const processPaymentValidation = [
  body('paymentId')
    .isInt({ min: 1 })
    .withMessage('Payment ID phải là số nguyên dương'),
  
  body('status')
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

module.exports = {
  createPaymentValidation,
  processPaymentValidation,
  getPaymentHistoryValidation,
  getPaymentDetailValidation,
};
