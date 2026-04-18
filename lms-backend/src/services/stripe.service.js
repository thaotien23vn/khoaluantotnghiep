/**
 * Stripe Service - Payment integration with Stripe
 */

const db = require('../models');
const cartService = require('../modules/cart/cart.service');
const courseAggregatesService = require('./courseAggregates.service');
const logger = require('../utils/logger');

const { Payment, Course, Enrollment } = db.models;

// Initialize Stripe only if key is provided (for tests without env vars)
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} else {
  // Mock stripe for tests - methods will throw if called
  stripe = {
    paymentIntents: {
      create: () => { throw new Error('Stripe not configured'); },
    },
    checkout: {
      sessions: {
        create: () => { throw new Error('Stripe not configured'); },
        retrieve: () => { throw new Error('Stripe not configured'); },
      },
    },
    webhooks: {
      constructEvent: () => { throw new Error('Stripe not configured'); },
    },
  };
  logger.warn('STRIPE_SECRET_KEY_NOT_SET_STRIPE_DISABLED');
}

class StripeService {
  _calculateExpiryDate(startDate, value, unit) {
    const date = new Date(startDate);
    switch (unit) {
      case 'days':
        date.setDate(date.getDate() + value);
        break;
      case 'years':
        date.setFullYear(date.getFullYear() + value);
        break;
      case 'months':
      default:
        // Handle fractional months (0.25 = 1 week, 0.5 = 2 weeks)
        // Average month = 30.44 days (365.25 / 12)
        const totalDays = Math.round(value * 30.44);
        date.setDate(date.getDate() + totalDays);
        break;
    }
    return date;
  }

  _addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  async _renewEnrollmentAfterPayment(userId, courseId, renewalMonths, enrollmentId = null) {
    const uid = parseInt(userId, 10);
    const cid = parseInt(courseId, 10);
    const months = Number(renewalMonths);
    if (!Number.isFinite(months) || months <= 0) return null;

    const where = enrollmentId
      ? { id: Number(enrollmentId), userId: uid, courseId: cid }
      : { userId: uid, courseId: cid };

    const enrollment = await Enrollment.findOne({
      where,
      include: [{ model: Course, as: 'Course', attributes: ['id', 'gracePeriodDays'] }],
    });
    if (!enrollment) {
      throw { status: 404, message: 'Không tìm thấy ghi danh để gia hạn' };
    }

    let startFrom = new Date();
    if (enrollment.expiresAt && enrollment.expiresAt > startFrom) {
      startFrom = enrollment.expiresAt;
    }

    const newExpiresAt = this._calculateExpiryDate(startFrom, months, 'months');
    const graceDays = Number(enrollment.Course?.gracePeriodDays || 7);
    const newGracePeriodEndsAt = this._addDays(newExpiresAt, graceDays);

    enrollment.expiresAt = newExpiresAt;
    enrollment.gracePeriodEndsAt = newGracePeriodEndsAt;
    enrollment.renewalCount = Number(enrollment.renewalCount || 0) + 1;
    enrollment.lastRenewedAt = new Date();
    enrollment.enrollmentStatus = 'active';
    await enrollment.save();

    return enrollment;
  }

  async _ensureEnrollment(userId, courseId) {
    const uid = parseInt(userId, 10);
    const cid = parseInt(courseId, 10);

    const existing = await Enrollment.findOne({ where: { userId: uid, courseId: cid } });
    if (existing) return existing;

    try {
      return await Enrollment.create({
        userId: uid,
        courseId: cid,
        status: 'enrolled',
        progressPercent: 0,
      });
    } catch (err) {
      if (err?.name === 'SequelizeUniqueConstraintError') {
        const afterRace = await Enrollment.findOne({ where: { userId: uid, courseId: cid } });
        if (afterRace) return afterRace;
      }
      throw err;
    }
  }

