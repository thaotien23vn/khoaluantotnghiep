const express = require('express');
const paymentController = require('../modules/payment/payment.controller');
const authMiddleware = require('../middlewares/auth');
const {
  createPaymentValidation,
  processPaymentValidation,
  getPaymentDetailValidation,
  processRefundValidation,
  createVNPayPaymentValidation,
  stripeVerifyValidation,
  stripeStatusValidation,
} = require('../middlewares/payment.validation');

const router = express.Router();

// Public callback routes (must NOT require auth)
// VNPay Return URL (callback from VNPay)
router.get('/vnpay/return', paymentController.handleVNPayReturn);

// VNPay IPN (Instant Payment Notification)
router.get('/vnpay/ipn', paymentController.handleVNPayIpn);

// Stripe Checkout success/cancel callbacks
router.get('/stripe/success', paymentController.handleStripeSuccess);
router.get('/stripe/cancel', paymentController.handleStripeCancel);

// Stripe Webhook (raw body required)
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook);

// All remaining payment routes require authentication
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

// Backward-compatible alias: GET /api/student/payments
router.get('/', paymentController.getPaymentHistory);

// Get payment detail
router.get('/:paymentId', getPaymentDetailValidation, paymentController.getPaymentDetail);

// Process refund
router.post('/:paymentId/refund', processRefundValidation, paymentController.processRefund);

// Download invoice
router.get('/:id/invoice', paymentController.downloadInvoice);

// Admin repair endpoint (for old renewal payments)
router.post('/admin/repair-renewals', paymentController.repairRenewalPayments);

// VNPay Routes
// Create VNPay payment URL
router.post('/vnpay/:courseId', createVNPayPaymentValidation, paymentController.createVNPayPayment);

// Stripe Routes
// Create Stripe Checkout Session (single course - direct payment)
router.post('/stripe/checkout', paymentController.createStripeCheckout);

// Create Stripe Checkout Session from cart
router.post('/stripe/checkout/cart', paymentController.createStripeCartCheckout);

// Stripe manual verify (frontend calls this after redirect from Stripe)
router.post('/stripe/verify', stripeVerifyValidation, paymentController.verifyStripePayment);

// Get payment status by session ID (for frontend to check after Stripe redirect)
router.get('/stripe/status', stripeStatusValidation, paymentController.getPaymentBySession);

// Create Stripe Payment Intent
router.post('/stripe/create', paymentController.createStripePayment);

// Create Stripe Payment Intent from cart
router.post('/stripe/cart', paymentController.createStripeCartPayment);

module.exports = router;
