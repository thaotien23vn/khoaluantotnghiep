const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const reviewController = require('../controllers/review.controller');
const { body, query } = require('express-validator');

const router = express.Router();

// Review validation rules
const reviewValidation = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Đánh giá phải từ 1-5 sao'),
  body('comment').optional().isLength({ min: 10, max: 1000 }).withMessage('Bình luận phải từ 10-1000 ký tự')
];

// ========== PUBLIC ROUTES ==========

/**
 * @route   GET /api/courses/:courseId/reviews
 * @desc    Get reviews for a course
 * @access  Public
 */
router.get(
  '/courses/:courseId/reviews',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Trang phải là số nguyên dương'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Giới hạn phải là số nguyên từ 1-100'),
    query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Đánh giá phải từ 1-5'),
    query('sort').optional().isIn(['newest', 'oldest', 'highest', 'lowest']).withMessage('Sắp xếp không hợp lệ')
  ],
  reviewController.getCourseReviews
);

// ========== STUDENT ROUTES ==========

/**
 * @route   POST /api/student/courses/:courseId/reviews
 * @desc    Create a review for a course
 * @access  Private (Student & Admin)
 */
router.post(
  '/courses/:courseId/reviews',
  authMiddleware,
  authorizeRole('student', 'admin'),
  reviewValidation,
  reviewController.createReview
);

router.post(
  '/student/courses/:courseId/reviews',
  authMiddleware,
  authorizeRole('student', 'admin'),
  reviewValidation,
  reviewController.createReview
);

/**
 * @route   PUT /api/student/reviews/:reviewId
 * @desc    Update a review
 * @access  Private (Student & Admin)
 */
router.put(
  '/reviews/:reviewId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  reviewValidation,
  reviewController.updateReview
);

router.put(
  '/student/reviews/:reviewId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  reviewValidation,
  reviewController.updateReview
);

/**
 * @route   DELETE /api/student/reviews/:reviewId
 * @desc    Delete a review
 * @access  Private (Student & Admin)
 */
router.delete(
  '/reviews/:reviewId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  reviewController.deleteReview
);

router.delete(
  '/student/reviews/:reviewId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  reviewController.deleteReview
);

/**
 * @route   GET /api/student/reviews
 * @desc    Get user's reviews
 * @access  Private (Student & Admin)
 */
router.get(
  '/reviews',
  authMiddleware,
  authorizeRole('student', 'admin'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Trang phải là số nguyên dương'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Giới hạn phải là số nguyên từ 1-100')
  ],
  reviewController.getUserReviews
);

router.get(
  '/student/reviews',
  authMiddleware,
  authorizeRole('student', 'admin'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Trang phải là số nguyên dương'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Giới hạn phải là số nguyên từ 1-100')
  ],
  reviewController.getUserReviews
);

/**
 * @route   GET /api/student/reviews/:reviewId
 * @desc    Get review details
 * @access  Private (Student & Admin)
 */
router.get(
  '/reviews/:reviewId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  reviewController.getReview
);

router.get(
  '/student/reviews/:reviewId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  reviewController.getReview
);

// ========== ADMIN ROUTES ==========

/**
 * @route   GET /api/admin/reviews
 * @desc    Get all reviews (admin)
 * @access  Private (Admin)
 */
router.get(
  '/reviews',
  authMiddleware,
  authorizeRole('admin'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Trang phải là số nguyên dương'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Giới hạn phải là số nguyên từ 1-100'),
    query('courseId').optional().isInt().withMessage('ID khóa học phải là số nguyên'),
    query('userId').optional().isInt().withMessage('ID người dùng phải là số nguyên'),
    query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Đánh giá phải từ 1-5')
  ],
  reviewController.getAllReviews
);

router.get(
  '/admin/reviews',
  authMiddleware,
  authorizeRole('admin'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Trang phải là số nguyên dương'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Giới hạn phải là số nguyên từ 1-100'),
    query('courseId').optional().isInt().withMessage('ID khóa học phải là số nguyên'),
    query('userId').optional().isInt().withMessage('ID người dùng phải là số nguyên'),
    query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Đánh giá phải từ 1-5')
  ],
  reviewController.getAllReviews
);

module.exports = router;
