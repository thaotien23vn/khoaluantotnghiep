const db = require('../models');

const { Course, Review, Enrollment, Lecture, Chapter } = db.models;

async function recomputeCourseRating(courseId, options = {}) {
  const courseIdNum = Number(courseId);

  const stats = await Review.findAll({
    where: { courseId: courseIdNum },
    attributes: [
      [Review.sequelize.fn('AVG', Review.sequelize.col('rating')), 'averageRating'],
      [Review.sequelize.fn('COUNT', Review.sequelize.col('id')), 'totalReviews'],
    ],
    raw: true,
    transaction: options.transaction,
  });

  const averageRatingRaw = stats?.[0]?.averageRating;
  const totalReviewsRaw = stats?.[0]?.totalReviews;

  const averageRating = averageRatingRaw == null ? 0 : Number(averageRatingRaw);
  const reviewCount = totalReviewsRaw == null ? 0 : Number(totalReviewsRaw);

  await Course.update(
    {
      rating: Number.isFinite(averageRating) ? averageRating : 0,
      reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
    },
    {
      where: { id: courseIdNum },
      transaction: options.transaction,
    },
  );
}

async function recomputeCourseStudents(courseId, options = {}) {
  const courseIdNum = Number(courseId);

  const students = await Enrollment.count({
    where: {
      courseId: courseIdNum,
      status: 'enrolled',
    },
    transaction: options.transaction,
  });

  await Course.update(
    { students: Number(students) || 0 },
    { where: { id: courseIdNum }, transaction: options.transaction },
  );
}

async function recomputeCourseTotalLessons(courseId, options = {}) {
  const courseIdNum = Number(courseId);

  const totalLessons = await Lecture.count({
    include: [
      {
        model: Chapter,
        required: true,
        where: { courseId: courseIdNum },
        attributes: [],
      },
    ],
    distinct: true,
    col: 'Lecture.id',
    transaction: options.transaction,
  });

  await Course.update(
    { totalLessons: Number(totalLessons) || 0 },
    { where: { id: courseIdNum }, transaction: options.transaction },
  );
}

async function recomputeAllCourseAggregates(courseId, options = {}) {
  await Promise.all([
    recomputeCourseRating(courseId, options),
    recomputeCourseStudents(courseId, options),
    recomputeCourseTotalLessons(courseId, options),
  ]);
}

module.exports = {
  recomputeCourseRating,
  recomputeCourseStudents,
  recomputeCourseTotalLessons,
  recomputeAllCourseAggregates,
};
