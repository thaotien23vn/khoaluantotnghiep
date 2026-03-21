const categoryService = require('./category.service');

/**
 * Category Controller - HTTP request handling
 */
class CategoryController {
  async getCategories(req, res) {
    try {
      const result = await categoryService.getCategories();

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ',
        error: error.message,
      });
    }
  }
}

module.exports = new CategoryController();
