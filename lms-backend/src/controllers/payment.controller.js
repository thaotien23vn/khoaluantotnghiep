const db = require('../models');
const { Payment, Enrollment, Course, User } = db.models;
const { validationResult } = require('express-validator');
const crypto = require('crypto');

/**
 * @desc    Process payment for course enrollment
 * @route   POST /api/student/payments/process
 * @access  Private (Student & Admin)
 */
exports.processPayment = async (req, res) => {
  try {
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

    const payment = await Payment.findByPk(paymentId, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'price']
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
        message: 'Bạn không có quyền xác thực giao dịch này'
      });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Giao dịch đã được xử lý'
      });
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
        return res.status(400).json({
          success: false,
          message: 'Phương thức thanh toán không được hỗ trợ'
        });
    }

    if (verificationResult.success) {
      // Update payment status
      await payment.update({
        status: 'completed',
        paymentDetails: {
          ...payment.paymentDetails,
          ...verificationResult.paymentDetails
        }
      });

      // Create enrollment
      const enrollment = await Enrollment.create({
        userId: payment.userId,
        courseId: payment.courseId,
        status: 'enrolled',
        progressPercent: 0,
        enrolledAt: new Date()
      });

      res.json({
        success: true,
        message: 'Thanh toán thành công. Bạn đã được đăng ký khóa học.',
        data: {
          payment,
          enrollment
        }
      });
    } else {
      await payment.update({
        status: 'failed',
        paymentDetails: {
          ...payment.paymentDetails,
          error: verificationResult.error
        }
      });

      res.status(400).json({
        success: false,
        message: 'Thanh toán thất bại',
        error: verificationResult.error
      });
    }
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
      order: [['createdAt', 'DESC']],
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
