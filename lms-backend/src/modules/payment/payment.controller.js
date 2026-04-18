const { validationResult } = require('express-validator');
const paymentService = require('./payment.service');
const stripeService = require('../../services/stripe.service');
const db = require('../../models');
const logger = require('../../utils/logger');
const { Payment, Course, User } = db.models;
/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array(),
    });
  }
  return null;
};

/**
 * Handle service errors
 */
const handleServiceError = (error, res) => {
  if (error.status && error.message) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
  logger.error('PAYMENT_CONTROLLER_ERROR', { error: error.message, stack: error.stack });
  return res.status(500).json({
    success: false,
    message: 'Lỗi máy chủ',
    error: error.message,
    stack: error.stack,
  });
};

/**
 * Payment Controller - HTTP request handling
 */
class PaymentController {
  /**
   * Create payment for a course
   */
  async createPayment(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId, provider, type, renewalPrice, enrollmentId, renewalMonths } = req.body;
      const { id: userId } = req.user;
      const isRenewal = type === 'renewal';

      let result;
      if (provider === 'vnpay') {
        const ipAddr = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        result = await paymentService.createVNPayPayment(
          userId,
          courseId,
          ipAddr,
          isRenewal,
          renewalPrice,
          enrollmentId,
          renewalMonths
        );
        return res.status(201).json({
          success: true,
          message: 'Tạo URL thanh toán VNPay thành công',
          data: result,
        });
      }
      
      result = await paymentService.createPayment(userId, courseId, req.body);
      
      const statusCode = result.isNew ? 201 : 200;
      const message = result.isNew 
        ? 'Tạo giao dịch thanh toán thành công' 
        : 'Giao dịch thanh toán đang chờ xử lý';

