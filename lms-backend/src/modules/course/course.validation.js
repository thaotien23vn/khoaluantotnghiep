const { body, query, param } = require('express-validator');

/**
 * Course validation schemas
 */

const createCourseValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Tiêu đề khóa học không được để trống')
    .isLength({ min: 3, max: 200 })
    .withMessage('Tiêu đề phải có độ dài từ 3 đến 200 ký tự'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Mô tả không được vượt quá 5000 ký tự'),
  
  body('imageUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Image URL không hợp lệ'),
  
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Giá phải là số không âm'),
  
  body('categoryId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID phải là số nguyên dương'),
  
  body('published')
    .optional()
    .isBoolean()
    .withMessage('Published phải là boolean'),
  
  body('level')
    .optional()
    .trim()
    .isIn(['beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced', 'proficiency', 'all-levels'])
    .withMessage('Cấp độ không hợp lệ'),
  
  body('duration')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Thời lượng không được vượt quá 50 ký tự'),
  
  body('willLearn')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      if (Array.isArray(value)) return true;
      throw new Error('willLearn phải là một mảng');
    }),
  
  body('requirements')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      if (Array.isArray(value)) return true;
      throw new Error('requirements phải là một mảng');
    }),
  
  body('tags')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      if (Array.isArray(value)) return true;
      throw new Error('tags phải là một mảng');
    }),
];

const updateCourseValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Tiêu đề không được để trống')
    .isLength({ min: 3, max: 200 })
    .withMessage('Tiêu đề phải có độ dài từ 3 đến 200 ký tự'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Mô tả không được vượt quá 5000 ký tự'),
  
  body('imageUrl')
    .optional()
    .trim()
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true;
      // URL validation with query params support
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Image URL không hợp lệ');
      }
    }),
  
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Giá phải là số không âm'),
  
  body('categoryId')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      if (Number.isInteger(Number(value)) && Number(value) >= 0) return true;
      throw new Error('Category ID phải là số nguyên không âm');
    }),
  
  body('published')
    .optional()
    .custom((value) => {
      if (typeof value === 'boolean') return true;
      if (value === 'true' || value === 'false' || value === '1' || value === '0' || value === 1 || value === 0) return true;
      throw new Error('Published phải là boolean');
    }),
  
  body('level')
    .optional()
    .trim()
    .isIn(['beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced', 'proficiency', 'all-levels'])
    .withMessage('Cấp độ không hợp lệ'),

  body('duration')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Thời lượng không được vượt quá 50 ký tự'),

  // Duration settings
  body('durationType')
    .optional()
    .isIn(['lifetime', 'fixed', 'subscription'])
    .withMessage('Loại thời hạn không hợp lệ'),

  body('durationValue')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      if (Number.isInteger(Number(value)) && Number(value) >= 1) return true;
      throw new Error('Giá trị thời hạn phải là số nguyên dương');
    }),

  body('durationUnit')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      if (['days', 'months', 'years'].includes(value)) return true;
      throw new Error('Đơn vị thời gian không hợp lệ');
    }),

  body('renewalDiscountPercent')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      if (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100) return true;
      throw new Error('Phần trăm giảm giá phải từ 0 đến 100');
    }),

  body('gracePeriodDays')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      if (Number.isInteger(Number(value)) && Number(value) >= 0) return true;
      throw new Error('Số ngày ân hạn phải là số nguyên không âm');
    }),
];

const getCourseValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

const listCoursesValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Từ khóa tìm kiếm không được vượt quá 100 ký tự'),
  
  query('categoryId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID phải là số nguyên dương'),
  
  query('level')
    .optional()
    .trim()
    .isIn(['beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced', 'proficiency', 'all-levels'])
    .withMessage('Cấp độ không hợp lệ'),
  
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Giá tối thiểu phải là số không âm'),
  
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Giá tối đa phải là số không âm'),
  
  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'price_asc', 'price_desc', 'rating_desc', 'students_desc'])
    .withMessage('Sắp xếp không hợp lệ'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Trang phải là số nguyên dương'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Số lượng mỗi trang phải từ 1 đến 100'),
];

const getMyCoursesValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Từ khóa tìm kiếm không được vượt quá 100 ký tự'),

  query('status')
    .optional()
    .isIn(['all', 'published', 'draft', 'pending_review', 'rejected'])
    .withMessage('Trạng thái không hợp lệ'),

  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'updated_desc'])
    .withMessage('Sắp xếp không hợp lệ'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Trang phải là số nguyên dương'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Số lượng mỗi trang phải từ 1 đến 100'),
];

const setPublishedValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
  
  body('published')
    .isBoolean()
    .withMessage('Published phải là boolean'),
];

const getCourseEnrollmentsValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

const submitForReviewValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

const adminReviewValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),

  body('action')
    .trim()
    .notEmpty()
    .withMessage('Action không được để trống')
    .isIn(['approve', 'reject'])
    .withMessage('Action phải là "approve" hoặc "reject"'),

  body('rejectionReason')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Lý do từ chối không được vượt quá 1000 ký tự'),
];

module.exports = {
  createCourseValidation,
  updateCourseValidation,
  getCourseValidation,
  listCoursesValidation,
  getMyCoursesValidation,
  setPublishedValidation,
  getCourseEnrollmentsValidation,
  submitForReviewValidation,
  adminReviewValidation,
};
