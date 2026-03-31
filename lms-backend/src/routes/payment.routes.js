const express = require('express');
const paymentController = require('../modules/payment/payment.controller');
const authMiddleware = require('../middlewares/auth');
const {
  createPaymentValidation,
  processPaymentValidation,
  getPaymentDetailValidation,
  processRefundValidation,
  createVNPayPaymentValidation,
} = require('../middlewares/payment.validation');

const router = express.Router();

// All payment routes require authentication
router.use(authMiddleware);

// Create payment for single course (direct buy)
router.post('/create', createPaymentValidation, paymentController.createPayment);

// Create payment from cart
router.post('/cart', paymentController.createPaymentFromCart);

// Process cart checkout
router.post('/cart/checkout', paymentController.processCartCheckout);

// Process payment (verify/callback)
router.post('/process', processPaymentValidation, paymentController.processPayment);

// Verify payment (alias for process with completed status)
router.post('/verify', processPaymentValidation, paymentController.verifyPayment);

// Get payment history
router.get('/history', paymentController.getPaymentHistory);

// Get payment detail
router.get('/:paymentId', getPaymentDetailValidation, paymentController.getPaymentDetail);

// Process refund
router.post('/:paymentId/refund', processRefundValidation, paymentController.processRefund);

// VNPay Routes
// Create VNPay payment URL
router.post('/vnpay/:courseId', createVNPayPaymentValidation, paymentController.createVNPayPayment);

// VNPay Return URL (no auth required - callback from VNPay)
router.get('/vnpay/return', paymentController.handleVNPayReturn);

// VNPay IPN (Instant Payment Notification - no auth required)
router.get('/vnpay/ipn', paymentController.handleVNPayIpn);

// MoMo Routes
// Create MoMo payment
router.post('/momo/:courseId', paymentController.createMoMoPayment);

// MoMo Return URL (no auth required - callback from MoMo)
router.get('/momo/return', paymentController.handleMoMoReturn);

// MoMo IPN (Instant Payment Notification - no auth required)
router.post('/momo/ipn', paymentController.handleMoMoIpn);

module.exports = router;
