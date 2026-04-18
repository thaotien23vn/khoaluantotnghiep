const { Op } = require('sequelize');
const db = require('../../models');

/**
 * Repair old renewal payments that are missing metadata or haven't had access applied
 */
class PaymentRepairService {
  /**
   * Scan and repair completed renewal payments missing accessAppliedAt
   */
  static async repairRenewalPayments(dryRun = false) {
    const { Payment, Enrollment, Course } = db.models;

    console.log('[PaymentRepair] Starting repair scan...');

    // Find completed payments with renewal metadata but no accessAppliedAt
    const payments = await Payment.findAll({
      where: {
        status: 'completed',
        [Op.or]: [
          { 'paymentDetails.isRenewal': true },
          { 'paymentDetails.source': 'stripe_renewal' },
          { 'paymentDetails.source': 'vnpay_renewal' },
          { 'paymentDetails.renewalMonths': { [Op.gt]: 0 } },
        ],
        [Op.or]: [
          { 'paymentDetails.accessAppliedAt': null },
          { 'paymentDetails.accessAppliedAt': { [Op.eq]: null } },
        ],
      },
      order: [['createdAt', 'ASC']],
    });

    console.log(`[PaymentRepair] Found ${payments.length} payments needing repair`);

    const results = {
      repaired: [],
      failed: [],
      dryRun,
    };

    for (const payment of payments) {
      try {
        const { userId, courseId, renewalMonths, enrollmentId, renewalPrice, source } = payment.paymentDetails || {};
        const months = Number(renewalMonths);

        if (!userId || !courseId || !Number.isFinite(months) || months <= 0) {
          results.failed.push({
            paymentId: payment.id,
            reason: 'Missing required metadata (userId, courseId, renewalMonths)',
          });
          continue;
        }

        if (dryRun) {
          results.repaired.push({
            paymentId: payment.id,
            userId,
            courseId,
            months,
            enrollmentId,
            wouldApply: true,
          });
          continue;
        }

        // Apply renewal
        const enrollment = await PaymentRepairService._applyRenewal(
          userId,
          courseId,
          months,
          enrollmentId
        );

        // Mark as repaired
        payment.paymentDetails = {
          ...payment.paymentDetails,
          accessAppliedAt: new Date().toISOString(),
          repairedAt: new Date().toISOString(),
        };
        await payment.save();

        results.repaired.push({
          paymentId: payment.id,
          userId,
          courseId,
          enrollmentId: enrollment?.id,
          newExpiresAt: enrollment?.expiresAt,
          applied: true,
        });

        console.log(`[PaymentRepair] Repaired payment ${payment.id} for user ${userId}, course ${courseId}`);
      } catch (error) {
        results.failed.push({
          paymentId: payment.id,
          reason: error.message,
        });
        console.error(`[PaymentRepair] Failed to repair payment ${payment.id}:`, error.message);
      }
    }

    return results;
  }

  /**
   * Apply renewal to enrollment
   */
  static async _applyRenewal(userId, courseId, months, enrollmentId) {
    const { Enrollment, Course } = db.models;

    const where = enrollmentId
      ? { id: Number(enrollmentId), userId: Number(userId), courseId: Number(courseId) }
      : { userId: Number(userId), courseId: Number(courseId) };

    const enrollment = await Enrollment.findOne({
      where,
      include: [{ model: Course, as: 'Course', attributes: ['id', 'gracePeriodDays'] }],
    });

    if (!enrollment) {
      throw new Error('Không tìm thấy ghi danh để gia hạn');
    }

    let startFrom = new Date();
    if (enrollment.expiresAt && enrollment.expiresAt > startFrom) {
      startFrom = enrollment.expiresAt;
    }

    const newExpiresAt = PaymentRepairService._calculateExpiryDate(startFrom, months, 'months');
    const graceDays = Number(enrollment.Course?.gracePeriodDays || 7);
    const newGracePeriodEndsAt = PaymentRepairService._addDays(newExpiresAt, graceDays);

    enrollment.expiresAt = newExpiresAt;
    enrollment.gracePeriodEndsAt = newGracePeriodEndsAt;
    enrollment.renewalCount = Number(enrollment.renewalCount || 0) + 1;
    enrollment.lastRenewedAt = new Date();
    enrollment.enrollmentStatus = 'active';
    await enrollment.save();

    return enrollment;
  }

  /**
   * Calculate expiry date
   */
  static _calculateExpiryDate(startDate, value, unit) {
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

  /**
   * Add days to date
   */
  static _addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}

module.exports = { PaymentRepairService };
