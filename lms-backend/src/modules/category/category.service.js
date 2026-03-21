const db = require('../../models');

const { Category } = db.models;

/**
 * Category Service - Business logic for category operations
 */
class CategoryService {
  /**
   * Get all categories
   */
  async getCategories() {
    const categories = await Category.findAll({
      attributes: ['id', 'name', 'menuSection'],
      order: [['name', 'ASC']],
    });

    return { categories };
  }
}

module.exports = new CategoryService();
