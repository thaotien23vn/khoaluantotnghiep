const db = require('../../models');
const courseAggregatesService = require('../../services/courseAggregates.service');

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
   * Process payment success/failure callback
   */
  async processPayment(userId, processData) {
    const { paymentId, status, providerTxn } = processData;

    const payment = await Payment.findOne({
      where: {
        id: paymentId,
        userId,
      },
    });

    if (!payment) {
      throw { status: 404, message: 'Không tìm thấy giao dịch thanh toán' };
    }

    if (payment.status !== 'pending') {
      throw { 
        status: 400, 
        message: `Giao dịch đã ở trạng thái ${payment.status}, không thể cập nhật`,
      };
    }

    // Update payment status
    payment.status = status;
    if (providerTxn) {
      payment.providerTxn = providerTxn;
    }
    payment.paymentDetails = {
      ...payment.paymentDetails,
      processedAt: new Date().toISOString(),
      finalStatus: status,
    };

    await payment.save();

    // If payment successful, auto-enroll user
    let enrollment = null;
    if (status === 'completed') {
      enrollment = await this._enrollAfterPayment(userId, payment.courseId);
    }

    return { 
      payment,
      enrollment,
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
}

module.exports = new PaymentService();
