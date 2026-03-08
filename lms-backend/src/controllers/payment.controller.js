const db = require('../models');
const { Payment, Enrollment, Course, User } = db.models;
const { validationResult } = require('express-validator');
const crypto = require('crypto');
 const notificationController = require('./notification.controller');
 const courseAggregatesService = require('../services/courseAggregates.service');

/**
 * @desc    Process payment for course enrollment
 * @route   POST /api/student/payments/process
 * @access  Private (Student & Admin)
 */
exports.processPayment = async (req, res) => {
  try {
    // Business rule: payment flow is for students
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ học viên mới được thực hiện thanh toán ghi danh',
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    const { courseId, paymentMethod, paymentDetails } = req.body;

    // Check if course exists
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học'
      });
    }

    if (!course.published) {
      return res.status(400).json({
        success: false,
        message: 'Khóa học chưa được xuất bản'
      });
    }

    // Business rule: instructor cannot enroll own course
    if (course.createdBy && Number(course.createdBy) === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể thanh toán/ghi danh vào khóa học do chính bạn tạo',
      });
    }

    // Check if course is free
    if (course.price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Khóa học miễn phí, không cần thanh toán'
      });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      where: {
        userId: req.user.id,
        courseId,
        status: 'enrolled'
      }
    });

    if (existingEnrollment) {
      return res.status(409).json({
        success: false,
        message: 'Bạn đã đăng ký khóa học này'
      });
    }

    // Check if there's a pending payment
    const pendingPayment = await Payment.findOne({
      where: {
        userId: req.user.id,
        courseId,
        status: 'pending'
      }
    });

    if (pendingPayment) {
      return res.status(409).json({
        success: false,
        message: 'Bạn có một giao dịch đang chờ xử lý',
        data: { payment: pendingPayment }
      });
    }

    // Generate transaction ID
    const transactionId = `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Create payment record
    const payment = await Payment.create({
      userId: req.user.id,
      courseId,
      amount: course.price,
      currency: 'USD',
      provider: paymentMethod, // 'stripe', 'paypal', 'bank_transfer', etc.
      providerTxn: transactionId,
      status: 'pending',
      paymentDetails: paymentDetails || {}
    });

    // Process payment based on method
    let paymentResult;
    switch (paymentMethod) {
      case 'stripe':
        paymentResult = await processStripePayment(payment, course, paymentDetails);
        break;
      case 'paypal':
        paymentResult = await processPaypalPayment(payment, course, paymentDetails);
        break;
      case 'bank_transfer':
        paymentResult = await processBankTransfer(payment, course);
        break;
      case 'mock':
        paymentResult = await processMockPayment(payment, course);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Phương thức thanh toán không được hỗ trợ'
        });
    }

    res.status(201).json({
      success: true,
      message: 'Yêu cầu thanh toán đã được tạo',
      data: paymentResult
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Verify payment and complete enrollment
 * @route   POST /api/student/payments/verify
 * @access  Private (Student & Admin)
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { paymentId, verificationData } = req.body;

    let enrollmentCreated = null;
    let notifyUserId = null;
    let notifyCourseId = null;
    let notifyAmount = null;

    const result = await db.sequelize.transaction(async (t) => {
      const payment = await Payment.findByPk(paymentId, {
        include: [
          {
            model: Course,
            as: 'course',
            attributes: ['id', 'title', 'price']
          }
        ],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!payment) {
        return { kind: 'error', status: 404, body: { success: false, message: 'Không tìm thấy giao dịch' } };
      }

      if (payment.userId !== req.user.id && req.user.role !== 'admin') {
        return { kind: 'error', status: 403, body: { success: false, message: 'Bạn không có quyền xác thực giao dịch này' } };
      }

    // Business rule: only verify payments for student enrollments
      const paymentUser = await User.findByPk(payment.userId, { transaction: t, lock: t.LOCK.SHARE });
      if (!paymentUser || paymentUser.role !== 'student') {
        return { kind: 'error', status: 400, body: { success: false, message: 'Chỉ hỗ trợ thanh toán/ghi danh cho học viên (role=student)' } };
      }

      if (payment.status !== 'pending') {
        return { kind: 'error', status: 400, body: { success: false, message: 'Giao dịch đã được xử lý' } };
      }

    // Verify payment based on provider
    let verificationResult;
      switch (payment.provider) {
      case 'stripe':
        verificationResult = await verifyStripePayment(payment, verificationData);
        break;
      case 'paypal':
        verificationResult = await verifyPaypalPayment(payment, verificationData);
        break;
      case 'bank_transfer':
        verificationResult = await verifyBankTransfer(payment, verificationData);
        break;
      case 'mock':
        verificationResult = await verifyMockPayment(payment, verificationData);
        break;
      default:
        return { kind: 'error', status: 400, body: { success: false, message: 'Phương thức thanh toán không được hỗ trợ' } };
    }

      if (verificationResult.success) {
      // Update payment status
      await payment.update({
        status: 'completed',
        paymentDetails: {
          ...payment.paymentDetails,
          ...verificationResult.paymentDetails
        }
      }, { transaction: t });

      // Business rule: instructor cannot enroll own course
        const course = await Course.findByPk(payment.courseId, { transaction: t, lock: t.LOCK.SHARE });
        if (course?.createdBy && Number(course.createdBy) === Number(payment.userId)) {
          return { kind: 'error', status: 400, body: { success: false, message: 'Không thể ghi danh vào khóa học do chính người học tạo' } };
        }

      // Create enrollment
        const enrollment = await Enrollment.create({
        userId: payment.userId,
        courseId: payment.courseId,
        status: 'enrolled',
        progressPercent: 0,
        enrolledAt: new Date()
      }, { transaction: t });

        try {
          await courseAggregatesService.recomputeCourseStudents(payment.courseId, { transaction: t });
        } catch (aggErr) {
          console.error('Recompute course students (silent) error:', aggErr);
        }

        enrollmentCreated = enrollment;
        notifyUserId = payment.userId;
        notifyCourseId = payment.courseId;
        notifyAmount = payment.amount;

        return {
          kind: 'success',
          body: {
            success: true,
            message: 'Thanh toán thành công. Bạn đã được đăng ký khóa học.',
            data: {
              payment,
              enrollment: enrollmentCreated,
            },
          },
        };
      } else {
      await payment.update({
        status: 'failed',
        paymentDetails: {
          ...payment.paymentDetails,
          error: verificationResult.error
        }
      }, { transaction: t });

        return {
          kind: 'error',
          status: 400,
          body: {
            success: false,
            message: 'Thanh toán thất bại',
            error: verificationResult.error,
          },
        };
      }
    });

    if (result.kind === 'error') {
      return res.status(result.status).json(result.body);
    }

    try {
      await notificationController.createPaymentNotification(notifyUserId, notifyCourseId, notifyAmount);
    } catch (notifyErr) {
      console.error('Create payment notification (silent) error:', notifyErr);
    }

    try {
      await notificationController.createEnrollmentNotification(notifyUserId, notifyCourseId);
    } catch (notifyErr) {
      console.error('Create enrollment notification (silent) error:', notifyErr);
    }

    return res.json(result.body);
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Get payment history
 * @route   GET /api/student/payments
 * @access  Private (Student & Admin)
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {
      userId: req.user.id
    };

    if (status) {
      whereClause.status = status;
    }

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'price']
        }
      ],
      order: [[db.sequelize.col('Payment.created_at'), 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Get payment details
 * @route   GET /api/student/payments/:paymentId
 * @access  Private (Student & Admin)
 */
exports.getPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findByPk(paymentId, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'price', 'description']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy giao dịch'
      });
    }

    if (payment.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem giao dịch này'
      });
    }

    res.json({
      success: true,
      data: { payment }
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

// ========== PAYMENT PROCESSING FUNCTIONS ==========

/**
 * Process Stripe payment (mock implementation)
 */
async function processStripePayment(payment, course, paymentDetails) {
  // Mock Stripe processing
  // In real implementation, integrate with Stripe SDK
  return {
    success: true,
    paymentUrl: `https://checkout.stripe.com/pay?payment_id=${payment.id}`,
    paymentId: payment.providerTxn,
    message: 'Vui lòng hoàn thành thanh toán qua Stripe'
  };
}

