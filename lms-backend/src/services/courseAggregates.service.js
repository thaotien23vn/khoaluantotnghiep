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

  const chapters = await Chapter.findAll({
    where: { courseId: courseIdNum },
    attributes: ['id'],
    raw: true,
    transaction: options.transaction,
  });

  const chapterIds = (chapters || []).map((c) => Number(c.id)).filter((id) => Number.isFinite(id));

  const totalLessons = chapterIds.length
    ? await Lecture.count({
        where: { chapterId: chapterIds },
        transaction: options.transaction,
      })
    : 0;

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
