const db = require('../../models');
const courseAggregatesService = require('../../services/courseAggregates.service');
const EnrollmentAccess = require('../enrollment/enrollment.access');
const { Op } = require('sequelize');

const { Review, Course, User, LectureProgress } = db.models;

/**
 * Review Service - Business logic for review operations
 */
class ReviewService {
  async createReview(userId, courseId, data) {
    const { rating, comment } = data;

    const course = await Course.findByPk(courseId);
    if (!course) throw { status: 404, message: 'Không tìm thấy khóa học' };
    if (!course.published) throw { status: 400, message: 'Khóa học chưa được xuất bản' };

    const access = await EnrollmentAccess.checkAccess(userId, courseId, 'content');
    if (!access.hasAccess) throw { status: 403, message: access.message || 'Bạn cần đăng ký khóa học này để đánh giá' };

    // ADDED: Check that student has completed at least 1 lecture before reviewing
    const completedCount = await LectureProgress.count({
      where: { userId, courseId, isCompleted: true },
    });
    if (completedCount === 0) {
      throw {
        status: 403,
        message: 'Bạn cần hoàn thành ít nhất 1 bài giảng trước khi đánh giá khóa học',
      };
    }

    const existingReview = await Review.findOne({ where: { userId, courseId } });
    if (existingReview) throw { status: 409, message: 'Bạn đã đánh giá khóa học này' };

    const review = await Review.create({ userId, courseId, rating, comment });

    try {
      await courseAggregatesService.recomputeCourseRating(courseId);
    } catch (aggErr) {
      console.error('Recompute course rating (silent) error:', aggErr);
    }

    const createdReview = await Review.findByPk(review.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'avatar'] },
        { model: Course, as: 'course', attributes: ['id', 'title', 'slug'] },
      ],
    });

    return { review: createdReview };
  }

  async getCourseReviews(courseId, query) {
    const { page = 1, limit = 10 } = query;
    const offset = (page - 1) * limit;

    const course = await Course.findByPk(courseId);
    if (!course) throw { status: 404, message: 'Không tìm thấy khóa học' };

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: { courseId },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'avatar'] },
        { model: Course, as: 'course', attributes: ['id', 'title', 'slug'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    return {
      reviews,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getUserReviews(userId, query) {
    const { page = 1, limit = 10 } = query;
    const offset = (page - 1) * limit;

    const { count, rows: reviews } = await Review.findAndCountAll({
      where: { userId },
      include: [
        { model: Course, as: 'course', attributes: ['id', 'title', 'slug', 'imageUrl'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    return {
      reviews,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getReview(reviewId) {
    const review = await Review.findByPk(reviewId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'avatar'] },
        { model: Course, as: 'course', attributes: ['id', 'title', 'slug'] },
      ],
    });
    if (!review) throw { status: 404, message: 'Không tìm thấy đánh giá' };
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
        { model: User, as: 'user', attributes: ['id', 'name', 'avatar'] },
        { model: Course, as: 'course', attributes: ['id', 'title', 'slug'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    return {
      reviews,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Update review — FIXED: properly handles empty string comment updates
   */
  async updateReview(userId, reviewId, data) {
    const { rating, comment } = data;

    const review = await Review.findByPk(reviewId);
    if (!review) throw { status: 404, message: 'Không tìm thấy đánh giá' };
    if (review.userId !== userId) throw { status: 403, message: 'Không có quyền cập nhật đánh giá này' };

    // Fix: use explicit undefined check instead of || so empty string is accepted
    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;
    await review.save();

    try {
      await courseAggregatesService.recomputeCourseRating(review.courseId);
    } catch (aggErr) {
      console.error('Recompute course rating (silent) error:', aggErr);
    }

    return { review };
  }

  async deleteReview(userId, reviewId, isAdmin = false) {
    const review = await Review.findByPk(reviewId);
    if (!review) throw { status: 404, message: 'Không tìm thấy đánh giá' };
    if (!isAdmin && review.userId !== userId) throw { status: 403, message: 'Không có quyền xóa đánh giá này' };

    const courseId = review.courseId;
    await review.destroy();

    try {
      await courseAggregatesService.recomputeCourseRating(courseId);
    } catch (aggErr) {
      console.error('Recompute course rating (silent) error:', aggErr);
    }

    return { message: 'Đã xóa đánh giá thành công' };
  }
}

module.exports = new ReviewService();