/**
 * Process PayPal payment (mock implementation)
 */
async function processPaypalPayment(payment, course, paymentDetails) {
  // Mock PayPal processing
  // In real implementation, integrate with PayPal SDK
  return {
    success: true,
    paymentUrl: `https://www.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=${payment.providerTxn}`,
    paymentId: payment.providerTxn,
    message: 'Vui lòng hoàn thành thanh toán qua PayPal'
  };
}

/**
 * Process bank transfer
 */
async function processBankTransfer(payment, course) {
  // Generate bank transfer instructions
  const bankInfo = {
    bankName: 'Vietcombank',
    accountNumber: '1234567890',
    accountName: 'LMS SYSTEM',
    amount: payment.amount,
    content: `Payment ${payment.providerTxn}`
  };

  await payment.update({
    paymentDetails: {
      bankInfo,
      instructions: 'Vui lòng chuyển khoản với nội dung chính xác'
    }
  });

  return {
    success: true,
    bankInfo,
    message: 'Vui lòng chuyển khoản theo thông tin đã cung cấp'
  };
}

/**
 * Process mock payment for testing
 */
async function processMockPayment(payment, course) {
  // Simulate instant payment success
  await payment.update({
    status: 'completed',
    paymentDetails: {
      method: 'mock',
      processedAt: new Date()
    }
  });

  // Create enrollment
  await Enrollment.create({
    userId: payment.userId,
    courseId: payment.courseId,
    status: 'enrolled',
    progressPercent: 0,
    enrolledAt: new Date()
  });

  try {
    await courseAggregatesService.recomputeCourseStudents(payment.courseId);
  } catch (aggErr) {
    console.error('Recompute course students (silent) error:', aggErr);
  }

  try {
    await notificationController.createPaymentNotification(payment.userId, payment.courseId, payment.amount);
  } catch (notifyErr) {
    console.error('Create payment notification (silent) error:', notifyErr);
  }

  try {
    await notificationController.createEnrollmentNotification(payment.userId, payment.courseId);
  } catch (notifyErr) {
    console.error('Create enrollment notification (silent) error:', notifyErr);
  }

  return {
    success: true,
    payment: payment,
    enrollment: 'created',
    message: 'Thanh toán giả lập thành công'
  };
}

/**
 * Verify Stripe payment (mock)
 */
async function verifyStripePayment(payment, verificationData) {
  // Mock verification
  return {
    success: true,
    paymentDetails: {
      stripeChargeId: `ch_${Date.now()}`,
      verifiedAt: new Date()
    }
  };
}

/**
 * Verify PayPal payment (mock)
 */
async function verifyPaypalPayment(payment, verificationData) {
  // Mock verification
  return {
    success: true,
    paymentDetails: {
      paypalTransactionId: `PAYID_${Date.now()}`,
      verifiedAt: new Date()
    }
  };
}

/**
 * Verify bank transfer (admin approval)
 */
async function verifyBankTransfer(payment, verificationData) {
  // Bank transfer requires manual verification
  return {
    success: false,
    error: 'Chuyển khoản cần được xác nhận thủ công bởi quản trị viên'
  };
}

/**
 * Verify mock payment
 */
async function verifyMockPayment(payment, verificationData) {
  return {
    success: true,
    paymentDetails: {
      mockVerified: true,
      verifiedAt: new Date()
    }
  };
}
