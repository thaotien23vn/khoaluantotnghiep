const db = require('../../models');
const { Quiz, Question, Attempt, Course } = db.models;

/**
 * Quiz Service - Business logic for quiz operations
 */
class QuizService {
  /**
   * Create a new quiz
   */
  async createQuiz(courseId, userId, userRole, quizData) {
    const {
      title,
      description,
      maxScore,
      timeLimit,
      passingScore,
      startTime,
      endTime,
      showResults,
      chapterId,
    } = quizData;

    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (course.createdBy !== userId && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền tạo quiz cho khóa học này' };
    }

    const quiz = await Quiz.create({
      courseId,
      title,
      description,
      maxScore: maxScore || 100,
      timeLimit: timeLimit || 60,
      passingScore: passingScore || 60,
      startTime: startTime || null,
      endTime: endTime || null,
      showResults: showResults !== undefined ? showResults : true,
      createdBy: userId,
      chapterId: chapterId || null,
    });

    return { quiz };
  }

  /**
   * Get course quizzes (teacher view)
   */
  async getCourseQuizzes(courseId, userId, userRole) {
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (course.createdBy !== userId && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền xem quiz của khóa học này' };
    }

    const quizzes = await Quiz.findAll({
      where: { courseId },
      include: [{ model: Question, as: 'questions' }],
      order: [[db.sequelize.col('Quiz.created_at'), 'DESC']],
    });

    return { quizzes };
  }

