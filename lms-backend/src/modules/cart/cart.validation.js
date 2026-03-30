const { body, param } = require('express-validator');

/**
 * Cart validation schemas
 */

const addToCartValidation = [
  body('courseId')
    .notEmpty()
    .withMessage('Course ID là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Số lượng phải ít nhất là 1'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Ghi chú không được vượt quá 500 ký tự'),
];

const updateCartItemValidation = [
  param('itemId')
    .isInt({ min: 1 })
    .withMessage('Item ID phải là số nguyên dương'),
  
  body('quantity')
    .notEmpty()
    .withMessage('Số lượng là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('Số lượng phải ít nhất là 1'),
];

const removeFromCartValidation = [
  param('itemId')
    .isInt({ min: 1 })
    .withMessage('Item ID phải là số nguyên dương'),
];

const checkoutValidation = [
  body('selectedItems')
    .optional()
    .isArray()
    .withMessage('Danh sách items phải là mảng')
    .custom((value) => {
      if (value && value.length > 0) {
        return value.every(id => Number.isInteger(id) && id > 0);
      }
      return true;
    })
    .withMessage('Mỗi item ID phải là số nguyên dương'),
];

module.exports = {
  addToCartValidation,
  updateCartItemValidation,
  removeFromCartValidation,
  checkoutValidation,
};
