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

// Stripe Routes
// Create Stripe Checkout Session (single course - direct payment)
router.post('/stripe/checkout', paymentController.createStripeCheckout);

// Create Stripe Checkout Session from cart
router.post('/stripe/checkout/cart', paymentController.createStripeCartCheckout);

// Stripe Checkout success/cancel (no auth required - callback from Stripe)
router.get('/stripe/success', paymentController.handleStripeSuccess);
router.get('/stripe/cancel', paymentController.handleStripeCancel);

// Create Stripe Payment Intent
router.post('/stripe/create', paymentController.createStripePayment);

// Create Stripe Payment Intent from cart
router.post('/stripe/cart', paymentController.createStripeCartPayment);

// Stripe Webhook (no auth required - raw body needed)
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook);

module.exports = router;
