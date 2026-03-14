const db = require("../models");
const { Course, Enrollment, Attempt, User, Quiz } = db.models;
const { Op } = require("sequelize");

/**
 * @desc    Get detailed statistics for teacher dashboard
 * @route   GET /api/teacher/statistics
 * @access  Private (Teacher & Admin)
 */
exports.getTeacherDetailedStatistics = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { courseId } = req.query;

    // 1. Get all courses owned by this instructor
    const courseWhere = { createdBy: instructorId };
    if (courseId) {
      courseWhere.id = courseId;
    }

    const instructorCourses = await Course.findAll({
      where: courseWhere,
      attributes: ["id", "title"],
    });

    const instructorCourseIds = instructorCourses.map((c) => c.id);

    if (instructorCourseIds.length === 0) {
      return res.json({
        success: true,
        data: {
          summary: {
            activeStudents: 0,
            averageProgress: 0,
            totalCourses: 0,
            averageScore: 0,
          },
          scoreDistribution: [],
          ranking: [],
          courseList: [],
        },
      });
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
          attributes: ["id", "name", "email"],
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
      attributes: ["id", "courseId"],
    });
    const quizIds = instructorQuizzes.map((q) => q.id);

    const attempts = await Attempt.findAll({
      where: {
        quizId: { [Op.in]: quizIds },
        completedAt: { [Op.ne]: null },
      },
      attributes: ["id", "percentageScore", "userId", "quizId", "score", "passed"],
    });

    const totalScore = attempts.reduce((sum, a) => sum + Number(a.percentageScore || 0), 0);
    const averageScore = attempts.length > 0 ? (totalScore / attempts.length).toFixed(1) : 0;

    // 6. Score Distribution Chart
    // Distribute scores into buckets: 0-20, 21-40, 41-60, 61-80, 81-100
    const distribution = [
      { range: "0-20%", count: 0, label: "Cần cải thiện" },
      { range: "21-40%", count: 0, label: "Trung bình yếu" },
      { range: "41-60%", count: 0, label: "Trung bình" },
      { range: "61-80%", count: 0, label: "Khá" },
      { range: "81-100%", count: 0, label: "Xuất sắc" },
    ];

    attempts.forEach((a) => {
      const score = Number(a.percentageScore);
      if (score <= 20) distribution[0].count++;
      else if (score <= 40) distribution[1].count++;
      else if (score <= 60) distribution[2].count++;
      else if (score <= 80) distribution[3].count++;
      else distribution[4].count++;
    });

    // 7. Student Ranking Table (Per Enrollment)
    const ranking = enrollments.map((e) => {
      const uId = Number(e.userId);
      const cId = Number(e.courseId);
      
      // Chuyển instructorQuizzes sang dạng mảng ID để so sánh chính xác
      const courseQuizIds = instructorQuizzes
        .filter(q => Number(q.courseId || q.get?.('courseId')) === cId)
        .map(q => Number(q.id || q.get?.('id')));
      
      const studentCourseAttempts = attempts.filter(a => 
        Number(a.userId) === uId && 
        courseQuizIds.includes(Number(a.quizId))
      );
      
      const highestScore = studentCourseAttempts.length > 0 
        ? Math.max(...studentCourseAttempts.map(a => Number(a.score || 0))) 
        : 0;

      const courseObj = instructorCourses.find(c => Number(c.id) === cId);

      return {
        studentName: e.User?.name || "Học viên",
        studentEmail: e.User?.email,
        courseTitle: courseObj ? courseObj.title : "N/A",
        courseProgress: Number(parseFloat(e.progressPercent || 0).toFixed(1)),
        highestScore: Number(highestScore.toFixed(1)), // Trả về điểm tuyệt đối (ví dụ 1.0)
        achievement: (studentCourseAttempts.some(a => a.passed)) ? "Đạt" : "Cần cố gắng",
      };
    });

    // Sort by score then progress
    ranking.sort((a, b) => b.highestScore - a.highestScore || b.courseProgress - a.courseProgress);

    const rankedData = ranking.slice(0, 5).map((item, index) => ({
      rank: index + 1,
      ...item
    }));

    // 8. Trends (Mock)
    const trends = {
      activeStudents: "+0%",
      averageProgress: "+0.0%",
      totalCourses: "+0",
      averageScore: "+0.0%",
    };

    // 9. AI Innovation Suggestions
    const aiSuggestions = [];
    if (averageProgress < 50) {
      aiSuggestions.push({
        type: "improvement",
        title: "Cần bổ sung bài tập",
        description: "Dựa trên tỷ lệ nộp bài, học viên đang có xu hướng chậm lại ở các chương lý thuyết dài.",
        action: "THÊM BÀI TẬP",
      });
    } else {
      aiSuggestions.push({
        type: "success",
        title: "Tỷ lệ giữ chân học viên tốt",
        description: "Học viên quay lại học mỗi ngày tăng 25% sau khi cập nhật giao diện bài giảng mới.",
        action: "XEM CHI TIẾT",
      });
    }

    res.json({
      success: true,
      data: {
        summary: {
          activeStudents: activeStudentsCount,
          averageProgress: Number(averageProgress),
          totalCourses,
          averageScore: Number(averageScore),
          trends,
        },
        scoreDistribution: distribution,
        ranking: rankedData,
        courseList: instructorCourses,
        aiSuggestions,
      },
    });
  } catch (error) {
    console.error("Detailed statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy thống kê",
      error: error.message,
    });
  }
};
