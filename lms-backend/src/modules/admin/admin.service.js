const bcrypt = require('bcryptjs');
const Sequelize = require('sequelize');
const db = require('../../models');

const Op = Sequelize.Op || Sequelize.Sequelize?.Op;

const { User, Course, Enrollment, Review, Category, Payment, Attempt } = db.models;

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
   * Get all users
   */
  async getUsers() {
    const users = await User.findAll({
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
    });

    return { users };
  }

  /**
   * Create new user
   */
  async createUser(userData) {
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
  async deleteUser(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy người dùng' };
    }

    if (user.role === 'admin') {
      throw { status: 400, message: 'Không thể xóa tài khoản admin.' };
    }

    await user.destroy();

    return { message: 'Xóa người dùng thành công' };
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
        order: [['created_at', 'DESC']],
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

    const enrollment = await Enrollment.create({
      userId,
      courseId,
      status: 'enrolled',
      progressPercent: 0,
    });

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
}

module.exports = new AdminService();
