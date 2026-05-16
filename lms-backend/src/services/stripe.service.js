/**
 * Stripe Service - Payment integration with Stripe
 */

const { Sequelize } = require('sequelize');
const db = require('../models');

// Defensive: Sequelize.LOCK may not be available in all environments (e.g., SQLite tests)
const LOCK_UPDATE = (Sequelize && Sequelize.LOCK && Sequelize.LOCK.UPDATE) ? Sequelize.LOCK.UPDATE : undefined;
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

  async _renewEnrollmentAfterPayment(userId, courseId, renewalMonths, enrollmentId = null, transaction = null) {
    const uid = parseInt(userId, 10);
    const cid = parseInt(courseId, 10);
    const months = Number(renewalMonths);
    if (!Number.isFinite(months) || months <= 0) return null;

    const where = enrollmentId
      ? { id: Number(enrollmentId), userId: uid, courseId: cid }
      : { userId: uid, courseId: cid };

    // 🛡️ FIX: Add row-level lock
    const enrollment = await Enrollment.findOne({
      where,
      include: [{ model: Course, as: 'Course', attributes: ['id', 'gracePeriodDays'] }],
      lock: (transaction && LOCK_UPDATE) ? LOCK_UPDATE : undefined,
      transaction,
    });
    if (!enrollment) {
      throw { status: 404, message: 'Không tìm thấy ghi danh để gia hạn' };
    }

    // 🛡️ FIX: Validate enrollment status
    if (!['active', 'grace_period', 'expired'].includes(enrollment.enrollmentStatus)) {
      throw { status: 400, message: 'Không thể gia hạn ghi danh này - trạng thái không hợp lệ' };
    }

    // 🛡️ FIX: Correct date calculation
    let startFrom = new Date();
    const graceEnd = enrollment.gracePeriodEndsAt || enrollment.expiresAt;
    if (graceEnd) {
      startFrom = new Date(Math.max(startFrom.getTime(), new Date(graceEnd).getTime()));
    }

    const newExpiresAt = this._calculateExpiryDate(startFrom, months, 'months');
    const graceDays = Number(enrollment.Course?.gracePeriodDays || 7);
    const newGracePeriodEndsAt = this._addDays(newExpiresAt, graceDays);

    enrollment.expiresAt = newExpiresAt;
    enrollment.gracePeriodEndsAt = newGracePeriodEndsAt;
    enrollment.renewalCount = Number(enrollment.renewalCount || 0) + 1;
    enrollment.lastRenewedAt = new Date();
    enrollment.enrollmentStatus = 'active';
    await enrollment.save({ transaction });

    return enrollment;
  }

  async _ensureEnrollment(userId, courseId, transaction = null) {
    const uid = parseInt(userId, 10);
    const cid = parseInt(courseId, 10);

    const enrollment = await Enrollment.findOne({
      where: { userId: uid, courseId: cid },
      transaction,
    });
    if (enrollment) return enrollment;

    try {
      return await Enrollment.create({
        userId: uid,
        courseId: cid,
        status: 'active',
        enrollmentType: 'paid',
        enrollmentStatus: 'active',
        progressPercent: 0,
      }, { transaction });
    } catch (err) {
      if (err?.name === 'SequelizeUniqueConstraintError') {
        const afterRace = await Enrollment.findOne({ where: { userId: uid, courseId: cid }, transaction });
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
      order: [['id', 'DESC']],
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
   * 🔒 FIXED: Added transaction wrapper with row-level lock
   */
  async _handlePaymentSuccess(paymentIntent) {
    // 🛡️ FIX: Use transaction with row-level lock
    return await db.sequelize.transaction(async (t) => {
      const { userId, courseId } = paymentIntent.metadata;

      // 🛡️ FIX: Re-fetch and lock payment with status check
      const payment = await Payment.findOne({
        where: { providerTxn: paymentIntent.id, status: 'pending' },
        lock: LOCK_UPDATE || undefined,
        transaction: t,
      });

      if (!payment) {
        // Already processed by another thread
        const existingPayment = await Payment.findOne({
          where: { providerTxn: paymentIntent.id },
        });
        return { success: true, payment: existingPayment, event: 'payment_intent.succeeded', alreadyProcessed: true };
      }

      payment.status = 'completed';
      payment.paymentDetails = {
        ...payment.paymentDetails,
        completedAt: new Date().toISOString(),
        receiptUrl: paymentIntent.charges?.data?.[0]?.receipt_url,
      };
      await payment.save({ transaction: t });

      // Create enrollment (unique-safe / race-safe) within transaction
      try {
        await this._ensureEnrollment(userId, courseId, t);
      } catch (err) {
        if (err?.name !== 'SequelizeUniqueConstraintError') {
          throw err;
        }
      }

      // Commit transaction before non-critical operations
      return { success: true, payment, userId, courseId, event: 'payment_intent.succeeded' };
    }).then(async (result) => {
      // Non-critical operations after transaction
      try {
        await courseAggregatesService.recomputeCourseStudents(parseInt(result.courseId, 10));
      } catch (aggErr) {
        logger.warn('RECOMPUTE_COURSE_STUDENTS_AFTER_STRIPE_WEBHOOK_FAILED', { error: aggErr.message });
      }

      return {
        success: true,
        payment: result.payment,
        event: 'payment_intent.succeeded',
      };
    });
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
    let price = renewalPrice && renewalPrice > 0 ? Number(renewalPrice) : Number(course.price || 0);

    // 🛡️ FIX: Stripe minimum amount check (approx $0.50 USD = ~13,000 VND)
    // To be safe, we set minimum to 20,000 VND for Stripe
    const STRIPE_MIN_AMOUNT = 20000;
    if (price < STRIPE_MIN_AMOUNT) {
      logger.warn('STRIPE_AMOUNT_TOO_LOW_ADJUSTING', { originalPrice: price, adjustedPrice: STRIPE_MIN_AMOUNT });
      price = STRIPE_MIN_AMOUNT;
    }

    if (price === 0) {
      throw { status: 400, message: 'Khóa học miễn phí, không cần thanh toán' };
    }

    // 🛡️ FIX: Check for existing pending payment to avoid duplicates
    const existingPayment = await Payment.findOne({
      where: {
        userId,
        courseId,
        status: 'pending',
        provider: 'stripe',
      },
      order: [['id', 'DESC']],
    });

    // If there's an existing pending payment with a session, try to reuse it
    if (existingPayment?.paymentDetails?.sessionId) {
      try {
        const existingSessionId = existingPayment.paymentDetails.sessionId;
        const existingSession = await stripe.checkout.sessions.retrieve(existingSessionId);
        
        // If session is still open (not expired/completed), reuse it
        if (existingSession.status === 'open' && existingSession.url) {
          logger.info('STRIPE_CHECKOUT_REUSE_SESSION', { 
            userId, 
            courseId, 
            existingPaymentId: existingPayment.id,
            sessionId: existingSessionId 
          });
          return {
            payment: existingPayment,
            checkoutUrl: existingSession.url,
            sessionId: existingSessionId,
            isNew: false,
          };
        }
      } catch (sessionErr) {
        // Session expired or invalid, will create new one and update payment
        logger.info('STRIPE_CHECKOUT_SESSION_EXPIRED', { 
          userId, 
          courseId, 
          existingPaymentId: existingPayment.id,
          error: sessionErr.message 
        });
      }
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

    // 🛡️ FIX: Update existing payment if found, otherwise create new
    let payment;
    if (existingPayment) {
      // Update existing payment with new session
      existingPayment.providerTxn = session.id;
      existingPayment.paymentDetails = {
        ...existingPayment.paymentDetails,
        sessionId: session.id,
        renewedAt: new Date().toISOString(),
        type: 'checkout_session',
        ...(isRenewal ? {
          isRenewal: true,
          renewalMonths: renewalMonths,
          enrollmentId,
          renewalPrice,
          source: 'stripe_renewal',
        } : {
          source: 'stripe_checkout',
        }),
      };
      await existingPayment.save();
      payment = existingPayment;
      logger.info('STRIPE_CHECKOUT_UPDATE_EXISTING', { 
        userId, 
        courseId, 
        paymentId: payment.id,
        sessionId: session.id 
      });
    } else {
      // Create new payment record
      payment = await Payment.create({
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
    }

    return {
      payment,
      checkoutUrl: session.url,
      sessionId: session.id,
      isNew: !existingPayment,
    };
  }

  /**
   * Handle Stripe Checkout Session completed
   * @param {Object} session - Checkout session object
   */
  async handleCheckoutCompleted(session) {
    logger.info('STRIPE_CHECKOUT_SUCCESS_PROCESSING', { sessionId: session.id });

    // SECURITY: Use transaction for the entire checkout completion process
    return await db.sequelize.transaction(async (t) => {
      return this._handlePaymentSuccess(session, t);
    });
  }

  async _handlePaymentSuccess(session, transaction = null) {
    // Handle both checkout session (payment_status) and payment intent (status)
    const paymentStatus = session.payment_status || session.status;
    logger.info('STRIPE_PAYMENT_SUCCESS_HANDLER_CALLED', {
      sessionId: session.id,
      paymentStatus,
    });

    // Verify payment status - accepts 'paid' (checkout) or 'succeeded' (payment intent)
    const isPaid = paymentStatus === 'paid' || paymentStatus === 'succeeded';
    if (!paymentStatus || !isPaid) {
      throw { status: 400, message: `Payment not completed. Status: ${paymentStatus || 'unknown'}` };
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

    // 🛡️ FIX: Validate metadata userId matches
    const metadataUserId = parseInt(userId, 10);
    if (!Number.isFinite(metadataUserId)) {
      throw { status: 400, message: 'Invalid userId in session metadata' };
    }

    // Handle single course payment
    // 🛡️ FIX: Find and lock payment by session ID with status check
    const payment = await Payment.findOne({
      where: { providerTxn: session.id },
      lock: (transaction && LOCK_UPDATE) ? LOCK_UPDATE : undefined,
      transaction,
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

    // 🛡️ FIX: Validate payment userId matches metadata
    if (payment.userId !== metadataUserId) {
      logger.error('STRIPE_SINGLE_USER_MISMATCH', { 
        paymentId: payment.id, 
        paymentUserId: payment.userId, 
        metadataUserId 
      });
      throw { status: 403, message: 'User mismatch in payment metadata' };
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
      // Update payment status atomically
      payment.status = 'completed';
      payment.paymentDetails = {
        ...payment.paymentDetails,
        completedAt: new Date().toISOString(),
        receiptUrl: session.receipt_url,
      };
      await payment.save({ transaction });
      logger.info('STRIPE_PAYMENT_MARKED_COMPLETED', { paymentId: payment.id, sessionId: session.id });
    }

    // Idempotency for access application (renew/enroll).
    if (!accessAppliedAt) {
      if (renewalMode && Number.isFinite(resolvedMonths) && resolvedMonths > 0) {
        await this._renewEnrollmentAfterPayment(userId, courseId, resolvedMonths, resolvedEnrollmentId, transaction);
      } else {
        try {
          await this._ensureEnrollment(userId, courseId, transaction);
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
      await payment.save({ transaction });
    }
    try {
      await courseAggregatesService.recomputeCourseStudents(parseInt(courseId, 10));
    } catch (aggErr) {
      logger.warn('RECOMPUTE_COURSE_STUDENTS_AFTER_STRIPE_CHECKOUT_FAILED', { error: aggErr.message });
    }

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
