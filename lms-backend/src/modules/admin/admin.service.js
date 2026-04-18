const bcrypt = require('bcryptjs');
const Sequelize = require('sequelize');
const db = require('../../models');
const logger = require('../../utils/logger');

const Op = Sequelize.Op || Sequelize.Sequelize?.Op;

const courseAggregatesService = require('../../services/courseAggregates.service');
const { User, Course, Enrollment, Review, Category, Payment, Attempt, LectureProgress, Notification, AdminActionLog } = db.models;

/**
 * Admin Service - Business logic for admin operations
 */
class AdminService {
  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    const [
      totalUsers,
      totalCourses,
      totalEnrollments,
      totalCategories,
      totalReviews,
      publishedCourses,
      totalPayments,
      completedPayments,
      failedPayments,
      revenueRow,
      avgRatingRow,
      totalAttempts,
      avgPercentageOverallRow,
    ] = await Promise.all([
      User.count(),
      Course.count(),
      Enrollment.count(),
      Category.count(),
      Review.count(),
      Course.count({ where: { published: true } }),
      Payment.count(),
      Payment.count({ where: { status: 'completed' } }),
      Payment.count({ where: { status: 'failed' } }),
      Payment.findOne({
        attributes: [[db.sequelize.fn('SUM', db.sequelize.col('amount')), 'totalRevenue']],
        where: { status: 'completed' },
        raw: true,
      }),
      Review.findOne({
        attributes: [[db.sequelize.fn('AVG', db.sequelize.col('rating')), 'avgRating']],
        raw: true,
      }),
      Attempt.count(),
      Attempt.findOne({
        attributes: [[db.sequelize.fn('AVG', db.sequelize.col('percentage_score')), 'avgPercentageOverall']],
        where: { completedAt: { [Op.ne]: null } },
        raw: true,
      }),
    ]);

    const totalRevenue = Number(revenueRow?.totalRevenue || 0);
    const avgRating = Number(avgRatingRow?.avgRating || 0);
    const avgPercentageOverall = Number(avgPercentageOverallRow?.avgPercentageOverall || 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const last7DaysRaw = await Attempt.findAll({
      attributes: [
        [db.sequelize.fn('DATE', db.sequelize.col('completed_at')), 'date'],
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'attempts'],
        [db.sequelize.fn('AVG', db.sequelize.col('percentage_score')), 'avgPercentage'],
      ],
      where: {
        completedAt: { [Op.ne]: null, [Op.gte]: sevenDaysAgo },
      },
      group: [db.sequelize.fn('DATE', db.sequelize.col('completed_at'))],
      order: [[db.sequelize.fn('DATE', db.sequelize.col('completed_at')), 'ASC']],
      raw: true,
    });

    const byDate = new Map(
      (last7DaysRaw || []).map((r) => [
        String(r.date),
        {
          date: String(r.date),
          attempts: Number(r.attempts || 0),
          avgPercentage: Number(r.avgPercentage || 0),
        },
      ])
    );

