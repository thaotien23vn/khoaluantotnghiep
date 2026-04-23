const express = require('express');
const paymentController = require('../modules/payment/payment.controller');
const authMiddleware = require('../middlewares/auth');
const { requireStudent, requireAdmin } = require('../middlewares/authorize');
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

// Create payment for single course (direct buy) - Student only
router.post('/create', requireStudent, createPaymentValidation, paymentController.createPayment);

// Create payment from cart - Student only
router.post('/cart', requireStudent, paymentController.createPaymentFromCart);

// Process cart checkout - Student only
router.post('/cart/checkout', requireStudent, paymentController.processCartCheckout);

// Process payment (verify/callback) - Student only
router.post('/process', requireStudent, processPaymentValidation, paymentController.processPayment);

// Verify payment (alias for process with completed status) - Student only
router.post('/verify', requireStudent, processPaymentValidation, paymentController.verifyPayment);

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

// Admin repair endpoint (for old renewal payments) - Admin only
router.post('/admin/repair-renewals', requireAdmin, paymentController.repairRenewalPayments);

// VNPay Routes
// Create VNPay payment URL - Student only
router.post('/vnpay/:courseId', requireStudent, createVNPayPaymentValidation, paymentController.createVNPayPayment);

// Stripe Routes
// Create Stripe Checkout Session (single course - direct payment) - Student only
router.post('/stripe/checkout', requireStudent, paymentController.createStripeCheckout);

// Create Stripe Checkout Session from cart - Student only
router.post('/stripe/checkout/cart', requireStudent, paymentController.createStripeCartCheckout);

// Stripe manual verify (frontend calls this after redirect from Stripe) - Student only
router.post('/stripe/verify', requireStudent, stripeVerifyValidation, paymentController.verifyStripePayment);

// Get payment status by session ID (for frontend to check after Stripe redirect)
router.get('/stripe/status', stripeStatusValidation, paymentController.getPaymentBySession);

// Create Stripe Payment Intent - Student only
router.post('/stripe/create', requireStudent, paymentController.createStripePayment);

// Create Stripe Payment Intent from cart - Student only
router.post('/stripe/cart', requireStudent, paymentController.createStripeCartPayment);

module.exports = router;