      res.status(statusCode).json({
        success: true,
        message,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Process payment callback (success/failure)
   * Also handles creating payment if courseId is provided
   */
  async processPayment(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId } = req.user;
      const result = await paymentService.processPayment(userId, req.body);
      
      const statusCode = result.isNew ? 201 : 200;
      const message = result.payment.status === 'completed'
        ? 'Thanh toán thành công và đã ghi danh khóa học'
        : 'Thanh toán thất bại';

      res.status(statusCode).json({
        success: true,
        message,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(req, res) {
    try {
      const { id: userId } = req.user;
      const result = await paymentService.getPaymentHistory(userId, req.query);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get payment detail
   */
  async getPaymentDetail(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id } = req.params;
      const { id: userId } = req.user;
      const result = await paymentService.getPaymentDetail(id, userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get payment detail (alias for backward compatibility - uses :paymentId param)
   */
  async getPayment(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { paymentId } = req.params;
      const { id: userId } = req.user;
      const result = await paymentService.getPaymentDetail(paymentId, userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Create payment from cart
   */
  async createPaymentFromCart(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId } = req.user;
      const { selectedItems } = req.body;
      
      const result = await paymentService.createPaymentFromCart(userId, selectedItems);
      
      res.status(201).json({
        success: true,
        message: `Đã tạo ${result.payments.length} giao dịch thanh toán từ giỏ hàng`,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Process cart checkout
   */
  async processCartCheckout(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId } = req.user;
      const result = await paymentService.processPayment(userId, { cartCheckout: true });
      
      const successfulCount = result.summary.successful;
      const failedCount = result.summary.failed;
      
      let message;
      if (successfulCount > 0 && failedCount === 0) {
        message = `Thanh toán thành công ${successfulCount} khóa học`;
      } else if (successfulCount > 0 && failedCount > 0) {
        message = `Thanh toán ${successfulCount}/${result.summary.total} khóa học thành công, ${failedCount} thất bại`;
      } else {
        message = 'Tất cả thanh toán thất bại';
      }

      res.json({
        success: successfulCount > 0,
        message,
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Process refund for a payment
   */
  async processRefund(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { paymentId } = req.params;
      const { id: userId } = req.user;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp lý do hoàn tiền',
        });
      }

      const result = await paymentService.processRefund(userId, paymentId, reason);
      
      res.json({
        success: result.refund.success,
        message: result.refund.success ? 'Hoàn tiền thành công' : 'Hoàn tiền thất bại',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Create VNPay payment URL
   */
  async createVNPayPayment(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId } = req.params;
      const { id: userId } = req.user;
      const { type, renewalPrice, enrollmentId, renewalMonths } = req.body || {};
      const isRenewal = type === 'renewal';
      const ipAddr = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      const result = await paymentService.createVNPayPayment(
        userId,
        courseId,
        ipAddr,
        isRenewal,
        renewalPrice,
        enrollmentId,
        renewalMonths
      );
      
      res.status(201).json({
        success: true,
        message: 'Tạo URL thanh toán VNPay thành công',
        data: {
          paymentUrl: result.paymentUrl,
          txnRef: result.txnRef,
          payment: result.payment,
          course: result.course,
        },
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Handle VNPay return callback
   */
  async handleVNPayReturn(req, res) {
    try {
      const vnpParams = req.query;
      const result = await paymentService.processVNPayReturn(vnpParams);
      
      if (result.success) {
        // Redirect to success page with token
        res.redirect(`${process.env.FRONTEND_URL}/payment/success?txnRef=${result.txnRef}`);
      } else {
        // Redirect to failure page
        res.redirect(`${process.env.FRONTEND_URL}/payment/failed?code=${result.responseCode}&message=${encodeURIComponent(result.message)}`);
      }
    } catch (error) {
      console.error('VNPay return error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/payment/failed?message=${encodeURIComponent('Có lỗi xảy ra')}`);
    }
  }

  /**
   * Handle Stripe Checkout Session success
   */
  async handleStripeSuccess(req, res) {
    try {
      const { session_id: sessionId } = req.query;
      logger.info('STRIPE_SUCCESS_CALLBACK_RECEIVED', { sessionId });
      
      // Retrieve session from Stripe
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      logger.debug('STRIPE_SESSION_RETRIEVED', {
        sessionId: session.id,
        paymentStatus: session.payment_status,
      });
      
      if (session.payment_status === 'paid') {
        logger.info('STRIPE_SESSION_PAID_PROCESSING', { sessionId: session.id });
        // Process completed payment
        const result = await stripeService.handleCheckoutCompleted(session);
        logger.info('STRIPE_CHECKOUT_COMPLETED_PROCESSED', {
          sessionId: session.id,
          success: result?.success,
        });
        
        res.json({
          success: true,
          message: 'Thanh toán thành công',
          data: {
            sessionId,
            courseId: session.metadata.courseId,
            amount: session.amount_total / 100,
          },
        });
      } else {
        logger.warn('STRIPE_SESSION_NOT_PAID', { sessionId: session.id, paymentStatus: session.payment_status });
        res.status(400).json({
          success: false,
          message: 'Thanh toán chưa hoàn tất',
          paymentStatus: session.payment_status,
        });
      }
    } catch (error) {
      logger.error('STRIPE_SUCCESS_HANDLER_ERROR', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Lỗi xử lý thanh toán',
        error: error.message,
      });
    }
  }

  /**
   * Verify Stripe payment by session ID (for frontend manual verification)
   */
  async verifyStripePayment(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { sessionId } = req.body;
      logger.info('STRIPE_MANUAL_VERIFY_REQUESTED', { sessionId, userId: req.user?.id });

      // Retrieve session from Stripe
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      logger.debug('STRIPE_VERIFY_SESSION_RETRIEVED', {
        sessionId: session.id,
        paymentStatus: session.payment_status,
      });

      if (session.payment_status === 'paid') {
        logger.info('STRIPE_VERIFY_SESSION_PAID_PROCESSING', { sessionId: session.id });
        // Process completed payment
        const result = await stripeService.handleCheckoutCompleted(session);
        logger.info('STRIPE_VERIFY_COMPLETED', { sessionId: session.id, success: result?.success });

        res.json({
          success: true,
          message: 'Thanh toán đã được xác nhận',
          data: {
            sessionId,
            status: 'completed',
            courseId: session.metadata?.courseId,
            amount: session.amount_total / 100,
          },
        });
      } else {
        logger.warn('STRIPE_VERIFY_NOT_PAID', { sessionId: session.id, paymentStatus: session.payment_status });
        res.status(400).json({
          success: false,
          message: 'Thanh toán chưa hoàn tất',
          paymentStatus: session.payment_status,
        });
      }
    } catch (error) {
      logger.error('STRIPE_VERIFY_ERROR', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Lỗi xác minh thanh toán',
        error: error.message,
      });
    }
  }

  /**
   * Get payment details by Stripe session ID
   */
  async getPaymentBySession(req, res) {
    try {
      const { session_id } = req.query;
      
      if (!session_id) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu session_id',
        });
      }

      // Find payment by providerTxn (Stripe session ID)
      logger.debug('PAYMENT_LOOKUP_BY_SESSION', { sessionId: session_id, userId: req.user?.id });
      const payment = await Payment.findOne({
        where: { providerTxn: session_id },
        include: [
          { model: Course, as: 'course', attributes: ['id', 'title'] },
          { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        ],
      });

      logger.debug('PAYMENT_LOOKUP_RESULT', { sessionId: session_id, found: !!payment });

      if (!payment) {
        // Try to find any payment with similar providerTxn
        const allPayments = await Payment.findAll({
          where: { provider: 'stripe' },
          limit: 5,
          order: [['createdAt', 'DESC']],
        });
        logger.warn('PAYMENT_NOT_FOUND_FOR_SESSION', {
          sessionId: session_id,
          recentPaymentCount: allPayments.length,
        });
        
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy giao dịch',
        });
      }

      // Ownership check: user can only access their own payment status
      if (Number(payment.userId) !== Number(req.user?.id)) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xem giao dịch này',
        });
      }

      // Check if this is a cart checkout (check paymentDetails for cart type)
      const paymentDetails = payment.paymentDetails || {};
      const isCartCheckout = paymentDetails.type === 'checkout_session_cart';

      let courses = [];
      let totalAmount = 0;

      if (isCartCheckout) {
        // Find all payments with the same session (cart checkout creates multiple payments)
        logger.debug('PAYMENT_LOOKUP_RELATED_CART_PAYMENTS', { userId: payment.userId, sessionId: session_id });
        const relatedPayments = await Payment.findAll({
          where: { 
            providerTxn: session_id,
            userId: payment.userId,
          },
          include: [
            { model: Course, as: 'course', attributes: ['id', 'title', 'price'] },
          ],
          order: [['created_at', 'ASC']],
        });
        logger.debug('PAYMENT_RELATED_CART_PAYMENTS_FOUND', { sessionId: session_id, count: relatedPayments.length });

        courses = relatedPayments.map(p => ({
          id: p.course ? p.course.id : p.courseId,
          title: p.course ? p.course.title : 'Khóa học',
          price: parseFloat(p.amount) || 0,
        }));

        totalAmount = relatedPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      } else {
        // Single course purchase
        courses = [{
          id: payment.course ? payment.course.id : payment.courseId,
          title: payment.course ? payment.course.title : 'Khóa học',
          price: parseFloat(payment.amount) || 0,
        }];
        totalAmount = parseFloat(payment.amount) || 0;
      }

      res.json({
        success: true,
        data: {
          id: payment.id,
          courseId: payment.courseId,
          courseTitle: payment.course?.title || 'Khóa học',
          courses: courses.length > 1 ? courses : undefined,
          amount: totalAmount,
          currency: payment.currency,
          status: payment.status,
          provider: payment.provider,
          providerTxn: payment.providerTxn,
          createdAt: payment.createdAt,
          completedAt: payment.completedAt,
        },
      });
    } catch (error) {
      logger.error('GET_PAYMENT_BY_SESSION_ERROR', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Lỗi lấy thông tin giao dịch',
        error: error.message,
      });
    }
  }

  /**
   * Handle Stripe Checkout Session cancel
   */
  async handleStripeCancel(req, res) {
    res.json({
      success: false,
      message: 'Thanh toán đã bị hủy',
    });
  }

  /**
   * Handle VNPay IPN (Instant Payment Notification)
   */
  async handleVNPayIpn(req, res) {
    try {
      const vnpParams = req.query;
      const result = await paymentService.processVNPayIpn(vnpParams);
      
      // VNPay expects specific response format
      res.status(200).json({
        RspCode: result.RspCode || '00',
        Message: result.Message || 'Confirm Success',
      });
    } catch (error) {
      console.error('VNPay IPN error:', error);
      res.status(200).json({
        RspCode: '99',
        Message: 'Unknown error',
      });
    }
  }

  /**
   * Create Stripe Checkout Session from cart
   */
  async createStripeCartCheckout(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId } = req.user;
      const { selectedItems, successUrl, cancelUrl } = req.body;

      const result = await stripeService.createCheckoutSessionFromCart(userId, selectedItems, successUrl, cancelUrl);
      
      res.status(201).json({
        success: true,
        message: `Tạo Stripe Checkout Session cho ${result.itemCount} khóa học trong giỏ hàng`,
        data: {
          checkoutUrl: result.checkoutUrl,
          sessionId: result.sessionId,
          payments: result.payments,
          totalAmount: result.totalAmount,
        },
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Create Stripe Checkout Session (redirect to Stripe hosted page)
   */
  async createStripeCheckout(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId, successUrl, cancelUrl, type, renewalPrice, enrollmentId, renewalMonths } = req.body;
      const { id: userId } = req.user;
      const isRenewal = type === 'renewal';
      
      // Use default URLs with session_id placeholder if not provided
      const defaultSuccessUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
      const defaultCancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment?courseId=${courseId}${isRenewal ? `&type=renewal` : ''}`;
      
      const finalSuccessUrl = successUrl || defaultSuccessUrl;
      const finalCancelUrl = cancelUrl || defaultCancelUrl;
      
      logger.info('STRIPE_CHECKOUT_CREATE_REQUEST', {
        userId,
        courseId,
        type,
        isRenewal,
        renewalPrice,
        enrollmentId,
        renewalMonths,
        finalSuccessUrl,
      });

      const result = await stripeService.createCheckoutSession(
        userId,
        courseId,
        finalSuccessUrl,
        finalCancelUrl,
        isRenewal,
        renewalPrice,
        enrollmentId,
        renewalMonths
      );
      
      res.status(201).json({
        success: true,
        message: 'Tạo Stripe Checkout Session thành công',
        data: {
          checkoutUrl: result.checkoutUrl,
          sessionId: result.sessionId,
          payment: result.payment,
        },
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Create Stripe Payment Intent
   */
  async createStripePayment(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { courseId, type } = req.body;
      const { id: userId } = req.user;
      const isRenewal = type === 'renewal';

      const result = await stripeService.createPaymentIntent(userId, courseId, isRenewal);
      
      res.status(result.isNew ? 201 : 200).json({
        success: true,
        message: result.isNew ? 'Tạo Payment Intent thành công' : 'Payment Intent đang chờ xử lý',
        data: {
          clientSecret: result.clientSecret,
          publishableKey: stripeService.getPublishableKey(),
          payment: result.payment,
        },
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Create Stripe Payment Intent from cart
   */
  async createStripeCartPayment(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId } = req.user;
      const { selectedItems } = req.body;

      const result = await stripeService.createPaymentIntentFromCart(userId, selectedItems);
      
      res.status(201).json({
        success: true,
        message: `Đã tạo ${result.clientSecrets.length} Payment Intent từ giỏ hàng`,
        data: {
          clientSecrets: result.clientSecrets,
          publishableKey: stripeService.getPublishableKey(),
          payments: result.payments,
          totalAmount: result.totalAmount,
        },
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Handle Stripe webhook
   */
  async handleStripeWebhook(req, res) {
    try {
      const signature = req.headers['stripe-signature'];
      
      logger.info('STRIPE_WEBHOOK_RECEIVED', { headerCount: Object.keys(req.headers).length });
      
      if (!signature) {
        logger.warn('STRIPE_WEBHOOK_MISSING_SIGNATURE');
        return res.status(400).json({
          success: false,
          message: 'Thiếu Stripe signature',
        });
      }

      const result = await stripeService.handleWebhook(req.body, signature);
      
      logger.info('STRIPE_WEBHOOK_HANDLED', { event: result.event });
      
      res.status(200).json({
        received: true,
        event: result.event,
      });
    } catch (error) {
      logger.error('STRIPE_WEBHOOK_ERROR', { error: error.message, stack: error.stack });
      res.status(400).json({
        success: false,
        message: 'Webhook error',
      });
    }
  }

  /**
   * Verify payment (alias for processPayment - backward compatibility)
   */
  async verifyPayment(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { id: userId } = req.user;
      // Map verify to process with completed status
      const processData = {
        ...req.body,
        status: 'completed',
      };
      const result = await paymentService.processPayment(userId, processData);

      res.json({
        success: true,
        message: 'Thanh toán xác nhận thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Repair old renewal payments (admin only)
   * POST /api/payments/admin/repair-renewals
   */
  async repairRenewalPayments(req, res) {
    try {
      // Only admin can run this
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Chỉ admin có quyền chạy repair',
        });
      }

      const { dryRun = false } = req.body || {};
      const { PaymentRepairService } = require('./payment.repair');

      const result = await PaymentRepairService.repairRenewalPayments(dryRun);

      res.json({
        success: true,
        message: dryRun ? 'Scan hoàn tất (dry run)' : 'Repair hoàn tất',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Download payment invoice as PDF
   */
  async downloadInvoice(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;
      
      const doc = await paymentService.generateInvoicePDF(id, userId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Invoice_${id}.pdf`);
      
      doc.on('error', (err) => {
        console.error('PDF Stream Error:', err);
        if (!res.headersSent) {
          res.status(500).send('Error generating PDF');
        }
      });

      doc.pipe(res);
      doc.end();
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new PaymentController();
