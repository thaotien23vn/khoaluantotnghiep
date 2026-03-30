const express = require('express');
const cartController = require('../modules/cart/cart.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

// All cart routes require authentication
router.use(authMiddleware);

// Get cart
router.get('/', cartController.getCart);

// Get cart count (for badge)
router.get('/count', cartController.getCartCount);

// Add to cart
router.post('/items', cartController.addToCart);

// Update cart item quantity
router.put('/items/:itemId', cartController.updateCartItem);

// Remove item from cart
router.delete('/items/:itemId', cartController.removeFromCart);

// Clear entire cart
router.delete('/', cartController.clearCart);

// Validate cart before checkout
router.post('/validate', cartController.validateCart);

// Prepare checkout (convert cart to payment)
router.post('/checkout', cartController.prepareCheckout);

module.exports = router;
