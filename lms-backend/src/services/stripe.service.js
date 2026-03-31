/**
 * Stripe Service - Payment integration with Stripe
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../models');
const cartService = require('../modules/cart/cart.service');

const { Payment, Course, Enrollment } = db.models;

class StripeService {
  /**
   * Create Stripe Payment Intent for a course
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} - Payment intent and client secret
   */
  async createPaymentIntent(userId, courseId) {
    // Check course exists and published
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (!course.published) {
      throw { status: 400, message: 'Khóa học chưa được xuất bản' };
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      where: { userId, courseId },
    });
    if (existingEnrollment) {
      throw { status: 409, message: 'Bạn đã đăng ký khóa học này rồi' };
    }

    const price = Math.round(Number(course.price || 0) * 100); // Convert to cents

    if (price === 0) {
      throw { status: 400, message: 'Khóa học miễn phí, không cần thanh toán' };
    }

    // Check for existing pending payment
    const existingPayment = await Payment.findOne({
      where: {
        userId,
        courseId,
        provider: 'stripe',
        status: 'pending',
      },
      order: [['created_at', 'DESC']],
    });

    if (existingPayment && existingPayment.paymentDetails?.clientSecret) {
      return {
        payment: existingPayment,
        clientSecret: existingPayment.paymentDetails.clientSecret,
        isNew: false,
      };
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: String(userId),
        courseId: String(courseId),
        courseTitle: course.title,
      },
    });

    // Create payment record
    const payment = await Payment.create({
      userId,
      courseId,
      amount: price / 100,
      currency: 'USD',
      provider: 'stripe',
      providerTxn: paymentIntent.id,
      status: 'pending',
      paymentDetails: {
        initiatedAt: new Date().toISOString(),
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    });

    return {
      payment,
      clientSecret: paymentIntent.client_secret,
      isNew: true,
    };
  }

  /**
   * Create Stripe Payment Intent from cart
   * @param {number} userId - User ID
   * @param {Array} selectedItems - Optional specific cart items
   * @returns {Promise<Object>} - Payment intents for cart items
   */
  async createPaymentIntentFromCart(userId, selectedItems = null) {
    const cartData = await cartService.convertCartToPayment(userId, selectedItems);

    if (cartData.items.length === 0) {
      throw { status: 400, message: 'Giỏ hàng trống hoặc không có khóa học hợp lệ' };
    }

    const payments = [];
    const clientSecrets = [];

    for (const item of cartData.items) {
      try {
        const result = await this.createPaymentIntent(userId, item.courseId);
        payments.push(result.payment);
        if (result.clientSecret) {
          clientSecrets.push({
            courseId: item.courseId,
            clientSecret: result.clientSecret,
          });
        }
      } catch (error) {
        // Skip items that can't be processed
        console.error(`Stripe payment error for course ${item.courseId}:`, error);
      }
    }

    if (payments.length === 0) {
      throw { status: 400, message: 'Không thể tạo thanh toán cho khóa học trong giỏ' };
    }

    return {
      payments,
      clientSecrets,
      totalAmount: cartData.totalAmount,
      itemCount: payments.length,
    };
  }

  /**
   * Handle Stripe webhook
   * @param {Object} payload - Webhook payload
   * @param {string} signature - Stripe signature
   * @returns {Promise<Object>} - Processing result
   */
  async handleWebhook(payload, signature) {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'payment_intent.succeeded':
        return this._handlePaymentSuccess(event.data.object);
      case 'payment_intent.payment_failed':
        return this._handlePaymentFailure(event.data.object);
      default:
        return { received: true, type: event.type };
    }
  }

  /**
   * Process successful payment
   * @private
   */
  async _handlePaymentSuccess(paymentIntent) {
    const { userId, courseId } = paymentIntent.metadata;

    // Find and update payment
    const payment = await Payment.findOne({
      where: { providerTxn: paymentIntent.id },
    });

    if (!payment) {
      throw { status: 404, message: 'Không tìm thấy giao dịch' };
    }

    payment.status = 'completed';
    payment.paymentDetails = {
      ...payment.paymentDetails,
      completedAt: new Date().toISOString(),
      receiptUrl: paymentIntent.charges?.data?.[0]?.receipt_url,
    };
    await payment.save();

    // Create enrollment
    const existingEnrollment = await Enrollment.findOne({
      where: { userId, courseId },
    });

    if (!existingEnrollment) {
      await Enrollment.create({
        userId: parseInt(userId),
        courseId: parseInt(courseId),
        status: 'enrolled',
        progressPercent: 0,
      });
    }

    // Remove from cart
    await cartService.removeCourseFromCart(parseInt(userId), parseInt(courseId));

    return {
      success: true,
      payment,
      event: 'payment_intent.succeeded',
    };
  }

  /**
   * Process failed payment
   * @private
   */
  async _handlePaymentFailure(paymentIntent) {
    const payment = await Payment.findOne({
      where: { providerTxn: paymentIntent.id },
    });

    if (payment) {
      payment.status = 'failed';
      payment.paymentDetails = {
        ...payment.paymentDetails,
        failedAt: new Date().toISOString(),
        failureMessage: paymentIntent.last_payment_error?.message,
      };
      await payment.save();
    }

    return {
      success: false,
      payment,
      event: 'payment_intent.payment_failed',
    };
  }

  /**
   * Create Stripe Checkout Session (redirect to Stripe hosted page)
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @param {string} successUrl - Redirect URL after success
   * @param {string} cancelUrl - Redirect URL after cancel
   * @returns {Promise<Object>} - Checkout session URL
   */
  async createCheckoutSession(userId, courseId, successUrl, cancelUrl) {
    // Check course exists and published
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (!course.published) {
      throw { status: 400, message: 'Khóa học chưa được xuất bản' };
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      where: { userId, courseId },
    });
    if (existingEnrollment) {
      throw { status: 409, message: 'Bạn đã đăng ký khóa học này rồi' };
    }

    const price = Number(course.price || 0);

    if (price === 0) {
      throw { status: 400, message: 'Khóa học miễn phí, không cần thanh toán' };
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: course.title,
              description: course.description || 'Khóa học trực tuyến',
            },
            unit_amount: Math.round(price * 100), // cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl || 'https://cicd-test1.onrender.com/api/payments/stripe/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl || 'https://cicd-test1.onrender.com/api/payments/stripe/cancel',
      metadata: {
        userId: String(userId),
        courseId: String(courseId),
        source: 'stripe_checkout',
      },
    });

    // Create payment record
    const payment = await Payment.create({
      userId,
      courseId,
      amount: price,
      currency: 'USD',
      provider: 'stripe',
      providerTxn: session.id,
      status: 'pending',
      paymentDetails: {
        initiatedAt: new Date().toISOString(),
        sessionId: session.id,
        type: 'checkout_session',
      },
    });

    return {
      payment,
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Handle Stripe Checkout Session completed (webhook)
   * @param {Object} session - Checkout session object
   */
  async handleCheckoutCompleted(session) {
    const { userId, courseId } = session.metadata;

    // Find and update payment
    const payment = await Payment.findOne({
      where: { providerTxn: session.id },
    });

    if (!payment) {
      throw { status: 404, message: 'Không tìm thấy giao dịch' };
    }

    payment.status = 'completed';
    payment.paymentDetails = {
      ...payment.paymentDetails,
      completedAt: new Date().toISOString(),
      receiptUrl: session.receipt_url,
    };
    await payment.save();

    // Create enrollment
    const existingEnrollment = await Enrollment.findOne({
      where: { userId: parseInt(userId), courseId: parseInt(courseId) },
    });

    if (!existingEnrollment) {
      await Enrollment.create({
        userId: parseInt(userId),
        courseId: parseInt(courseId),
        status: 'enrolled',
        progressPercent: 0,
      });
    }

    // Remove from cart
    await cartService.removeCourseFromCart(parseInt(userId), parseInt(courseId));

    return { success: true, payment };
  }

  /**
   * Get Stripe publishable key
   */
  getPublishableKey() {
    return process.env.STRIPE_PUBLISHABLE_KEY;
  }
}

module.exports = new StripeService();
