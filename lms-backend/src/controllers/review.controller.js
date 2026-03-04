const db = require('../models');
const { Review, Course, User, Enrollment } = db.models;
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

/**
 * @desc    Create a review for a course
 * @route   POST /api/student/courses/:courseId/reviews
 * @access  Private (Student & Admin)
 */
exports.createReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    const { courseId } = req.params;
    const { rating, comment } = req.body;

    // Check if course exists and is published
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học'
      });
    }

    if (!course.published) {
      return res.status(400).json({
        success: false,
        message: 'Khóa học chưa được xuất bản'
      });
    }

    // Check if user is enrolled in the course
    const enrollment = await Enrollment.findOne({
      where: {
        userId: req.user.id,
        courseId,
        status: 'enrolled'
      }
    });

    if (!enrollment && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn cần đăng ký khóa học này để đánh giá'
      });
    }

    // Check if user already reviewed this course
    const existingReview = await Review.findOne({
      where: {
        userId: req.user.id,
        courseId
      }
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: 'Bạn đã đánh giá khóa học này'
      });
    }

    // Create review
    const review = await Review.create({
      userId: req.user.id,
      courseId,
      rating,
      comment
    });

    // Fetch review with user info
    const createdReview = await Review.findByPk(review.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'avatar']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Đánh giá đã được tạo thành công',
      data: { review: createdReview }
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Update a review
 * @route   PUT /api/student/reviews/:reviewId
 * @access  Private (Student & Admin)
 */
exports.updateReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    const { reviewId } = req.params;
    const { rating, comment } = req.body;

    const review = await Review.findByPk(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đánh giá'
      });
    }

    // Check ownership
    if (review.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật đánh giá này'
      });
    }

    await review.update({
      rating,
      comment
    });

    // Fetch updated review with user info
    const updatedReview = await Review.findByPk(reviewId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'avatar']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Cập nhật đánh giá thành công',
      data: { review: updatedReview }
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a review
 * @route   DELETE /api/student/reviews/:reviewId
 * @access  Private (Student & Admin)
 */
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findByPk(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đánh giá'
      });
    }

    // Check ownership
    if (review.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa đánh giá này'
      });
    }

    await review.destroy();

    res.json({
      success: true,
      message: 'Xóa đánh giá thành công'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Get reviews for a course
 * @route   GET /api/courses/:courseId/reviews
 * @access  Public
 */
exports.getCourseReviews = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 10, rating, sort = 'newest' } = req.query;
    const offset = (page - 1) * limit;

    // Check if course exists
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học'
      });
    }

    // Build where clause
    const whereClause = { courseId };
    if (rating) {
      whereClause.rating = parseInt(rating);
    }

    // Build order clause
    let orderClause;
    switch (sort) {
      case 'newest':
        orderClause = [['created_at', 'DESC']];
        break;
      case 'oldest':
        orderClause = [['created_at', 'ASC']];
        break;
      case 'highest':
        orderClause = [['rating', 'DESC'], ['created_at', 'DESC']];
        break;
      case 'lowest':
        orderClause = [['rating', 'ASC'], ['created_at', 'DESC']];
        break;
      default:
        orderClause = [['created_at', 'DESC']];
    }

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'avatar']
        }
      ],
      order: orderClause,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Calculate rating statistics
    const ratingStats = await Review.findAll({
      where: { courseId },
      attributes: [
        [Review.sequelize.fn('AVG', Review.sequelize.col('rating')), 'averageRating'],
        [Review.sequelize.fn('COUNT', Review.sequelize.col('id')), 'totalReviews']
      ],
      raw: true
    });

    // Get rating distribution
    const ratingDistribution = await Review.findAll({
      where: { courseId },
      attributes: [
        'rating',
        [Review.sequelize.fn('COUNT', Review.sequelize.col('id')), 'count']
      ],
      group: ['rating'],
      raw: true
    });

    const stats = {
      averageRating: parseFloat(ratingStats[0]?.averageRating || 0).toFixed(1),
      totalReviews: parseInt(ratingStats[0]?.totalReviews || 0),
      distribution: ratingDistribution.reduce((acc, item) => {
        acc[item.rating] = parseInt(item.count);
        return acc;
      }, { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 })
    };

    res.json({
      success: true,
      data: {
        reviews,
        statistics: stats,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get course reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Get user's reviews
 * @route   GET /api/student/reviews
 * @access  Private (Student & Admin)
 */
exports.getUserReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: {
        userId: req.user.id
      },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug', 'price']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Get review details
 * @route   GET /api/student/reviews/:reviewId
 * @access  Private (Student & Admin)
 */
exports.getReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findByPk(reviewId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'avatar', 'email']
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug', 'description', 'price']
        }
      ]
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đánh giá'
      });
    }

    // Check ownership or admin
    if (review.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem đánh giá này'
      });
    }

    res.json({
      success: true,
      data: { review }
    });
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Get reviews for admin (all reviews)
 * @route   GET /api/admin/reviews
 * @access  Private (Admin)
 */
exports.getAllReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, courseId, userId, rating, status } = req.query;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {};
    if (courseId) whereClause.courseId = parseInt(courseId);
    if (userId) whereClause.userId = parseInt(userId);
    if (rating) whereClause.rating = parseInt(rating);

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};
