const db = require('../models');

const { Category } = db.models;

/**
 * GET /api/categories
 * Lấy danh sách category (public) để FE sử dụng khi tạo/sửa khóa học
 */
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách category (public):', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

