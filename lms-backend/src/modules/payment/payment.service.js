const db = require('../../models');
const cartService = require('../cart/cart.service');
const courseAggregatesService = require('../../services/courseAggregates.service');
const vnpayService = require('../../services/vnpay.service');
const momoService = require('../../services/momo.service');

const { Payment, Course, User, Enrollment } = db.models;

/**
 * Generate unique provider transaction ID
 */
const generateProviderTxn = (provider) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${provider}_${timestamp}_${random}`;
};

/**
 * Mock Payment Processor - Simulates payment processing
 */
class MockPaymentProcessor {
  /**
   * Process a mock payment
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} - Payment result
   */
  async process(paymentData) {
    const { amount, currency = 'USD', providerTxn } = paymentData;

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock validation - 95% success rate
    const isSuccess = Math.random() > 0.05;

    if (!isSuccess) {
      return {
        success: false,
        status: 'failed',
        message: 'Thẻ bị từ chối. Vui lòng thử phương thức thanh toán khác.',
        providerTxn,
        processedAt: new Date().toISOString(),
      };
    }

    return {
      success: true,
      status: 'completed',
      message: 'Thanh toán thành công',
      providerTxn,
      processedAt: new Date().toISOString(),
      mockDetails: {
        cardLast4: '4242',
        cardBrand: 'visa',
        receiptUrl: `https://mock-payment.example.com/receipts/${providerTxn}`,
      },
    };
  }

  /**
   * Refund a payment
   */
  async refund(paymentData) {
    const { providerTxn, amount } = paymentData;

    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      success: true,
      status: 'refunded',
      refundTxn: `refund_${generateProviderTxn('mock')}`,
      amount,
      processedAt: new Date().toISOString(),
    };
  }
}

const mockProcessor = new MockPaymentProcessor();

/**
 * Payment Service - Business logic for payment operations
 */
class PaymentService {
  /**
   * Create payment intent/order for a course
   */
  async createPayment(userId, courseId, paymentData) {
    const { provider = 'mock', amount: customAmount } = paymentData;

    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (!course.published) {
      throw { status: 400, message: 'Khóa học chưa được xuất bản' };
    }

    // Check if user already enrolled
    const existingEnrollment = await Enrollment.findOne({
      where: { userId, courseId },
    });
    if (existingEnrollment) {
      throw { status: 409, message: 'Bạn đã đăng ký khóa học này rồi' };
    }

    const price = Number(course.price || 0);
    
    // Free course should not create payment
    if (price === 0) {
      throw { status: 400, message: 'Khóa học miễn phí, không cần thanh toán' };
    }

    // Check for existing pending payment
    const existingPayment = await Payment.findOne({
      where: {
        userId,
        courseId,
        status: 'pending',
      },
      order: [['created_at', 'DESC']],
    });

    if (existingPayment) {
      // Return existing pending payment
      return { 
        payment: existingPayment,
        isNew: false,
      };
    }

    // Check for completed payment
    const completedPayment = await Payment.findOne({
      where: {
        userId,
        courseId,
        status: 'completed',
      },
    });

    if (completedPayment) {
      throw { status: 409, message: 'Bạn đã thanh toán khóa học này rồi' };
    }

    // Create new payment record
    const amount = customAmount || price;
    const providerTxn = generateProviderTxn(provider);

    const payment = await Payment.create({
      userId,
      courseId,
      amount,
      currency: 'USD',
      provider,
      providerTxn,
      status: 'pending',
      paymentDetails: {
        initiatedAt: new Date().toISOString(),
      },
    });

    return { 
      payment,
      isNew: true,
    };
  }