  /**
   * Create Stripe Payment Intent for a course
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} - Payment intent and client secret
   */
  async createPaymentIntent(userId, courseId, isRenewal = false) {
    // Check course exists and published
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (!course.published) {
      throw { status: 400, message: 'Khóa học chưa được xuất bản' };
    }

    // Check if already enrolled (skip for renewal)
    if (!isRenewal) {
      const existingEnrollment = await Enrollment.findOne({
        where: { userId, courseId },
      });
      if (existingEnrollment) {
        throw { status: 409, message: 'Bạn đã đăng ký khóa học này rồi' };
      }
    }

    const price = Math.round(Number(course.price || 0)); // VND is zero-decimal

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
      currency: 'vnd',
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
      amount: price,
      currency: 'VND',
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

    logger.info('STRIPE_WEBHOOK_EVENT_RECEIVED', { eventType: event.type });

    switch (event.type) {
      case 'checkout.session.completed':
        return this.handleCheckoutCompleted(event.data.object);
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

    // Idempotency: do not re-process already completed payments
    if (payment.status === 'completed') {
      return { success: true, payment, event: 'payment_intent.succeeded', alreadyProcessed: true };
    }

    payment.status = 'completed';
    payment.paymentDetails = {
      ...payment.paymentDetails,
      completedAt: new Date().toISOString(),
      receiptUrl: paymentIntent.charges?.data?.[0]?.receipt_url,
    };
    await payment.save();

    // Create enrollment (unique-safe / race-safe)
    try {
      await this._ensureEnrollment(userId, courseId);
    } catch (err) {
      if (err?.name !== 'SequelizeUniqueConstraintError') {
        throw err;
      }
    }

    try {
      await courseAggregatesService.recomputeCourseStudents(parseInt(courseId, 10));
    } catch (aggErr) {
      logger.warn('RECOMPUTE_COURSE_STUDENTS_AFTER_STRIPE_WEBHOOK_FAILED', { error: aggErr.message });
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
  async createCheckoutSession(
    userId,
    courseId,
    successUrl,
    cancelUrl,
    isRenewal = false,
    renewalPrice = null,
    enrollmentId = null,
    renewalMonths = null
  ) {
    // Check course exists and published
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (!course.published) {
      throw { status: 400, message: 'Khóa học chưa được xuất bản' };
    }

    // Check if already enrolled (skip for renewal)
    if (!isRenewal) {
      const existingEnrollment = await Enrollment.findOne({
        where: { userId, courseId },
      });
      if (existingEnrollment) {
        throw { status: 409, message: 'Bạn đã đăng ký khóa học này rồi' };
      }
    }
    
    logger.info('STRIPE_CHECKOUT_SESSION_CREATE', { userId, courseId, isRenewal, renewalPrice });

    // Use renewal price if provided, otherwise use full course price
    const price = renewalPrice && renewalPrice > 0 ? Number(renewalPrice) : Number(course.price || 0);

    if (price === 0) {
      throw { status: 400, message: 'Khóa học miễn phí, không cần thanh toán' };
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'vnd',
            product_data: {
              name: course.title,
              description: course.description || 'Khóa học trực tuyến',
            },
            unit_amount: Math.round(price), // VND is zero-decimal
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl || 'http://localhost:5173/payment/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl || 'http://localhost:5173/payment/cancel',
      metadata: {
        userId: String(userId),
        courseId: String(courseId),
        source: 'stripe_checkout',
        isRenewal: isRenewal ? 'true' : 'false',
        enrollmentId: enrollmentId ? String(enrollmentId) : '',
        renewalMonths: renewalMonths != null ? String(renewalMonths) : '',
      },
    });

    // Create payment record
    const payment = await Payment.create({
      userId,
      courseId,
      amount: price,
      currency: 'VND',
      provider: 'stripe',
      providerTxn: session.id,
      status: 'pending',
      paymentMethod: 'card',
      paymentDetails: {
        initiatedAt: new Date().toISOString(),
        sessionId: session.id,
        type: 'checkout_session',
        // Include renewal metadata for proper renewal handling
        ...(isRenewal ? {
          isRenewal: true,
          renewalMonths: renewalMonths,
          enrollmentId,
          renewalPrice,
          source: 'stripe_renewal',
        } : {
          source: 'stripe_checkout',
        }),
      },
    });

    return {
      payment,
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Create Stripe Checkout Session for cart (multiple courses)
   * @param {number} userId - User ID
   * @param {Array} selectedItems - Optional specific cart items
   * @param {string} successUrl - Redirect URL after success
   * @param {string} cancelUrl - Redirect URL after cancel
   * @returns {Promise<Object>} - Checkout session URL
   */
  async createCheckoutSessionFromCart(userId, selectedItems = null, successUrl, cancelUrl) {
    const cartData = await cartService.convertCartToPayment(userId, selectedItems);

    if (cartData.items.length === 0) {
      throw { status: 400, message: 'Giỏ hàng trống hoặc không có khóa học hợp lệ' };
    }

    // Build line items from cart
    const lineItems = cartData.items.map(item => ({
      price_data: {
        currency: 'vnd',
        product_data: {
          name: item.course?.title || 'Khóa học',
          description: item.notes || 'Khóa học trực tuyến',
        },
        unit_amount: Math.round(Number(item.course?.price || 0)),
      },
      quantity: 1,
    }));

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl || 'http://localhost:5173/payment/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl || 'http://localhost:5173/payment/cancel',
      metadata: {
        userId: String(userId),
        source: 'stripe_checkout_cart',
        courseIds: JSON.stringify(cartData.items.map(i => i.courseId)),
      },
    });

    // Create payment records for each course
    const payments = [];
    for (const item of cartData.items) {
      const payment = await Payment.create({
        userId,
        courseId: item.courseId,
        amount: item.course?.price || 0,
        currency: 'VND',
        provider: 'stripe',
        providerTxn: session.id,
        status: 'pending',
        paymentDetails: {
          initiatedAt: new Date().toISOString(),
          sessionId: session.id,
          type: 'checkout_session_cart',
        },
      });
      payments.push(payment);
    }

    return {
      payments,
      checkoutUrl: session.url,
      sessionId: session.id,
      itemCount: cartData.items.length,
      totalAmount: cartData.totalAmount,
    };
  }

  /**
   * Handle Stripe Checkout Session completed
   * @param {Object} session - Checkout session object
   */
  async handleCheckoutCompleted(session) {
    logger.info('STRIPE_CHECKOUT_COMPLETED_HANDLER_CALLED', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });

    // Verify payment status
    if (session.payment_status !== 'paid') {
      throw { status: 400, message: `Payment not completed. Status: ${session.payment_status}` };
    }

    const { userId, courseId, courseIds, isRenewal, enrollmentId, renewalMonths } = session.metadata;
    logger.debug('STRIPE_CHECKOUT_METADATA_EXTRACTED', {
      userId,
      courseId,
      hasCourseIds: !!courseIds,
      isRenewal,
      enrollmentId,
      renewalMonths,
    });

    // Handle cart payment (multiple courses)
    if (courseIds) {
      const courseIdList = JSON.parse(courseIds);
      logger.info('STRIPE_CART_CHECKOUT_PROCESSING', { sessionId: session.id, itemCount: courseIdList.length });
      
      // Find all payments with this session ID
      const payments = await Payment.findAll({
        where: { providerTxn: session.id },
      });
      
      logger.debug('STRIPE_CART_PAYMENTS_FOUND', { sessionId: session.id, count: payments.length });
      
      for (const payment of payments) {
        if (payment.status === 'completed') {
          continue;
        }
        payment.status = 'completed';
        payment.paymentDetails = {
          ...payment.paymentDetails,
          completedAt: new Date().toISOString(),
          receiptUrl: session.receipt_url,
        };
        await payment.save();
        
        // Create enrollment (unique-safe / race-safe)
        try {
          await this._ensureEnrollment(userId, payment.courseId);
        } catch (err) {
          if (err?.name !== 'SequelizeUniqueConstraintError') {
            throw err;
          }
        }
        try {
          await courseAggregatesService.recomputeCourseStudents(payment.courseId);
        } catch (aggErr) {
          logger.warn('RECOMPUTE_COURSE_STUDENTS_AFTER_STRIPE_CART_CHECKOUT_FAILED', { error: aggErr.message });
        }
        
        // Remove from cart
        await cartService.removeCourseFromCart(parseInt(userId), payment.courseId);
      }
      
      return { success: true, payments };
    }

    // Handle single course payment
    // Find payment by session ID
    const payment = await Payment.findOne({
      where: { providerTxn: session.id },
    });

    logger.debug('STRIPE_SINGLE_PAYMENT_FOUND', {
      sessionId: session.id,
      found: !!payment,
      paymentId: payment?.id,
      status: payment?.status,
    });

    if (!payment) {
      throw { status: 404, message: 'Không tìm thấy giao dịch với session ID: ' + session.id };
    }

    // For renewal checkout, extend enrollment validity. Otherwise enroll new learner.
    const renewalMode =
      isRenewal === 'true' ||
      payment.paymentDetails?.isRenewal === true ||
      session.metadata?.isRenewal === 'true';
    const monthsFromPayment = Number(payment.paymentDetails?.renewalMonths);
    const monthsFromMetadata = Number(renewalMonths);
    const resolvedMonths = Number.isFinite(monthsFromPayment) && monthsFromPayment > 0
      ? monthsFromPayment
      : monthsFromMetadata;
    const resolvedEnrollmentId = payment.paymentDetails?.enrollmentId || enrollmentId || null;
    const accessAppliedAt = payment.paymentDetails?.accessAppliedAt;

    // Idempotency for payment state.
    if (payment.status !== 'completed') {
      payment.status = 'completed';
      payment.paymentDetails = {
        ...payment.paymentDetails,
        completedAt: new Date().toISOString(),
        receiptUrl: session.receipt_url,
      };
      await payment.save();
      logger.info('STRIPE_PAYMENT_MARKED_COMPLETED', { paymentId: payment.id, sessionId: session.id });
    }

    // Idempotency for access application (renew/enroll).
    if (!accessAppliedAt) {
      if (renewalMode && Number.isFinite(resolvedMonths) && resolvedMonths > 0) {
        await this._renewEnrollmentAfterPayment(userId, courseId, resolvedMonths, resolvedEnrollmentId);
      } else {
        try {
          await this._ensureEnrollment(userId, courseId);
        } catch (err) {
          if (err?.name !== 'SequelizeUniqueConstraintError') {
            throw err;
          }
        }
      }
      payment.paymentDetails = {
        ...payment.paymentDetails,
        accessAppliedAt: new Date().toISOString(),
      };
      await payment.save();
    }
    try {
      await courseAggregatesService.recomputeCourseStudents(parseInt(courseId, 10));
    } catch (aggErr) {
      logger.warn('RECOMPUTE_COURSE_STUDENTS_AFTER_STRIPE_CHECKOUT_FAILED', { error: aggErr.message });
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
