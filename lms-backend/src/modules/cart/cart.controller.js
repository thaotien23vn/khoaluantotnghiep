const cartService = require('./cart.service');

/**
 * Cart Controller - HTTP request handlers for cart operations
 */
class CartController {
  /**
   * Get user's cart
   */
  async getCart(req, res, next) {
    try {
      const userId = req.user.id;
      const cart = await cartService.getCart(userId);
      res.json({
        success: true,
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add course to cart
   */
  async addToCart(req, res, next) {
    try {
      const userId = req.user.id;
      const { courseId, quantity = 1, notes } = req.body;

      if (!courseId) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu courseId',
        });
      }

      const result = await cartService.addToCart(userId, courseId, quantity, notes);
      res.status(result.isNew ? 201 : 200).json({
        success: true,
        data: result.item,
        message: result.isNew ? 'Đã thêm vào giỏ hàng' : 'Đã cập nhật số lượng trong giỏ hàng',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(req, res, next) {
    try {
      const userId = req.user.id;
      const { itemId } = req.params;
      const { quantity } = req.body;

      if (!quantity || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Số lượng không hợp lệ',
        });
      }

      const result = await cartService.updateCartItem(userId, itemId, quantity);
      res.json({
        success: true,
        data: result.item,
        message: 'Đã cập nhật giỏ hàng',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(req, res, next) {
    try {
      const userId = req.user.id;
      const { itemId } = req.params;

      const result = await cartService.removeFromCart(userId, itemId);
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Clear entire cart
   */
  async clearCart(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await cartService.clearCart(userId);
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate cart before checkout
   */
  async validateCart(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await cartService.validateCart(userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get cart count (for badge)
   */
  async getCartCount(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await cartService.getCartCount(userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Prepare cart for checkout (convert to payment)
   */
  async prepareCheckout(req, res, next) {
    try {
      const userId = req.user.id;
      const { selectedItems } = req.body; // Optional: specific items to checkout

      const result = await cartService.convertCartToPayment(userId, selectedItems);
      res.json({
        success: true,
        data: result,
        message: 'Sẵn sàng thanh toán',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CartController();
