const express = require('express');
const authMiddleware = require('../middlewares/auth');
const { authorizeRole } = require('../middlewares/authorize');
const reviewController = require('../modules/review/review.controller');
const {
  createReviewValidation,
  getCourseReviewsValidation,
  updateReviewValidation,
  deleteReviewValidation,
  getUserReviewsValidation,
  getAllReviewsValidation,
} = require('../modules/review/review.validation');

const router = express.Router();

// ========== PUBLIC ROUTES ==========

/**
 * @route   GET /api/courses/:courseId/reviews
 * @desc    Get reviews for a course
 * @access  Public
 */
router.get(
  '/courses/:courseId/reviews',
  getCourseReviewsValidation,
  reviewController.getCourseReviews
);

// ========== STUDENT ROUTES ==========

/**
 * @route   POST /api/student/courses/:courseId/reviews
 * @desc    Create a review for a course
 * @access  Private (Student & Admin)
 */
router.post(
  '/student/courses/:courseId/reviews',
  authMiddleware,
  authorizeRole('student', 'admin'),
  createReviewValidation,
  reviewController.createReview
);

/**
 * @route   PUT /api/student/reviews/:reviewId
 * @desc    Update a review
 * @access  Private (Student & Admin)
 */
router.put(
  '/student/reviews/:reviewId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  updateReviewValidation,
  reviewController.updateReview
);

/**
 * @route   DELETE /api/student/reviews/:reviewId
 * @desc    Delete a review
 * @access  Private (Student & Admin)
 */
router.delete(
  '/student/reviews/:reviewId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  deleteReviewValidation,
  reviewController.deleteReview
);

/**
 * @route   GET /api/student/reviews
 * @desc    Get user's reviews
 * @access  Private (Student & Admin)
 */
router.get(
  '/student/reviews',
  authMiddleware,
  authorizeRole('student', 'admin'),
  getUserReviewsValidation,
  reviewController.getUserReviews
);

/**
 * @route   GET /api/student/reviews/:reviewId
 * @desc    Get review details
 * @access  Private (Student & Admin)
 */
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
  '/admin/reviews',
  authMiddleware,
  authorizeRole('admin'),
  getAllReviewsValidation,
  reviewController.getAllReviews
);

module.exports = router;
