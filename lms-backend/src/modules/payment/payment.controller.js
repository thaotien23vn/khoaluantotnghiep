const { validationResult } = require('express-validator');
const paymentService = require('./payment.service');
const stripeService = require('../../services/stripe.service');
const db = require('../../models');
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
  console.error('Lỗi thanh toán:', error);
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

      const { courseId, provider } = req.body;
      const { id: userId } = req.user;

      let result;
      if (provider === 'vnpay') {
        const ipAddr = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        result = await paymentService.createVNPayPayment(userId, courseId, ipAddr);
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
      const ipAddr = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      const result = await paymentService.createVNPayPayment(userId, courseId, ipAddr);
      
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
      console.log('Stripe success callback - sessionId:', sessionId);
      
      // Retrieve session from Stripe
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log('Stripe session retrieved:', { 
        id: session.id, 
        payment_status: session.payment_status,
        metadata: session.metadata 
      });
      
      if (session.payment_status === 'paid') {
        console.log('Payment is paid, calling handleCheckoutCompleted...');
        // Process completed payment
        const result = await stripeService.handleCheckoutCompleted(session);
        console.log('handleCheckoutCompleted result:', result);
        
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
        console.log('Payment not paid, status:', session.payment_status);
        res.status(400).json({
          success: false,
          message: 'Thanh toán chưa hoàn tất',
          paymentStatus: session.payment_status,
        });
      }
    } catch (error) {
      console.error('Stripe success handler error:', error);
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
      console.log('Manual Stripe verify - sessionId:', sessionId);

      // Retrieve session from Stripe
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log('Stripe session retrieved:', {
        id: session.id,
        payment_status: session.payment_status,
        metadata: session.metadata
      });

      if (session.payment_status === 'paid') {
        console.log('Payment is paid, calling handleCheckoutCompleted...');
        // Process completed payment
        const result = await stripeService.handleCheckoutCompleted(session);
        console.log('handleCheckoutCompleted result:', result);

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
        console.log('Payment not paid, status:', session.payment_status);
        res.status(400).json({
          success: false,
          message: 'Thanh toán chưa hoàn tất',
          paymentStatus: session.payment_status,
        });
      }
    } catch (error) {
      console.error('Stripe verify error:', error);
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
     
      const payment = await Payment.findOne({
        where: { providerTxn: session_id },
        include: [
          { model: Course, as: 'course', attributes: ['id', 'title'] },
          { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        ],
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy giao dịch',
        });
      }

      res.json({
        success: true,
        data: {
          id: payment.id,
          courseId: payment.courseId,
          courseTitle: payment.course?.title || 'Khóa học',
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          provider: payment.provider,
          providerTxn: payment.providerTxn,
          createdAt: payment.createdAt,
          completedAt: payment.completedAt,
        },
      });
    } catch (error) {
      console.error('Get payment by session error:', error);
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

      const { courseId, successUrl, cancelUrl } = req.body;
      const { id: userId } = req.user;

      const result = await stripeService.createCheckoutSession(userId, courseId, successUrl, cancelUrl);
      
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

      const { courseId } = req.body;
      const { id: userId } = req.user;

      const result = await stripeService.createPaymentIntent(userId, courseId);
      
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
      
      if (!signature) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu Stripe signature',
        });
      }

      const result = await stripeService.handleWebhook(req.body, signature);
      
      res.status(200).json({
        received: true,
        event: result.event,
      });
    } catch (error) {
      console.error('Stripe webhook error:', error);
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
}

module.exports = new PaymentController();
