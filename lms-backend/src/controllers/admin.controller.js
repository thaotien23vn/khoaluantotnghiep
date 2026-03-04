const bcrypt = require('bcryptjs');
const db = require('../models');

const { User, Course, Enrollment, Review, Category } = db.models;

/**
 * GET /api/admin/dashboard
 * Lấy thống kê tổng quan cho admin
 */
exports.getDashboard = async (req, res) => {
  try {
    const [totalUsers, totalCourses, totalEnrollments] = await Promise.all([
      User.count(),
      Course.count(),
      Enrollment.count(),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalCourses,
          totalEnrollments,
        },
      },
    });
  } catch (error) {
    console.error('Lỗi lấy dashboard admin:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/users
 * Lấy danh sách tất cả người dùng
 */
exports.getUsers = async (req, res) => {
  try {
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

    res.json({
      success: true,
      data: { users },
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách user:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * POST /api/admin/users
 * Tạo tài khoản mới (Student / Teacher) – KHÔNG tạo được admin mới.
 */
exports.createUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email và password là bắt buộc',
      });
    }

    if (role && !['student', 'teacher'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role không hợp lệ. Chỉ được phép đặt student hoặc teacher.',
      });
    }

    // Kiểm tra trùng email/username
    const existing = await User.findOne({
      where: { email },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email đã được sử dụng',
      });
    }

    const existingUsername = await User.findOne({
      where: { username },
    });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: 'Username đã được sử dụng',
      });
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

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Lỗi tạo user bởi admin:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * PUT /api/admin/users/:id
 * Gán & thay đổi role (student / teacher), khóa/mở khóa, reset mật khẩu
 *
 * Policy:
 * - User tự đăng ký luôn là student (xử lý ở /auth/register)
 * - Admin có thể nâng user lên teacher
 * - Không cho thay đổi role của tài khoản đã là admin (tránh tự hạ quyền / phá hệ thống)
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive, newPassword } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng',
      });
    }

    // Không cho phép chỉnh sửa role của user đã là admin
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Không thể thay đổi role của tài khoản admin.',
      });
    }

    if (role) {
      if (!['student', 'teacher'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Role không hợp lệ. Chỉ được phép đặt student hoặc teacher.',
        });
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

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Lỗi cập nhật user:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/admin/users/:id
 * Xóa một người dùng (không cho xóa admin)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng',
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa tài khoản admin.',
      });
    }

    await user.destroy();

    res.json({
      success: true,
      message: 'Xóa người dùng thành công',
    });
  } catch (error) {
    console.error('Lỗi xóa user:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * POST /api/admin/enrollments
 * Ghi danh học viên vào khóa học
 */
exports.enrollUserToCourse = async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    if (!userId || !courseId) {
      return res.status(400).json({
        success: false,
        message: 'userId và courseId là bắt buộc',
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng',
      });
    }

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }

    const existing = await Enrollment.findOne({
      where: { userId, courseId },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Người dùng đã được ghi danh vào khóa học này',
      });
    }

    const enrollment = await Enrollment.create({
      userId,
      courseId,
      status: 'enrolled',
      progressPercent: 0,
    });

    res.status(201).json({
      success: true,
      data: { enrollment },
    });
  } catch (error) {
    console.error('Lỗi admin ghi danh user:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/admin/enrollments
 * Hủy ghi danh học viên khỏi khóa học
 */
exports.unenrollUserFromCourse = async (req, res) => {
  try {
    const { userId, courseId } = req.body;

    if (!userId || !courseId) {
      return res.status(400).json({
        success: false,
        message: 'userId và courseId là bắt buộc',
      });
    }

    const enrollment = await Enrollment.findOne({
      where: { userId, courseId },
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng chưa được ghi danh vào khóa học này',
      });
    }

    await enrollment.destroy();

    res.json({
      success: true,
      message: 'Đã hủy ghi danh khỏi khóa học',
    });
  } catch (error) {
    console.error('Lỗi admin hủy ghi danh:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/courses/:courseId/enrollments
 * Danh sách học viên của một khóa học
 */
exports.getCourseEnrollments = async (req, res) => {
  try {
    const { courseId } = req.params;

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

    res.json({
      success: true,
      data: { enrollments },
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách học viên khóa học:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/users/:userId/enrollments
 * Danh sách khóa học mà 1 học viên đã ghi danh
 */
exports.getUserEnrollments = async (req, res) => {
  try {
    const { userId } = req.params;

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

    res.json({
      success: true,
      data: { enrollments },
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách khóa học của user:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/reviews
 * Lấy danh sách đánh giá (có thể lọc theo courseId)
 */
exports.getReviews = async (req, res) => {
  try {
    const { courseId } = req.query;

    const where = {};
    if (courseId) {
      where.courseId = courseId;
    }

    const reviews = await Review.findAll({
      where,
      include: [
        {
          model: User,
          attributes: ['id', 'username', 'email'],
        },
        {
          model: Course,
          attributes: ['id', 'title'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: { reviews },
    });
  } catch (error) {
    console.error('Lỗi lấy reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/admin/reviews/:id
 * Xóa đánh giá vi phạm
 */
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await Review.findByPk(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đánh giá',
      });
    }

    await review.destroy();

    res.json({
      success: true,
      message: 'Đã xóa đánh giá',
    });
  } catch (error) {
    console.error('Lỗi xóa review:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/categories
 * Lấy danh sách tất cả category
 */
exports.getCategoriesAdmin = async (req, res) => {
  try {
    const categories = await Category.findAll({
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách category:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * POST /api/admin/categories
 * Tạo category mới
 */
exports.createCategory = async (req, res) => {
  try {
    const { name, menuSection } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tên category là bắt buộc',
      });
    }

    const existing = await Category.findOne({
      where: { name: name.trim() },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Category với tên này đã tồn tại',
      });
    }

    const category = await Category.create({
      name: name.trim(),
      menuSection: menuSection ? menuSection.trim() : null,
    });

    res.status(201).json({
      success: true,
      data: { category },
    });
  } catch (error) {
    console.error('Lỗi tạo category:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * PUT /api/admin/categories/:id
 * Cập nhật category
 */
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, menuSection } = req.body;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy category',
      });
    }

    if (name && name.trim()) {
      const existing = await Category.findOne({
        where: { name: name.trim() },
      });

      if (existing && existing.id !== category.id) {
        return res.status(409).json({
          success: false,
          message: 'Category với tên này đã tồn tại',
        });
      }

      category.name = name.trim();
    }

    if (menuSection !== undefined) {
      category.menuSection =
        menuSection && menuSection.trim() ? menuSection.trim() : null;
    }

    await category.save();

    res.json({
      success: true,
      data: { category },
    });
  } catch (error) {
    console.error('Lỗi cập nhật category:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/admin/categories/:id
 * Xóa category (chỉ khi không còn khóa học dùng category này)
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy category',
      });
    }

    const coursesCount = await Course.count({
      where: { categoryId: id },
    });

    if (coursesCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa category vì đang được sử dụng bởi khóa học',
      });
    }

    await category.destroy();

    res.json({
      success: true,
      message: 'Đã xóa category',
    });
  } catch (error) {
    console.error('Lỗi xóa category:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};
