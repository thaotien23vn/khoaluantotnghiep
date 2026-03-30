const db = require('../../models');

const { Cart, Course, User, Enrollment } = db.models;

/**
 * Cart Service - Business logic for shopping cart operations
 */
class CartService {
  /**
   * Get cart items for a user with course details
   */
  async getCart(userId) {
    const cartItems = await Cart.findAll({
      where: { userId },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug', 'imageUrl', 'price', 'description', 'published'],
        },
      ],
      order: [['addedAt', 'DESC']],
    });

    // Calculate totals
    let totalAmount = 0;
    let itemCount = 0;
    const validItems = [];

    for (const item of cartItems) {
      if (item.course && item.course.published) {
        totalAmount += Number(item.course.price || 0) * item.quantity;
        itemCount += item.quantity;
        validItems.push(item);
      }
    }

    return {
      items: validItems,
      summary: {
        itemCount,
        totalAmount: Number(totalAmount.toFixed(2)),
        currency: 'USD',
      },
    };
  }

  /**
   * Add course to cart
   */
  async addToCart(userId, courseId, quantity = 1, notes = '') {
    // Check if course exists and is published
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (!course.published) {
      throw { status: 400, message: 'Khóa học chưa được xuất bản' };
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      where: { userId, courseId },
    });
    if (existingEnrollment) {
      throw { status: 409, message: 'Bạn đã đăng ký khóa học này rồi' };
    }

    // Check if already in cart
    const existingCartItem = await Cart.findOne({
      where: { userId, courseId },
    });

    if (existingCartItem) {
      // Update quantity if already in cart
      existingCartItem.quantity += quantity;
      if (notes) existingCartItem.notes = notes;
      await existingCartItem.save();
      return { item: existingCartItem, isNew: false };
    }

    // Create new cart item
    const cartItem = await Cart.create({
      userId,
      courseId,
      quantity,
      notes,
      addedAt: new Date(),
    });

    // Load course details for response
    const itemWithCourse = await Cart.findByPk(cartItem.id, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug', 'imageUrl', 'price', 'description'],
        },
      ],
    });

    return { item: itemWithCourse, isNew: true };
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(userId, cartItemId, quantity) {
    if (quantity < 1) {
      throw { status: 400, message: 'Số lượng phải ít nhất là 1' };
    }

    const cartItem = await Cart.findOne({
      where: { id: cartItemId, userId },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'price', 'published'],
        },
      ],
    });

    if (!cartItem) {
      throw { status: 404, message: 'Không tìm thấy mục trong giỏ hàng' };
    }

    if (!cartItem.course.published) {
      throw { status: 400, message: 'Khóa học không còn khả dụng' };
    }

    cartItem.quantity = quantity;
    await cartItem.save();

    return { item: cartItem };
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId, cartItemId) {
    const cartItem = await Cart.findOne({
      where: { id: cartItemId, userId },
    });

    if (!cartItem) {
      throw { status: 404, message: 'Không tìm thấy mục trong giỏ hàng' };
    }

    await cartItem.destroy();
    return { success: true, message: 'Đã xóa khỏi giỏ hàng' };
  }

  /**
   * Remove specific course from cart
   */
  async removeCourseFromCart(userId, courseId) {
    const cartItem = await Cart.findOne({
      where: { userId, courseId },
    });

    if (cartItem) {
      await cartItem.destroy();
    }

    return { success: true };
  }

  /**
   * Clear entire cart
   */
  async clearCart(userId) {
    await Cart.destroy({
      where: { userId },
    });
    return { success: true, message: 'Đã xóa toàn bộ giỏ hàng' };
  }

  /**
   * Validate cart before checkout
   * Returns valid items and removes invalid ones
   */
  async validateCart(userId) {
    const cartItems = await Cart.findAll({
      where: { userId },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'price', 'published'],
        },
      ],
    });

    const validItems = [];
    const invalidItems = [];

    for (const item of cartItems) {
      // Check if course is still published
      if (!item.course || !item.course.published) {
        invalidItems.push({ id: item.id, reason: 'Khóa học không còn khả dụng' });
        await item.destroy();
        continue;
      }

      // Check if already enrolled
      const existingEnrollment = await Enrollment.findOne({
        where: { userId, courseId: item.courseId },
      });
      if (existingEnrollment) {
        invalidItems.push({ id: item.id, reason: 'Đã đăng ký khóa học này' });
        await item.destroy();
        continue;
      }

      validItems.push(item);
    }

    // Calculate totals
    let totalAmount = 0;
    for (const item of validItems) {
      totalAmount += Number(item.course.price || 0) * item.quantity;
    }

    return {
      validItems,
      invalidItems,
      summary: {
        itemCount: validItems.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        currency: 'USD',
      },
    };
  }

  /**
   * Get cart count (for header/badge)
   */
  async getCartCount(userId) {
    const count = await Cart.count({
      where: { userId },
    });
    return { count };
  }

  /**
   * Move cart items to payment and create payment records
   * This is used when student proceeds from cart to checkout
   */
  async convertCartToPayment(userId, selectedItemIds = null) {
    // Get cart items
    let whereClause = { userId };
    if (selectedItemIds && selectedItemIds.length > 0) {
      whereClause.id = selectedItemIds;
    }

    const cartItems = await Cart.findAll({
      where: whereClause,
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'price', 'published'],
        },
      ],
    });

    if (cartItems.length === 0) {
      throw { status: 400, message: 'Giỏ hàng trống' };
    }

    // Validate items
    const validItems = [];
    let totalAmount = 0;

    for (const item of cartItems) {
      if (!item.course || !item.course.published) {
        continue;
      }

      const existingEnrollment = await Enrollment.findOne({
        where: { userId, courseId: item.courseId },
      });
      if (existingEnrollment) {
        await item.destroy(); // Remove from cart if already enrolled
        continue;
      }

      validItems.push(item);
      totalAmount += Number(item.course.price || 0) * item.quantity;
    }

    if (validItems.length === 0) {
      throw { status: 400, message: 'Không có khóa học hợp lệ để thanh toán' };
    }

    return {
      items: validItems,
      totalAmount: Number(totalAmount.toFixed(2)),
      currency: 'USD',
      itemCount: validItems.length,
    };
  }

  /**
   * Remove paid items from cart after successful payment
   */
  async removePaidItemsFromCart(userId, courseIds) {
    await Cart.destroy({
      where: {
        userId,
        courseId: courseIds,
      },
    });
    return { success: true };
  }
}

module.exports = new CartService();