  /**
   * Get quiz details
   */
  async getQuiz(quizId, userId, userRole) {
    const quiz = await Quiz.findByPk(quizId, {
      include: [
        { model: Question, as: 'questions' },
        { model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'] },
        {
          model: Attempt,
          as: 'attempts',
          include: [{ model: db.models.User, as: 'user', attributes: ['id', 'name', 'email'] }],
        },
      ],
    });

    if (!quiz) {
      throw { status: 404, message: 'Không tìm thấy quiz' };
    }

    if (quiz.course.createdBy !== userId && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền xem quiz này' };
    }

    return { quiz };
  }

  /**
   * Update a quiz
   */
  async updateQuiz(quizId, userId, userRole, updateData) {
    const quiz = await Quiz.findByPk(quizId, {
      include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'] }],
    });

    if (!quiz) {
      throw { status: 404, message: 'Không tìm thấy quiz' };
    }

    if (quiz.course.createdBy !== userId && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền cập nhật quiz này' };
    }

    await quiz.update(updateData);
    return { quiz };
  }

  /**
   * Delete a quiz
   */
  async deleteQuiz(quizId, userId, userRole) {
    const quiz = await Quiz.findByPk(quizId, {
      include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'] }],
    });

    if (!quiz) {
      throw { status: 404, message: 'Không tìm thấy quiz' };
    }

    if (quiz.course.createdBy !== userId && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền xóa quiz này' };
    }

    await quiz.destroy();
    return { message: 'Xóa quiz thành công' };
  }

  /**
   * Add question to quiz
   */
  async addQuestion(quizId, userId, userRole, questionData) {
    const { type, content, options, correctAnswer, points, explanation } = questionData;

    const quiz = await Quiz.findByPk(quizId, {
      include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'] }],
    });

    if (!quiz) {
      throw { status: 404, message: 'Không tìm thấy quiz' };
    }

    if (quiz.course.createdBy !== userId && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền thêm câu hỏi cho quiz này' };
    }

    const question = await Question.create({
      quizId,
      type,
      content,
      options: options || null,
      correctAnswer,
      points: points || 1,
      explanation,
    });

    return { question };
  }

  /**
   * Update a question
   */
  async updateQuestion(questionId, userId, userRole, updateData) {
    const question = await Question.findByPk(questionId, {
      include: [
        {
          model: Quiz,
          as: 'quiz',
          include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'] }],
        },
      ],
    });

    if (!question) {
      throw { status: 404, message: 'Không tìm thấy câu hỏi' };
    }

    if (question.quiz.course.createdBy !== userId && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền cập nhật câu hỏi này' };
    }

    await question.update(updateData);
    return { question };
  }

  /**
   * Delete a question
   */
  async deleteQuestion(questionId, userId, userRole) {
    const question = await Question.findByPk(questionId, {
      include: [
        {
          model: Quiz,
          as: 'quiz',
          include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'] }],
        },
      ],
    });

    if (!question) {
      throw { status: 404, message: 'Không tìm thấy câu hỏi' };
    }

    if (question.quiz.course.createdBy !== userId && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền xóa câu hỏi này' };
    }

    await question.destroy();
    return { message: 'Xóa câu hỏi thành công' };
  }

  /**
   * Get student course quizzes
   */
  async getStudentCourseQuizzes(courseId, userId, userRole) {
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (userRole !== 'admin') {
      const enrollment = await db.models.Enrollment.findOne({
        where: { userId, courseId, status: 'enrolled' },
      });
      if (!enrollment) {
        throw { status: 403, message: 'Bạn chưa đăng ký khóa học này' };
      }
    }

    const quizzes = await Quiz.findAll({
      where: { courseId, status: 'published' },
      attributes: ['id', 'title', 'description', 'maxScore', 'timeLimit', 'passingScore', 'startTime', 'endTime', 'showResults'],
      include: [
        {
          model: Attempt,
          as: 'attempts',
          where: { userId },
          required: false,
          attributes: ['id', 'score', 'percentageScore', 'passed', 'startedAt', 'completedAt'],
          order: [['startedAt', 'DESC']],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const formattedQuizzes = quizzes.map((quiz) => {
      const attempts = quiz.attempts || [];
      // Explicitly sort attempts descending by startedAt to guarantee latest Attempt is at index 0
      attempts.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

      let status = 'not_started';
      let latestAttempt = null;
      let bestAttempt = null;

      if (attempts.length > 0) {
        latestAttempt = attempts[0];
        
        // Find best COMPLETED attempt
        bestAttempt = attempts.reduce((best, current) => {
          if (!current.completedAt) return best;
          if (!best) return current;
          return (current.percentageScore || 0) > (best.percentageScore || 0) ? current : best;
        }, null);

        const hasCompleted = attempts.some((a) => a.completedAt);
        const hasInProgress = attempts.some((a) => !a.completedAt);
        if (hasInProgress) status = 'in_progress';
        else if (hasCompleted) status = 'completed';
      }

      // If no best attempt was found (e.g., all are in progress), fallback to latest Attempt
      const referenceAttempt = bestAttempt || latestAttempt;
      const isPassed = attempts.some(a => a.passed === true) ? true : (attempts.some(a => a.passed === null) ? null : false);

      return {
        ...quiz.toJSON(),
        attempts: undefined,
        status,
        userStatus: {
          status,
          lastScore: referenceAttempt?.percentageScore || 0, // Using best score here
          isPassed: isPassed,
          attemptCount: attempts.length,
          latestAttemptId: latestAttempt?.id || null,
        },
      };
    });

    return { quizzes: formattedQuizzes };
  }

  /**
   * Get all quizzes for student dashboard
   */
  async getAllMyQuizzes(userId) {
    const enrollments = await db.models.Enrollment.findAll({
      where: { userId, status: 'enrolled' },
      attributes: ['courseId'],
    });

    const courseIds = enrollments.map((e) => e.courseId);
    if (courseIds.length === 0) {
      return { quizzes: [] };
    }

    const quizzes = await Quiz.findAll({
      where: { courseId: courseIds, status: 'published' },
      attributes: ['id', 'title', 'description', 'maxScore', 'timeLimit', 'passingScore', 'startTime', 'endTime', 'showResults'],
      include: [
        { model: Course, as: 'course', attributes: ['id', 'title', 'imageUrl'] },
        {
          model: Attempt,
          as: 'attempts',
          where: { userId },
          required: false,
          attributes: ['id', 'score', 'percentageScore', 'passed', 'completedAt'],
          order: [['startedAt', 'DESC']],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const formattedQuizzes = quizzes.map((quiz) => {
      const attempts = quiz.attempts || [];
      // Explicitly sort attempts descending by startedAt to guarantee latest Attempt is at index 0
      attempts.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

      let status = 'not_started';
      let latestAttempt = null;
      let bestAttempt = null;

      if (attempts.length > 0) {
        latestAttempt = attempts[0];

        // Find best COMPLETED attempt
        bestAttempt = attempts.reduce((best, current) => {
          if (!current.completedAt) return best;
          if (!best) return current;
          return (current.percentageScore || 0) > (best.percentageScore || 0) ? current : best;
        }, null);

        const hasCompleted = attempts.some((a) => a.completedAt);
        const hasInProgress = attempts.some((a) => !a.completedAt);
        if (hasInProgress) status = 'in_progress';
        else if (hasCompleted) status = 'completed';
      }

      // If no best attempt was found, fallback to latest Attempt
      const referenceAttempt = bestAttempt || latestAttempt;
      const isPassed = attempts.some(a => a.passed === true) ? true : (attempts.some(a => a.passed === null) ? null : false);

      return {
        ...quiz.toJSON(),
        attempts: undefined,
        status,
        courseTitle: quiz.course?.title,
        userStatus: {
          status,
          lastScore: referenceAttempt?.percentageScore || 0, // Using best score
          isPassed: isPassed,
          attemptCount: attempts.length,
          latestAttemptId: latestAttempt?.id || null,
        },
      };
    });

    return { quizzes: formattedQuizzes };
  }
}

module.exports = new QuizService();
