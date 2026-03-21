const db = require('../../models');
const courseAggregatesService = require('../../services/courseAggregates.service');

const { Review, Course, User, Enrollment } = db.models;

/**
 * Review Service - Business logic for review operations
 */
class ReviewService {
  async createReview(userId, courseId, data) {
    const { rating, comment } = data;

    // Check if course exists and is published
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (!course.published) {
      throw { status: 400, message: 'Khóa học chưa được xuất bản' };
    }

    // Check if user is enrolled in the course
    const enrollment = await Enrollment.findOne({
      where: { userId, courseId, status: 'enrolled' }
    });

    if (!enrollment) {
      throw { status: 403, message: 'Bạn cần đăng ký khóa học này để đánh giá' };
    }

    // Check if user already reviewed this course
    const existingReview = await Review.findOne({
      where: { userId, courseId }
    });

    if (existingReview) {
      throw { status: 409, message: 'Bạn đã đánh giá khóa học này' };
    }

    // Create review
    const review = await Review.create({
      userId,
      courseId,
      rating,
      comment
    });

    // Recompute course rating
    try {
      await courseAggregatesService.recomputeCourseRating(courseId);
    } catch (aggErr) {
      console.error('Recompute course rating/reviewCount (silent) error:', aggErr);
    }

    // Fetch review with user info
    const createdReview = await Review.findByPk(review.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'avatar']
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug']
        }
      ]
    });

    return { review: createdReview };
  }

  async getCourseReviews(courseId, query) {
    const { page = 1, limit = 10 } = query;
    const offset = (page - 1) * limit;

    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: { courseId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'avatar']
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

    return {
      reviews,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  async getUserReviews(userId, query) {
    const { page = 1, limit = 10 } = query;
    const offset = (page - 1) * limit;

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: { userId },
      include: [
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

    return {
      reviews,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  async getReview(reviewId) {
    const review = await Review.findByPk(reviewId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'avatar']
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug']
        }
      ]
    });

    if (!review) {
      throw { status: 404, message: 'Không tìm thấy đánh giá' };
    }

    return { review };
  }

  async getAllReviews(query) {
    const { page = 1, limit = 20, courseId, userId, minRating } = query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (courseId) whereClause.courseId = courseId;
    if (userId) whereClause.userId = userId;
    if (minRating) whereClause.rating = { [db.Sequelize.Op.gte]: minRating };

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'avatar']
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

    return {
      reviews,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  async updateReview(userId, reviewId, data) {
    const { rating, comment } = data;

    const review = await Review.findByPk(reviewId);
    if (!review) {
      throw { status: 404, message: 'Không tìm thấy đánh giá' };
    }

    if (review.userId !== userId) {
      throw { status: 403, message: 'Không có quyền cập nhật đánh giá này' };
    }

    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    await review.save();

    // Recompute course rating
    try {
      await courseAggregatesService.recomputeCourseRating(review.courseId);
    } catch (aggErr) {
      console.error('Recompute course rating/reviewCount (silent) error:', aggErr);
    }

    return { review };
  }

  async deleteReview(userId, reviewId, isAdmin = false) {
    const review = await Review.findByPk(reviewId);
    if (!review) {
      throw { status: 404, message: 'Không tìm thấy đánh giá' };
    }

    if (!isAdmin && review.userId !== userId) {
      throw { status: 403, message: 'Không có quyền xóa đánh giá này' };
    }

    const courseId = review.courseId;
    await review.destroy();

    // Recompute course rating
    try {
      await courseAggregatesService.recomputeCourseRating(courseId);
    } catch (aggErr) {
      console.error('Recompute course rating/reviewCount (silent) error:', aggErr);
    }

    return { message: 'Đã xóa đánh giá thành công' };
  }
}

module.exports = new ReviewService();