  /**
   * Create payment from cart (multiple courses)
   * This is for student buying multiple courses at once
   */
  async createPaymentFromCart(userId, selectedItemIds = null) {
    // Get cart items
    const cartData = await cartService.convertCartToPayment(userId, selectedItemIds);
    
    if (cartData.items.length === 0) {
      throw { status: 400, message: 'Giỏ hàng trống hoặc không có khóa học hợp lệ' };
    }

    // Create a parent payment record for the entire cart
    const providerTxn = generateProviderTxn('mock');
    
    // Create individual payment records for each course
    const payments = [];
    for (const item of cartData.items) {
      const existingPending = await Payment.findOne({
        where: {
          userId,
          courseId: item.courseId,
          status: 'pending',
        },
      });

      if (existingPending) {
        payments.push(existingPending);
        continue;
      }

      const payment = await Payment.create({
        userId,
        courseId: item.courseId,
        amount: Number(item.course.price || 0),
        currency: 'USD',
        provider: 'mock',
        providerTxn: `${providerTxn}_course_${item.courseId}`,
        status: 'pending',
        paymentDetails: {
          initiatedAt: new Date().toISOString(),
          source: 'cart',
          cartItemId: item.id,
          parentTxn: providerTxn,
        },
      });
      payments.push(payment);
    }

    return {
      payments,
      totalAmount: cartData.totalAmount,
      itemCount: cartData.itemCount,
      providerTxn,
      courses: cartData.items.map(item => ({
        id: item.courseId,
        title: item.course.title,
        price: item.course.price,
      })),
    };
  }

  /**
   * Process payment success/failure callback
   * Also handles creating payment if courseId is provided (for backward compatibility)
   */
  async processPayment(userId, processData) {
    const { paymentId, courseId, status = 'completed', providerTxn, provider = 'mock', cartCheckout = false } = processData;

    // If cart checkout, process all pending payments for user
    if (cartCheckout) {
      return this._processCartCheckout(userId, status);
    }

    let payment;

    if (paymentId) {
      // Process existing payment
      payment = await Payment.findOne({
        where: {
          id: paymentId,
          userId,
        },
      });

      if (!payment) {
        throw { status: 404, message: 'Không tìm thấy giao dịch thanh toán' };
      }
    } else if (courseId) {
      // Create new payment for course and process immediately
      const course = await Course.findByPk(courseId);
      if (!course) {
        throw { status: 404, message: 'Không tìm thấy khóa học' };
      }

      const price = Number(course.price || 0);
      const providerTxnNew = generateProviderTxn(provider);

      // Create payment with completed status for mock provider
      payment = await Payment.create({
        userId,
        courseId,
        amount: price,
        currency: 'USD',
        provider,
        providerTxn: providerTxn || providerTxnNew,
        status: status,
        paymentDetails: {
          initiatedAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
          finalStatus: status,
          source: 'direct',
        },
      });

      // If payment successful, auto-enroll user
      let enrollment = null;
      if (status === 'completed') {
        enrollment = await this._enrollAfterPayment(userId, courseId);
        // Remove from cart if exists
        await cartService.removeCourseFromCart(userId, courseId);
      }

      return { 
        payment,
        enrollment,
        isNew: true,
      };
    } else {
      throw { status: 400, message: 'Thiếu paymentId hoặc courseId' };
    }

    if (payment.status !== 'pending') {
      throw { 
        status: 400, 
        message: `Giao dịch đã ở trạng thái ${payment.status}, không thể cập nhật`,
      };
    }

    // Process with mock payment processor
    const processResult = await mockProcessor.process({
      amount: payment.amount,
      currency: payment.currency,
      providerTxn: payment.providerTxn,
    });

    // Update payment status
    payment.status = processResult.status;
    payment.paymentDetails = {
      ...payment.paymentDetails,
      ...processResult.mockDetails,
      processedAt: processResult.processedAt,
      processorResponse: processResult,
    };

    await payment.save();

    // If payment successful, auto-enroll user
    let enrollment = null;
    if (payment.status === 'completed') {
      enrollment = await this._enrollAfterPayment(userId, payment.courseId);
      // Remove from cart if it was from cart
      await cartService.removeCourseFromCart(userId, payment.courseId);
    }

    return { 
      payment,
      enrollment,
      isNew: false,
      processorResult: processResult,
    };
  }

