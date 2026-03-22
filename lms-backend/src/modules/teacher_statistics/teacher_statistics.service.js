const db = require('../../models');

const { Course, Enrollment, Attempt, User, Quiz } = db.models;
const { Op } = require('sequelize');

/**
 * Teacher Statistics Service - Business logic for teacher dashboard statistics
 */
class TeacherStatisticsService {
  async getTeacherDetailedStatistics(instructorId, query) {
    const { courseId } = query;

    // 1. Get all courses owned by this instructor
    const courseWhere = { createdBy: instructorId };
    if (courseId) {
      courseWhere.id = courseId;
    }

    const instructorCourses = await Course.findAll({
      where: courseWhere,
      attributes: ['id', 'title'],
    });

    const instructorCourseIds = instructorCourses.map((c) => c.id);

    if (instructorCourseIds.length === 0) {
      return {
        summary: {
          activeStudents: 0,
          averageProgress: 0,
          totalCourses: 0,
          averageScore: 0,
        },
        scoreDistribution: [],
        ranking: [],
        courseList: [],
      };
    }

    // 2. Summary Card: Total Courses
    const totalCourses = instructorCourseIds.length;

    // 3. Summary Card: Active Students (Unique users enrolled in teacher's courses)
    const enrollments = await Enrollment.findAll({
      where: {
        courseId: { [Op.in]: instructorCourseIds },
      },
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    const activeUserIds = [...new Set(enrollments.map((e) => e.userId))];
    const activeStudentsCount = activeUserIds.length;

    // 4. Summary Card: Average Progress
    const totalProgress = enrollments.reduce((sum, e) => sum + Number(e.progressPercent || 0), 0);
    const averageProgress = enrollments.length > 0 ? (totalProgress / enrollments.length).toFixed(1) : 0;

    // 5. Summary Card: Average Quiz Score
    const instructorQuizzes = await Quiz.findAll({
      where: { courseId: { [Op.in]: instructorCourseIds } },
      attributes: ['id', 'courseId'],
    });
    const quizIds = instructorQuizzes.map((q) => q.id);

    const attempts = await Attempt.findAll({
      where: {
        quizId: { [Op.in]: quizIds },
        completedAt: { [Op.ne]: null },
      },
      attributes: ['id', 'percentageScore', 'userId', 'quizId', 'score', 'passed'],
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    const averageScore = attempts.length > 0
      ? (attempts.reduce((sum, a) => sum + Number(a.percentageScore || 0), 0) / attempts.length).toFixed(1)
      : 0;

    // 6. Score Distribution for Chart
    const scoreDistribution = [
      { range: '0-20', count: 0 },
      { range: '21-40', count: 0 },
      { range: '41-60', count: 0 },
      { range: '61-80', count: 0 },
      { range: '81-100', count: 0 },
    ];

    attempts.forEach((a) => {
      const score = Number(a.percentageScore || 0);
      if (score <= 20) scoreDistribution[0].count++;
      else if (score <= 40) scoreDistribution[1].count++;
      else if (score <= 60) scoreDistribution[2].count++;
      else if (score <= 80) scoreDistribution[3].count++;
      else scoreDistribution[4].count++;
    });

    // 7. Student Ranking by Score (Top 10)
    const userScores = {};
    attempts.forEach((a) => {
      if (!userScores[a.userId]) {
        userScores[a.userId] = { user: a.User, totalScore: 0, count: 0 };
      }
      userScores[a.userId].totalScore += Number(a.percentageScore || 0);
      userScores[a.userId].count++;
    });

    const ranking = Object.values(userScores)
      .map((u) => ({
        ...u.user.toJSON(),
        averageScore: (u.totalScore / u.count).toFixed(1),
      }))
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10);

    // 8. Course List with Stats
    const courseList = await Promise.all(
      instructorCourses.map(async (course) => {
        const courseEnrollments = await Enrollment.findAll({
          where: { courseId: course.id },
          attributes: ['id', 'progressPercent'],
        });
        const enrolledCount = courseEnrollments.length;
        const avgProgress = enrolledCount > 0
          ? (courseEnrollments.reduce((sum, e) => sum + Number(e.progressPercent || 0), 0) / enrolledCount).toFixed(1)
          : 0;

        return {
          id: course.id,
          title: course.title,
          enrolledCount,
          averageProgress: avgProgress,
        };
      })
    );

    return {
      summary: {
        activeStudents: activeStudentsCount,
        averageProgress,
        totalCourses,
        averageScore,
      },
      scoreDistribution,
      ranking,
      courseList,
    };
  }
}

module.exports = new TeacherStatisticsService();
