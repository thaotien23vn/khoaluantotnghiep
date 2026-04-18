const db = require('../../models');
const cartService = require('../cart/cart.service');
const courseAggregatesService = require('../../services/courseAggregates.service');
const vnpayService = require('../../services/vnpay.service');

const { Payment, Course, User, Enrollment, LectureProgress } = db.models;

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
    const months = Number(renewalMonths);
    if (!Number.isFinite(months) || months <= 0) {
      return null;
    }

    const where = enrollmentId
      ? { id: Number(enrollmentId), userId: Number(userId), courseId: Number(courseId) }
      : { userId: Number(userId), courseId: Number(courseId) };

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

    // Price tampering defense: always use authoritative Course.price
    // If client sent amount, ignore it (do not trust client input).
    // Keep API contract compatible by not failing old clients that send amount.
    const amount = price;
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

      if (!course.published) {
        throw { status: 400, message: 'Khóa học chưa được xuất bản' };
      }

      const price = Number(course.price || 0);
      if (price === 0) {
        throw { status: 400, message: 'Khóa học miễn phí, không cần thanh toán' };
      }
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
   * Get payment history for user — FIXED: with pagination and status filter
   */
  async getPaymentHistory(userId, query = {}) {
    const { courseId, status, page = 1, limit = 10 } = query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const where = { userId };
    if (courseId) where.courseId = courseId;
    if (status) where.status = status;

    const { count, rows: payments } = await Payment.findAndCountAll({
      where,
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug', 'imageUrl'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: limitNum,
      offset,
    });

    // Manually sum to handle mixed currencies
    const allPayments = await Payment.findAll({
      where: {
        userId,
        status: 'completed',
      },
      attributes: ['amount', 'currency'],
    });

    const totalSpent = allPayments.reduce((sum, p) => {
      const amt = Number(p.amount || 0);
      const isUSD = p.currency?.toUpperCase() === 'USD';
      
      if (isUSD) {
        // If USD amount is large (> 1000), it's probably mislabeled VND
        if (amt >= 1000) return sum + amt;
        // Otherwise convert real USD to VND (approx 25,000 rate)
        return sum + (amt * 25000);
      }
      return sum + amt;
    }, 0);

    return {
      payments,
      totalSpent: Math.round(totalSpent),
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    };
  }

  /**
   * Generate Invoice PDF
   */
  async generateInvoicePDF(paymentId, userId) {
    const payment = await Payment.findOne({
      where: { id: paymentId, userId },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'price'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    if (!payment) {
      throw { status: 404, message: 'Không tìm thấy giao dịch thanh toán' };
    }

    if (payment.status !== 'completed') {
      throw { status: 400, message: 'Chỉ có thể xuất hóa đơn cho giao dịch thành công' };
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    // Register font to support Vietnamese
    const fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
    doc.registerFont('Arial', fontPath);
    doc.font('Arial');

    // Header logic
    doc.fillColor('#444444')
      .fontSize(20)
      .text('HÓA ĐƠN THANH TOÁN', 110, 57)
      .fontSize(10)
      .text('E-Learning Project', 200, 65, { align: 'right' })
      .text('123 Đường ABC, Quận XYZ', 200, 80, { align: 'right' })
      .moveDown();

    // Line separator
    doc.strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, 100)
      .lineTo(550, 100)
      .stroke();

    // Information Section
    const paymentDate = payment.updatedAt || payment.updated_at || new Date();
    doc.fontSize(12)
      .text(`Mã hóa đơn: #INV-${payment.id}`, 50, 115)
      .text(`Ngày thanh toán: ${new Date(paymentDate).toLocaleDateString('vi-VN')}`, 50, 130)
      .text(`Phương thức: ${payment.provider.toUpperCase()}`, 50, 145)
      .moveDown();

    doc.text('THÔNG TIN KHÁCH HÀNG', 50, 170, { underline: true })
      .text(`Họ tên: ${payment.user?.name || 'N/A'}`, 50, 185)
      .text(`Email: ${payment.user?.email || 'N/A'}`, 50, 200)
      .moveDown();

    // Table Header
    doc.fillColor('#444444')
      .fontSize(10)
      .text('Tên khóa học', 50, 230)
      .text('Số lượng', 280, 230, { width: 90, align: 'right' })
      .text('Giá', 370, 230, { width: 90, align: 'right' })
      .text('Thành tiền', 460, 230, { width: 90, align: 'right' });

    doc.strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, 245)
      .lineTo(550, 245)
      .stroke();

    // Table Row
    const courseTitle = payment.course?.title || 'Khóa học';
    const amount = Number(payment.amount);
    const currencyLabel = (payment.currency || 'VND').toUpperCase() === 'USD' ? '$' : 'đ';
    const formattedAmount = amount.toLocaleString('vi-VN');

    doc.fontSize(10)
      .text(courseTitle, 50, 255)
      .text('1', 280, 255, { width: 90, align: 'right' })
      .text(`${formattedAmount}${currencyLabel}`, 370, 255, { width: 90, align: 'right' })
      .text(`${formattedAmount}${currencyLabel}`, 460, 255, { width: 90, align: 'right' });

    // Total section
    doc.strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, 275)
      .lineTo(550, 275)
      .stroke();

    doc.fontSize(14)
      .fillColor('#000000')
      .text('TỔNG CỘNG:', 350, 290, { width: 100, align: 'right' })
      .text(`${formattedAmount}${currencyLabel}`, 460, 290, { width: 90, align: 'right' });

    // Footer
    doc.fontSize(10)
      .fillColor('#777777')
      .text('Cảm ơn bạn đã tin tưởng và tham gia khóa học của chúng tôi!', 50, 400, { align: 'center' });

    return doc;
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

    // FIXED: Anti-abuse for refunds (Don't allow if > 30% complete)
    if (enrollment.progressPercent > 30) {
      throw { status: 400, message: `Bạn đã học được ${enrollment.progressPercent}% khóa học. Chỉ có thể hoàn tiền khi tiến độ dưới 30% để đảm bảo tính công bằng.` };
    }

    // Check if can refund (e.g., within 30 days, not completed too much)
    const daysSincePurchase = Math.floor(
      (Date.now() - new Date(payment.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSincePurchase > 30) {
      throw { status: 400, message: 'Đã quá thời hạn giải quyết hoàn tiền (30 ngày)' };
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

      // FIXED: Destroy enrollment so student loses course access after refund
      if (enrollment) {
        await enrollment.destroy();
      }

      // Cleanup per-course lecture progress after refund unenroll
      try {
        await LectureProgress.destroy({ where: { userId, courseId: Number(payment.courseId) } });
      } catch (e) {
        console.error('Cleanup lecture progress after refund (silent) error:', e);
      }

      // Update course student count
      try {
        await courseAggregatesService.recomputeCourseStudents(payment.courseId);
      } catch (aggErr) {
        console.error('Recompute course students after refund (silent):', aggErr);
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
    let enrollment;
    try {
      enrollment = await Enrollment.create({
        userId,
        courseId,
        status: 'enrolled',
        enrollmentStatus: 'active',
        progressPercent: 0,
      });
    } catch (err) {
      if (err?.name === 'SequelizeUniqueConstraintError') {
        const existingAfterRace = await Enrollment.findOne({ where: { userId, courseId } });
        if (existingAfterRace) return existingAfterRace;
      }
      throw err;
    }

    // Update course students count
    try {
      await courseAggregatesService.recomputeCourseStudents(courseId);
    } catch (aggErr) {
      console.error('Recompute course students (silent) error:', aggErr);
    }

    return enrollment;
  }

  /**
   * Create VNPay payment URL
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @param {string} ipAddr - Client IP address
   * @returns {Promise<Object>} - Payment URL and transaction info
   */
  async createVNPayPayment(
    userId,
    courseId,
    ipAddr,
    isRenewal = false,
    renewalPrice = null,
    enrollmentId = null,
    renewalMonths = null
  ) {
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (!course.published) {
      throw { status: 400, message: 'Khóa học chưa được xuất bản' };
    }

    // Check if user already enrolled (skip for renewal)
    if (!isRenewal) {
      const existingEnrollment = await Enrollment.findOne({
        where: { userId, courseId },
      });
      if (existingEnrollment) {
        throw { status: 409, message: 'Bạn đã đăng ký khóa học này rồi' };
      }
    }

    // Use renewal price if provided, otherwise use full course price
    const price = renewalPrice && renewalPrice > 0 ? Number(renewalPrice) : Number(course.price || 0);
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
        isRenewal,
        enrollmentId: enrollmentId ? Number(enrollmentId) : null,
        renewalMonths: renewalMonths != null ? Number(renewalMonths) : null,
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

    // Replay-safe: if already completed, do not re-process/re-enroll
    if (payment.status === 'completed') {
      const enrollment = await Enrollment.findOne({
        where: { userId: payment.userId, courseId: payment.courseId },
      });
      return {
        success: true,
        message: 'Thanh toán thành công',
        payment,
        enrollment,
        course: payment.course,
        alreadyProcessed: true,
      };
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

    const isRenewal = Boolean(payment.paymentDetails?.isRenewal);
    const renewalMonths = Number(payment.paymentDetails?.renewalMonths);
    const renewalEnrollmentId = payment.paymentDetails?.enrollmentId;

    // Enroll user or renew existing enrollment
    let enrollment = null;
    try {
      if (isRenewal && Number.isFinite(renewalMonths) && renewalMonths > 0) {
        enrollment = await this._renewEnrollmentAfterPayment(
          payment.userId,
          payment.courseId,
          renewalMonths,
          renewalEnrollmentId
        );
      } else {
        enrollment = await this._enrollAfterPayment(payment.userId, payment.courseId);
      }
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

          const isRenewal = Boolean(payment.paymentDetails?.isRenewal);
          const renewalMonths = Number(payment.paymentDetails?.renewalMonths);
          const renewalEnrollmentId = payment.paymentDetails?.enrollmentId;

          // Auto enroll or renew
          if (isRenewal && Number.isFinite(renewalMonths) && renewalMonths > 0) {
            await this._renewEnrollmentAfterPayment(
              payment.userId,
              payment.courseId,
              renewalMonths,
              renewalEnrollmentId
            );
          } else {
            await this._enrollAfterPayment(payment.userId, payment.courseId);
          }
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