  /**
   * Process cart checkout (multiple courses)
   */
  async _processCartCheckout(userId, requestedStatus = 'completed') {
    // Get all pending payments for user
    const pendingPayments = await Payment.findAll({
      where: {
        userId,
        status: 'pending',
      },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'price', 'published'],
        },
      ],
    });

    if (pendingPayments.length === 0) {
      throw { status: 400, message: 'Không có giao dịch chờ thanh toán' };
    }

    const results = [];
    const successfulCourseIds = [];
    let totalProcessed = 0;
    let totalFailed = 0;

    // Process each payment
    for (const payment of pendingPayments) {
      try {
        // Process with mock processor
        const processResult = await mockProcessor.process({
          amount: payment.amount,
          currency: payment.currency,
          providerTxn: payment.providerTxn,
        });

        // Update payment status
        payment.status = processResult.status;
        payment.paymentDetails = {
          ...payment.paymentDetails,
          ...processResult.mockDetails,
          processedAt: processResult.processedAt,
          processorResponse: processResult,
        };

        await payment.save();

        let enrollment = null;
        if (payment.status === 'completed') {
          enrollment = await this._enrollAfterPayment(userId, payment.courseId);
          successfulCourseIds.push(payment.courseId);
          totalProcessed += payment.amount;
        } else {
          totalFailed += payment.amount;
        }

        results.push({
          paymentId: payment.id,
          courseId: payment.courseId,
          courseTitle: payment.course?.title,
          status: payment.status,
          amount: payment.amount,
          enrollment,
          message: processResult.message,
        });
      } catch (error) {
        results.push({
          paymentId: payment.id,
          courseId: payment.courseId,
          status: 'failed',
          amount: payment.amount,
          error: error.message,
        });
        totalFailed += payment.amount;
      }
    }

    // Remove successfully paid courses from cart
    if (successfulCourseIds.length > 0) {
      await cartService.removePaidItemsFromCart(userId, successfulCourseIds);
    }

    return {
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.status === 'completed').length,
        failed: results.filter(r => r.status === 'failed').length,
        totalAmount: totalProcessed,
        failedAmount: totalFailed,
      },
    };
  }

  /**
   * Get payment history for user
   */
  async getPaymentHistory(userId, query = {}) {
    const { courseId } = query;

    const where = { userId };
    if (courseId) {
      where.courseId = courseId;
    }

    const payments = await Payment.findAll({
      where,
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug', 'imageUrl'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    return { payments };
  }

  /**
   * Get payment detail
   */
  async getPaymentDetail(paymentId, userId) {
    const payment = await Payment.findOne({
      where: {
        id: paymentId,
        userId,
      },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug', 'imageUrl', 'price'],
        },
      ],
    });

    if (!payment) {
      throw { status: 404, message: 'Không tìm thấy giao dịch thanh toán' };
    }

    return { payment };
  }

  /**
   * Process refund for a payment
   */
  async processRefund(userId, paymentId, reason) {
    const payment = await Payment.findOne({
      where: { id: paymentId, userId },
      include: [
        {
          model: Course,
          as: 'course',
        },
      ],
    });

    if (!payment) {
      throw { status: 404, message: 'Không tìm thấy giao dịch' };
    }

    if (payment.status !== 'completed') {
      throw { status: 400, message: 'Chỉ có thể hoàn tiền cho giao dịch đã hoàn thành' };
    }

    // Check if user is enrolled
    const enrollment = await Enrollment.findOne({
      where: { userId, courseId: payment.courseId },
    });

    if (!enrollment) {
      throw { status: 400, message: 'Bạn chưa đăng ký khóa học này' };
    }

    // Check if can refund (e.g., within 30 days, not completed too much)
    const daysSincePurchase = Math.floor(
      (Date.now() - new Date(payment.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSincePurchase > 30) {
      throw { status: 400, message: 'Đã quá thời hạn hoàn tiền (30 ngày)' };
    }

    // Process refund with mock processor
    const refundResult = await mockProcessor.refund({
      providerTxn: payment.providerTxn,
      amount: payment.amount,
    });

    if (refundResult.success) {
      payment.status = 'refunded';
      payment.paymentDetails = {
        ...payment.paymentDetails,
        refundReason: reason,
        refundTxn: refundResult.refundTxn,
        refundedAt: refundResult.processedAt,
      };
      await payment.save();

      // Unenroll user
      if (enrollment) {
        enrollment.status = 'refunded';
        await enrollment.save();
      }
    }

    return {
      payment,
      refund: refundResult,
    };
  }

  /**
   * Internal: Enroll user after successful payment
   */
  async _enrollAfterPayment(userId, courseId) {
    // Check if already enrolled
    const existing = await Enrollment.findOne({
      where: { userId, courseId },
    });

    if (existing) {
      return existing;
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      userId,
      courseId,
      status: 'enrolled',
      progressPercent: 0,
    });

    // Update course students count
    try {
      await courseAggregatesService.recomputeCourseStudents(courseId);
    } catch (aggErr) {
      console.error('Recompute course students (silent) error:', aggErr);
    }

    return enrollment;
  }

  /**
   * Create MoMo payment
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @returns {Promise<Object>} - Payment URL and transaction info
   */
  async createMoMoPayment(userId, courseId) {
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (!course.published) {
      throw { status: 400, message: 'Khóa học chưa được xuất bản' };
    }

    // Check if user already enrolled
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

    // Generate unique order ID
    const orderId = momoService.generateOrderId(userId);

    // Create payment record
    const payment = await Payment.create({
      userId,
      courseId,
      amount: price,
      currency: 'VND',
      provider: 'momo',
      providerTxn: orderId,
      status: 'pending',
      paymentDetails: {
        initiatedAt: new Date().toISOString(),
        source: 'momo',
        provider: 'momo',
      },
    });

    // Create MoMo payment
    const momoResult = await momoService.createPayment({
      orderId,
      amount: price,
      orderInfo: `Thanh toan khoa hoc: ${course.title}`,
    });

    if (!momoResult.success) {
      throw { status: 500, message: momoResult.message || 'Không thể tạo thanh toán MoMo' };
    }

    return {
      payment,
      payUrl: momoResult.payUrl,
      deeplink: momoResult.deeplink,
      qrCodeUrl: momoResult.qrCodeUrl,
      orderId,
      course: {
        id: course.id,
        title: course.title,
        price: course.price,
      },
    };
  }

  /**
   * Process MoMo return/callback
   * @param {Object} callbackData - Data from MoMo
   * @returns {Promise<Object>} - Payment result
   */
  async processMoMoReturn(callbackData) {
    const result = momoService.processCallback(callbackData);

    if (!result.success) {
      return {
        success: false,
        message: result.message,
      };
    }

    // Find payment by orderId
    const payment = await Payment.findOne({
      where: { providerTxn: result.orderId },
      include: [{ model: Course, as: 'course' }],
    });

    if (!payment) {
      throw { status: 404, message: 'Không tìm thấy giao dịch' };
    }

    // Update payment status
    payment.status = 'completed';
    payment.paymentDetails = {
      ...payment.paymentDetails,
      processedAt: new Date().toISOString(),
      transId: result.transId,
      resultCode: result.resultCode,
      payType: result.payType,
    };
    await payment.save();

    // Enroll user
    let enrollment = null;
    try {
      enrollment = await this._enrollAfterPayment(payment.userId, payment.courseId);
      // Remove from cart if exists
      await cartService.removeCourseFromCart(payment.userId, payment.courseId);
    } catch (err) {
      console.error('Auto enrollment error:', err);
    }

    return {
      success: true,
      message: 'Thanh toán thành công',
      payment,
      enrollment,
      course: payment.course,
    };
  }

  /**
   * Process MoMo IPN (Instant Payment Notification)
   * @param {Object} callbackData - Data from MoMo
   * @returns {Promise<Object>} - IPN response
   */
  async processMoMoIpn(callbackData) {
    const result = momoService.processCallback(callbackData);

    if (result.success) {
      // Payment successful, update and enroll
      try {
        const payment = await Payment.findOne({
          where: { providerTxn: result.orderId },
        });

        if (payment && payment.status === 'pending') {
          payment.status = 'completed';
          payment.paymentDetails = {
            ...payment.paymentDetails,
            processedAt: new Date().toISOString(),
            transId: result.transId,
            resultCode: result.resultCode,
            payType: result.payType,
            ipnProcessed: true,
          };
          await payment.save();

          // Auto enroll
          await this._enrollAfterPayment(payment.userId, payment.courseId);
          await cartService.removeCourseFromCart(payment.userId, payment.courseId);
        }
      } catch (err) {
        console.error('MoMo IPN enrollment error:', err);
      }
    }

    return result;
  }

  /**
   * Create VNPay payment URL
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @param {string} ipAddr - Client IP address
   * @returns {Promise<Object>} - Payment URL and transaction info
   */
  async createVNPayPayment(userId, courseId, ipAddr) {
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (!course.published) {
      throw { status: 400, message: 'Khóa học chưa được xuất bản' };
    }

    // Check if user already enrolled
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

    // Generate unique transaction reference
    const txnRef = vnpayService.generateTxnRef(userId);
    
    // Create payment record
    const payment = await Payment.create({
      userId,
      courseId,
      amount: price,
      currency: 'VND',
      provider: 'vnpay',
      providerTxn: txnRef,
      status: 'pending',
      paymentDetails: {
        initiatedAt: new Date().toISOString(),
        source: 'vnpay',
        provider: 'vnpay',
      },
    });

    // Create VNPay payment URL
    const paymentUrl = await vnpayService.createPaymentUrl({
      orderId: `COURSE_${courseId}_${payment.id}`,
      amount: price,
      orderDescription: `Thanh toan khoa hoc: ${course.title}`,
      ipAddr: ipAddr || '127.0.0.1',
      txnRef: txnRef,
    });

    return {
      payment,
      paymentUrl,
      txnRef,
      course: {
        id: course.id,
        title: course.title,
        price: course.price,
      },
    };
  }

  /**
   * Process VNPay return/callback
   * @param {Object} vnpParams - Query params from VNPay
   * @returns {Promise<Object>} - Payment result
   */
  async processVNPayReturn(vnpParams) {
    const result = await vnpayService.processReturnUrl(vnpParams);
    
    if (!result.success) {
      return {
        success: false,
        message: result.message,
        responseCode: result.responseCode,
        txnRef: result.txnRef,
      };
    }

    // Find payment by txnRef
    const payment = await Payment.findOne({
      where: { providerTxn: result.txnRef },
      include: [{ model: Course, as: 'course' }],
    });

    if (!payment) {
      throw { status: 404, message: 'Không tìm thấy giao dịch' };
    }

    // Update payment status
    payment.status = 'completed';
    payment.paymentDetails = {
      ...payment.paymentDetails,
      processedAt: new Date().toISOString(),
      bankCode: result.bankCode,
      bankTranNo: result.bankTranNo,
      cardType: result.cardType,
      payDate: result.payDate,
      transactionNo: result.transactionNo,
      responseCode: result.responseCode,
    };
    await payment.save();

    // Enroll user
    let enrollment = null;
    try {
      enrollment = await this._enrollAfterPayment(payment.userId, payment.courseId);
      // Remove from cart if exists
      await cartService.removeCourseFromCart(payment.userId, payment.courseId);
    } catch (err) {
      console.error('Auto enrollment error:', err);
    }

    return {
      success: true,
      message: 'Thanh toán thành công',
      payment,
      enrollment,
      course: payment.course,
    };
  }

  /**
   * Process VNPay IPN (Instant Payment Notification)
   * @param {Object} vnpParams - Query params from VNPay
   * @returns {Promise<Object>} - IPN response for VNPay
   */
  async processVNPayIpn(vnpParams) {
    const result = await vnpayService.processIpn(vnpParams);
    
    if (result.RspCode === '00') {
      // Payment successful, update and enroll
      try {
        const payment = await Payment.findOne({
          where: { providerTxn: result.txnRef },
        });
        
        if (payment && payment.status === 'pending') {
          payment.status = 'completed';
          payment.paymentDetails = {
            ...payment.paymentDetails,
            processedAt: new Date().toISOString(),
            bankCode: result.bankCode,
            transactionNo: result.transactionNo,
            ipnProcessed: true,
          };
          await payment.save();

          // Auto enroll
          await this._enrollAfterPayment(payment.userId, payment.courseId);
          await cartService.removeCourseFromCart(payment.userId, payment.courseId);
        }
      } catch (err) {
        console.error('IPN enrollment error:', err);
      }
    }

    return result;
  }
}

module.exports = new PaymentService();
module.exports.MockPaymentProcessor = MockPaymentProcessor;