    const last7Days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      last7Days.push(byDate.get(key) || { date: key, attempts: 0, avgPercentage: 0 });
    }

    return {
      stats: {
        totalUsers,
        totalCourses,
        totalEnrollments,
        totalCategories,
        totalReviews,
        publishedCourses,
        totalPayments,
        completedPayments,
        failedPayments,
        totalRevenue,
        avgRating,
        learning: {
          totalAttempts,
          avgPercentageOverall,
          last7Days,
        },
      },
    };
  }

  /**
   * Get revenue by day for last 7 days
   */
  async getRevenueByDay() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const startDateStr = sevenDaysAgo.toISOString().slice(0, 10);

      const query = `
        SELECT 
          DATE(created_at) as date,
          COALESCE(SUM(amount), 0) as revenue,
          COUNT(*) as count
        FROM payments
        WHERE status = 'completed' 
          AND created_at >= :startDate
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
      `;

      const revenueRaw = await db.sequelize.query(query, {
        type: db.sequelize.QueryTypes.SELECT,
        replacements: { startDate: startDateStr },
      });

      const byDate = new Map(
        (revenueRaw || []).map((r) => [
          String(r.date),
          {
            date: String(r.date),
            revenue: Number(r.revenue || 0),
            count: Number(r.count || 0),
          },
        ])
      );

      const last7Days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        const dayData = byDate.get(key) || { date: key, revenue: 0, count: 0 };
        last7Days.push({
          date: key,
          dayOfWeek: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()],
          revenue: dayData.revenue,
          count: dayData.count,
        });
      }

      return { revenueByDay: last7Days };
    } catch (error) {
      console.error('[AdminService.getRevenueByDay] Error:', error);
      throw error;
    }
  }

  /**
   * Get top courses by enrollment count
   */
  async getTopCourses(limit = 5) {
    try {
      const query = `
        SELECT 
          c.id,
          c.title,
          c."imageUrl" as thumbnail,
          COUNT(e.id) as enrollmentCount
        FROM courses c
        LEFT JOIN enrollments e ON c.id = e.course_id
        GROUP BY c.id, c.title, c."imageUrl"
        ORDER BY enrollmentCount DESC
        LIMIT ${Number(limit)}
      `;
      
      const topCourses = await db.sequelize.query(query, {
        type: db.sequelize.QueryTypes.SELECT,
      });

      return {
        topCourses: (topCourses || []).map((c) => ({
          id: c.id,
          title: c.title,
          thumbnail: c.thumbnail,
          enrollmentCount: Number(c.enrollmentCount || 0),
        })),
      };
    } catch (error) {
      console.error('[AdminService.getTopCourses] Error:', error);
      throw error;
    }
  }

  /**
   * Get payment status counts
   */
  async getPaymentStatusCounts() {
    try {
      const [completed, pending, failed, cancelled] = await Promise.all([
        Payment.count({ where: { status: 'completed' } }),
        Payment.count({ where: { status: 'pending' } }),
        Payment.count({ where: { status: 'failed' } }),
        Payment.count({ where: { status: 'cancelled' } }),
      ]);

      return {
        statusCounts: {
          completed,
          pending,
          failed,
          cancelled,
        },
      };
    } catch (error) {
      console.error('[AdminService.getPaymentStatusCounts] Error:', error);
      throw error;
    }
  }

  /**
   * Get all users with optional role filter
   * @param {string} roleFilter - 'student' | 'teacher' | 'admin' | null (all)
   */
  async getUsers(roleFilter = null) {
    const whereClause = {};
    if (roleFilter && ['student', 'teacher', 'admin'].includes(roleFilter)) {
      whereClause.role = roleFilter;
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: [
        'id',
        'name',
        'username',
        'email',
        'role',
        'isEmailVerified',
        'chatBannedUntil',
        'createdAt',
      ],
      order: [['createdAt', 'DESC']],
    });

    return { users };
  }

  /**
   * Export users to CSV
   */
  async exportUsersToCSV(roleFilter = null) {
    const whereClause = {};
    if (roleFilter && ['student', 'teacher', 'admin'].includes(roleFilter)) {
      whereClause.role = roleFilter;
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: [
        'id',
        'name',
        'username',
        'email',
        'role',
        'isEmailVerified',
        'createdAt',
      ],
      order: [['createdAt', 'DESC']],
      raw: true,
    });

    // CSV Header
    const headers = ['ID', 'Name', 'Username', 'Email', 'Role', 'Email Verified', 'Created At'];
    
    // CSV Rows
    const rows = users.map(user => [
      user.id,
      user.name || '',
      user.username || '',
      user.email || '',
      user.role,
      user.isEmailVerified ? 'Yes' : 'No',
      user.createdAt ? new Date(user.createdAt).toLocaleString('vi-VN') : '',
    ]);

    // Escape và wrap values - dùng semicolon cho Excel locale Việt Nam
    const escapeCsv = (value) => {
      const str = String(value);
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV content - dùng semicolon delimiter cho Excel VN
    const csvContent = [
      'sep=;',
      headers.join(';'),
      ...rows.map(row => row.map(escapeCsv).join(';')),
    ].join('\n');

    // Add BOM for UTF-8 support (Vietnamese characters)
    return '\ufeff' + csvContent;
  }

  /**
   * Create new user
   */
  async createUser(userData, adminId) {
    const { username, email, password, role } = userData;

    if (!username || !email || !password) {
      throw { status: 400, message: 'Username, email và password là bắt buộc' };
    }

    if (role && !['student', 'teacher'].includes(role)) {
      throw { status: 400, message: 'Role không hợp lệ. Chỉ được phép đặt student hoặc teacher.' };
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      throw { status: 409, message: 'Email đã được sử dụng' };
    }

    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      throw { status: 409, message: 'Username đã được sử dụng' };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: username,
      username,
      email,
      passwordHash,
      role: role || 'student',
      isEmailVerified: true,
    });

    // Ghi log
    await this._logAdminAction(adminId, 'create', 'user', user.id, null, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Update user
   */
  async updateUser(userId, updateData) {
    const { role, isActive, newPassword } = updateData;

    const user = await User.findByPk(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy người dùng' };
    }

    if (user.role === 'admin') {
      throw { status: 400, message: 'Không thể thay đổi role của tài khoản admin.' };
    }

    if (role) {
      if (!['student', 'teacher'].includes(role)) {
        throw { status: 400, message: 'Role không hợp lệ. Chỉ được phép đặt student hoặc teacher.' };
      }
      user.role = role;
    }

    if (typeof isActive === 'boolean') {
      user.isActive = isActive;
    }

    if (newPassword && typeof newPassword === 'string' && newPassword.length >= 6) {
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Delete user
   */
  async deleteUser(userId, adminId) {
    return await db.sequelize.transaction(async (t) => {
      const user = await User.findByPk(userId, { transaction: t });
      if (!user) {
        throw { status: 404, message: 'Không tìm thấy người dùng' };
      }

      if (user.role === 'admin') {
        throw { status: 400, message: 'Không thể xóa tài khoản admin.' };
      }

      // Lưu thông tin trước khi xóa
      const userInfo = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };

      // Xóa các related records trước để tránh FK constraint
      await Notification.destroy({ where: { userId }, transaction: t });
      await Enrollment.destroy({ where: { userId }, transaction: t });
      await Review.destroy({ where: { userId }, transaction: t });
      await Payment.destroy({ where: { userId }, transaction: t });

      await user.destroy({ transaction: t });

      // Ghi log (không cần transaction vì đây là log, nhưng vẫn nên có để consistency)
      await AdminActionLog.create({
        adminId,
        action: 'delete',
        targetType: 'user',
        targetId: userId,
        reason: null,
        metadata: JSON.stringify({ user: userInfo }),
      }, { transaction: t });

      return { message: 'Xóa người dùng thành công', deletedUser: userInfo };
    });
  }

  /**
   * Get Teacher KPIs - Tính toán hiệu suất giảng viên
   * Tận dụng dữ liệu từ: courses, enrollments, payments, reviews
   * @param {string|number} teacherId - ID của giáo viên
   * @param {Object} timeFilter - Bộ lọc thời gian
   * @param {string} timeFilter.period - all|month|quarter|year
   * @param {string|number} timeFilter.year - Năm cụ thể
   * @param {string|number} timeFilter.month - Tháng cụ thể (1-12)
   */
  async getTeacherKPIs(teacherId, timeFilter = {}) {
    const { period = 'all', year, month } = timeFilter;
    logger.info('TEACHER_KPI_CALCULATION_STARTED', { teacherId, period, year, month });
    
    // Tính khoảng thời gian
    let dateRange;
    try {
      dateRange = this._calculateDateRange(period, year, month);
      logger.debug('TEACHER_KPI_DATE_RANGE_RESOLVED', { teacherId, dateRange });
    } catch (dateError) {
      logger.warn('TEACHER_KPI_DATE_RANGE_FALLBACK', { teacherId, error: dateError.message });
      dateRange = { period: 'all', startDate: null, endDate: null, label: 'Tất cả thời gian', whereCondition: {} };
    }
    
    const teacher = await User.findByPk(teacherId);
    
    if (!teacher || teacher.role !== 'teacher') {
      throw { status: 404, message: 'Không tìm thấy giáo viên' };
    }

    // Lấy tất cả khóa học của giáo viên
    const courses = await Course.findAll({
      where: { createdBy: teacherId },
      attributes: ['id', 'title', 'published', 'status', 'createdAt', 'createdBy'],
      raw: true,
    });
    
    const courseIds = courses.map(c => c.id);
    logger.debug('TEACHER_KPI_COURSE_SCOPE_RESOLVED', { teacherId, courseCount: courseIds.length });

    // Nếu chưa có khóa học nào, trả về KPI = 0
    if (courseIds.length === 0) {
      logger.info('TEACHER_KPI_EMPTY_COURSE_SET', { teacherId });
      return {
        teacher: {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          createdAt: teacher.createdAt,
        },
        kpis: {
          totalCourses: 0,
          publishedCourses: 0,
          pendingCourses: 0,
          totalStudents: 0,
          totalRevenue: 0,
          avgRating: '0.00',
          completionRate: '0.00',
          compositeScore: '0.00',
        },
        topCourses: [],
      };
    }

    // Tính toán các chỉ số
    const [
      totalStudents,
      totalRevenue,
      avgRating,
      totalCourses,
      publishedCourses,
      pendingCourses,
    ] = await Promise.all([
      // Tổng số học viên (unique) từ tất cả khóa học
      Enrollment.count({
        where: { courseId: { [Op.in]: courseIds } },
        distinct: true,
        col: 'userId',
      }),

      // Tổng doanh thu (có lọc thời gian nếu có)
      Payment.sum('amount', {
        where: {
          status: 'completed',
          courseId: { [Op.in]: courseIds },
          ...(dateRange.startDate && dateRange.endDate ? {
            createdAt: {
              [Op.gte]: dateRange.startDate,
              [Op.lte]: dateRange.endDate,
            }
          } : {}),
        },
      }),

      // Rating trung bình từ reviews
      Review.findOne({
        attributes: [[db.sequelize.fn('AVG', db.sequelize.col('rating')), 'avgRating']],
        where: { courseId: { [Op.in]: courseIds } },
        raw: true,
      }),

      // Tổng số khóa học
      Course.count({ where: { createdBy: teacherId } }),

      // Khóa học đã publish
      Course.count({ where: { createdBy: teacherId, published: true } }),

      // Khóa học đang chờ duyệt
      Course.count({
        where: {
          createdBy: teacherId,
          status: 'pending_review',
        },
      }),
    ]);

    // Tính doanh thu theo từng khóa học (top performing courses)
    let courseRevenues = [];
    try {
      courseRevenues = await db.sequelize.query(
        `SELECT c.id, c.title,
                COUNT(DISTINCT e.id) as enrollmentCount,
                COALESCE(SUM(DISTINCT p.amount), 0) as revenue
         FROM courses c
         LEFT JOIN enrollments e ON c.id = e.course_id
         LEFT JOIN payments p ON c.id = p.course_id AND p.status = 'completed'
         WHERE c.created_by = :teacherId
         GROUP BY c.id, c.title
         ORDER BY revenue DESC
         LIMIT 5`,
        {
          replacements: { teacherId },
          type: db.sequelize.QueryTypes.SELECT,
        }
      );
    } catch (sqlError) {
      logger.error('TEACHER_KPI_COURSE_REVENUE_QUERY_FAILED', { teacherId, error: sqlError.message });
      courseRevenues = [];
    }

    // Tính completion rate (tỷ lệ học viên hoàn thành)
    let completionStats = [{ totalEnrolled: 0, completed: 0 }];
    try {
      completionStats = await db.sequelize.query(
        `SELECT
          COUNT(DISTINCT e.user_id) as totalEnrolled,
          COUNT(DISTINCT CASE WHEN e.progress_percent >= 100 THEN e.user_id END) as completed
         FROM enrollments e
         WHERE e.course_id IN (:courseIds)`,
        {
          replacements: { courseIds: courseIds.length > 0 ? courseIds : [0] },
          type: db.sequelize.QueryTypes.SELECT,
        }
      );
    } catch (sqlError) {
      logger.error('TEACHER_KPI_COMPLETION_STATS_QUERY_FAILED', { teacherId, error: sqlError.message });
    }

    const completionRate = completionStats[0]?.totalEnrolled > 0
      ? (completionStats[0].completed / completionStats[0].totalEnrolled) * 100
      : 0;

    // Tính điểm hiệu quả tổng hợp (composite score) - Scale để điểm nằm trong khoảng 0-100
    // Công thức điều chỉnh: (revenue/100000)*0.3 + (students/10)*0.2 + rating*2*0.2 + completionRate*0.3
    const compositeScore = (
      ((totalRevenue || 0) / 100000) * 0.3 +
      ((totalStudents || 0) / 10) * 0.2 +
      (Number(avgRating?.avgRating || 0)) * 2 * 0.2 +
      completionRate * 0.3
    ).toFixed(2);

    logger.info('TEACHER_KPI_CALCULATION_COMPLETED', {
      teacherId,
      totalCourses, publishedCourses, pendingCourses,
      totalStudents, totalRevenue, avgRating, completionRate, compositeScore
    });

    return {
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        createdAt: teacher.createdAt,
      },
      period: {
        label: dateRange.label,
        period: dateRange.period,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
      kpis: {
        totalCourses,
        publishedCourses,
        pendingCourses,
        totalStudents,
        totalRevenue: Number(totalRevenue || 0),
        avgRating: Number(avgRating?.avgRating || 0).toFixed(2),
        completionRate: completionRate.toFixed(2),
        compositeScore,
        currency: 'VND',
      },
      topCourses: courseRevenues.map(c => ({
        ...c,
        revenue: Number(c.revenue || 0),
      })),
    };
  }

  /**
   * Helper: Tính khoảng thời gian cho KPI filter
   */
  _calculateDateRange(period, year, month) {
    const now = new Date();
    let startDate = null;
    let endDate = null;
    let label = 'Tất cả thời gian';
    let targetMonth, targetYear, quarter, targetFullYear, targetQYear;

    switch (period) {
      case 'month':
        targetMonth = month ? Number(month) - 1 : now.getMonth();
        targetYear = year ? Number(year) : now.getFullYear();
        startDate = new Date(targetYear, targetMonth, 1);
        endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
        label = `Tháng ${targetMonth + 1}/${targetYear}`;
        break;
      case 'quarter':
        targetQYear = year ? Number(year) : now.getFullYear();
        quarter = month ? Math.ceil(Number(month) / 3) : Math.ceil((now.getMonth() + 1) / 3);
        startDate = new Date(targetQYear, (quarter - 1) * 3, 1);
        endDate = new Date(targetQYear, quarter * 3, 0, 23, 59, 59);
        label = `Quý ${quarter}/${targetQYear}`;
        break;
      case 'year':
        targetFullYear = year ? Number(year) : now.getFullYear();
        startDate = new Date(targetFullYear, 0, 1);
        endDate = new Date(targetFullYear, 11, 31, 23, 59, 59);
        label = `Năm ${targetFullYear}`;
        break;
      default:
        // all - không giới hạn thời gian
        break;
    }

    return {
      period,
      startDate,
      endDate,
      label,
      whereCondition: startDate && endDate ? {
        createdAt: {
          [Op.gte]: startDate,
          [Op.lte]: endDate,
        }
      } : {}
    };
  }

  /**
   * Get all payments
   */
  async getPayments(query = {}) {
    const { page = 1, limit = 10, status, provider, courseId, userId } = query;
    const offset = (Number(page) - 1) * Number(limit);

    const whereClause = {};
    if (status) whereClause.status = status;
    if (provider) whereClause.provider = provider;
    if (courseId) whereClause.courseId = Number(courseId);
    if (userId) whereClause.userId = Number(userId);

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'price', 'published'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'username', 'email', 'role'],
        },
      ],
      order: [[db.sequelize.col('Payment.created_at'), 'DESC']],
      limit: Number(limit),
      offset,
    });

    return {
      payments,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      },
    };
  }

  /**
   * Enroll user to course
   */
  async enrollUserToCourse(userId, courseId, adminId) {
    if (!userId || !courseId) {
      throw { status: 400, message: 'userId và courseId là bắt buộc' };
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy người dùng' };
    }

    if (user.role !== 'student') {
      throw { status: 400, message: 'Admin chỉ được ghi danh thay mặt học viên (role=student)' };
    }

    if (Number(adminId) === Number(userId)) {
      throw { status: 400, message: 'Admin không được tự ghi danh cho chính mình' };
    }

    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (!course.published) {
      throw { status: 400, message: 'Khóa học chưa được xuất bản, không thể ghi danh' };
    }

    if (course.createdBy && Number(course.createdBy) === Number(userId)) {
      throw { status: 400, message: 'Không thể ghi danh vào khóa học do chính người học tạo' };
    }

    const price = Number(course.price || 0);
    if (price > 0) {
      const completedPayment = await Payment.findOne({
        where: {
          userId,
          courseId,
          status: 'completed',
        },
        order: [['createdAt', 'DESC']],
      });

      if (!completedPayment) {
        throw { status: 402, message: 'Khóa học có phí. Cần thanh toán hợp lệ trước khi ghi danh' };
      }
    }

    const existing = await Enrollment.findOne({
      where: { userId, courseId },
    });
    if (existing) {
      throw { status: 409, message: 'Người dùng đã được ghi danh vào khóa học này' };
    }

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
        throw { status: 409, message: 'Người dùng đã được ghi danh vào khóa học này' };
      }
      throw err;
    }

    try {
      await courseAggregatesService.recomputeCourseStudents(courseId);
    } catch (aggErr) {
      console.error('Recompute course students after admin enroll (silent):', aggErr);
    }

    return { enrollment };
  }

  /**
   * Unenroll user from course
   */
  async unenrollUserFromCourse(userId, courseId) {
    if (!userId || !courseId) {
      throw { status: 400, message: 'userId và courseId là bắt buộc' };
    }

    const enrollment = await Enrollment.findOne({
      where: { userId, courseId },
    });

    if (!enrollment) {
      throw { status: 404, message: 'Người dùng chưa được ghi danh vào khóa học này' };
    }

    await enrollment.destroy();

    try {
      await LectureProgress.destroy({ where: { userId, courseId: Number(courseId) } });
    } catch (e) {
      console.error('Cleanup lecture progress after admin unenroll (silent) error:', e);
    }

    try {
      await courseAggregatesService.recomputeCourseStudents(courseId);
    } catch (aggErr) {
      console.error('Recompute course students after admin unenroll (silent):', aggErr);
    }

    return { message: 'Đã hủy ghi danh khỏi khóa học' };
  }

  /**
   * Get course enrollments
   */
  async getCourseEnrollments(courseId) {
    const enrollments = await Enrollment.findAll({
      where: { courseId },
      include: [
        {
          model: User,
          attributes: ['id', 'username', 'email', 'role'],
        },
      ],
      order: [['enrolledAt', 'DESC']],
    });

    return { enrollments };
  }

  /**
   * Get user enrollments
   */
  async getUserEnrollments(userId) {
    const enrollments = await Enrollment.findAll({
      where: { userId },
      include: [
        {
          model: Course,
          attributes: ['id', 'title', 'slug', 'price', 'published'],
        },
      ],
      order: [['enrolledAt', 'DESC']],
    });

    return { enrollments };
  }

  /**
   * Get all reviews
   */
  async getReviews(query = {}) {
    const { courseId } = query;

    const where = {};
    if (courseId) {
      where.courseId = Number(courseId);
    }

    const reviews = await Review.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'avatar', 'username', 'email'],
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug'],
        },
      ],
      order: [[db.sequelize.col('Review.created_at'), 'DESC']],
    });

    return { reviews };
  }

  /**
   * Delete review
   */
  async deleteReview(reviewId) {
    const review = await Review.findByPk(reviewId);
    if (!review) {
      throw { status: 404, message: 'Không tìm thấy đánh giá' };
    }

    await review.destroy();

    return { message: 'Đã xóa đánh giá' };
  }

  /**
   * Get all categories
   */
  async getCategories() {
    const categories = await Category.findAll({
      order: [['createdAt', 'DESC']],
    });

    return { categories };
  }

  /**
   * Create category
   */
  async createCategory(categoryData) {
    const { name, menuSection } = categoryData;

    if (!name || !name.trim()) {
      throw { status: 400, message: 'Tên category là bắt buộc' };
    }

    const existing = await Category.findOne({
      where: { name: name.trim() },
    });

    if (existing) {
      throw { status: 409, message: 'Category với tên này đã tồn tại' };
    }

    const category = await Category.create({
      name: name.trim(),
      menuSection: menuSection ? menuSection.trim() : null,
    });

    return { category };
  }

  /**
   * Update category
   */
  async updateCategory(categoryId, categoryData) {
    const { name, menuSection } = categoryData;

    const category = await Category.findByPk(categoryId);
    if (!category) {
      throw { status: 404, message: 'Không tìm thấy category' };
    }

    if (name && name.trim()) {
      const existing = await Category.findOne({
        where: { name: name.trim() },
      });

      if (existing && existing.id !== category.id) {
        throw { status: 409, message: 'Category với tên này đã tồn tại' };
      }

      category.name = name.trim();
    }

    if (menuSection !== undefined) {
      category.menuSection =
        menuSection && menuSection.trim() ? menuSection.trim() : null;
    }

    await category.save();

    return { category };
  }

  /**
   * Delete category
   */
  async deleteCategory(categoryId) {
    const category = await Category.findByPk(categoryId);
    if (!category) {
      throw { status: 404, message: 'Không tìm thấy category' };
    }

    const coursesCount = await Course.count({
      where: { categoryId: categoryId },
    });

    if (coursesCount > 0) {
      throw { status: 400, message: 'Không thể xóa category vì đang được sử dụng bởi khóa học' };
    }

    await category.destroy();

    return { message: 'Đã xóa category' };
  }

  /**
   * Helper: Ghi log hành động admin
   */
  async _logAdminAction(adminId, action, targetType, targetId, reason = null, metadata = {}) {
    try {
      await AdminActionLog.create({
        adminId,
        action,
        targetType,
        targetId,
        reason,
        metadata: JSON.stringify(metadata),
      });
    } catch (err) {
      console.error('[AuditLog] Failed to log action:', err.message);
    }
  }

  /**
   * Get audit logs with pagination
   */
  async getAuditLogs(filters = {}, pagination = {}) {
    const { action, targetType, adminId } = filters;
    const { page = 1, limit = 50 } = pagination;

    const where = {};
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;
    if (adminId) where.adminId = adminId;

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows: logs } = await AdminActionLog.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'admin',
        attributes: ['id', 'name', 'email'],
      }],
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
    });

    return {
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        totalPages: Math.ceil(count / Number(limit)),
      },
    };
  }
}

module.exports = new AdminService();
