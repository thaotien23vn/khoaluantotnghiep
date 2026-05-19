const db = require('../../models');
const EnrollmentAccess = require('../enrollment/enrollment.access');
const { Quiz, Question, Attempt, Course, Enrollment, UserLearningPath, LevelCertificate } = db.models;
const { Op } = require('sequelize');

const CEFR_SEQUENCE = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const CEFR_TO_COURSE_LEVEL = {
  'A1': 'beginner',
  'A2': 'elementary',
  'B1': 'intermediate',
  'B2': 'upper-intermediate',
  'C1': 'advanced',
  'C2': 'proficiency',
};

/**
 * Quiz Service - Business logic for quiz operations
 */
class QuizService {
  /**
   * Create a new quiz (course or final level quiz)
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
      level,
      isLevelFinal,
    } = quizData;

    if (isLevelFinal) {
      // Final quiz: no course required
      const quiz = await Quiz.create({
        courseId: null,
        title,
        description,
        maxScore: maxScore || 100,
        timeLimit: timeLimit || 60,
        passingScore: passingScore || 60,
        startTime: startTime || null,
        endTime: endTime || null,
        showResults: showResults !== undefined ? showResults : true,
        createdBy: userId,
        level: level || null,
        isLevelFinal: true,
        chapterId: null,
      });
      return { quiz };
    }

    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    // 🛡️ Fix: Use Number() for consistent comparison
    if (Number(course.createdBy) !== Number(userId) && userRole !== 'admin') {
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
      level: null,
      isLevelFinal: false,
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

    // 🛡️ Fix: Use Number() for consistent comparison
    if (Number(course.createdBy) !== Number(userId) && userRole !== 'admin') {
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
        { model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'], required: false },
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

    // Handle final quiz (no course)
    if (quiz.isLevelFinal) {
      if (Number(quiz.createdBy) !== Number(userId) && userRole !== 'admin') {
        throw { status: 403, message: 'Bạn không có quyền xem quiz này' };
      }
      return { quiz };
    }

    // 🛡️ Fix: Use Number() for consistent comparison
    if (Number(quiz.course.createdBy) !== Number(userId) && userRole !== 'admin') {
      const access = await EnrollmentAccess.checkAccess(userId, quiz.courseId, userRole);
      if (!access.hasAccess) {
        throw { status: 403, message: access.message || 'Bạn không có quyền xem quiz này' };
      }
    }

    return { quiz };
  }

  /**
   * Update a quiz
   */
  async updateQuiz(quizId, userId, userRole, updateData) {
    const quiz = await Quiz.findByPk(quizId, {
      include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'], required: false }],
    });

    if (!quiz) {
      throw { status: 404, message: 'Không tìm thấy quiz' };
    }

    // Handle final quiz (no course)
    const ownerId = quiz.isLevelFinal ? quiz.createdBy : quiz.course?.createdBy;
    if (Number(ownerId) !== Number(userId) && userRole !== 'admin') {
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
      include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'], required: false }],
    });

    if (!quiz) {
      throw { status: 404, message: 'Không tìm thấy quiz' };
    }

    // Handle final quiz (no course)
    const ownerId = quiz.isLevelFinal ? quiz.createdBy : quiz.course?.createdBy;
    if (Number(ownerId) !== Number(userId) && userRole !== 'admin') {
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
      include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'], required: false }],
    });

    if (!quiz) {
      throw { status: 404, message: 'Không tìm thấy quiz' };
    }

    // Handle final quiz (no course)
    const ownerId = quiz.isLevelFinal ? quiz.createdBy : quiz.course?.createdBy;
    if (Number(ownerId) !== Number(userId) && userRole !== 'admin') {
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

    // 🛡️ FIX: Auto-sync maxScore with total question points
    await this._syncQuizMaxScore(quizId);

    return { question };
  }

  /**
   * Helper: Sync quiz maxScore with total question points
   * @private
   */
  async _syncQuizMaxScore(quizId) {
    try {
      const totalPoints = await Question.sum('points', { where: { quizId } });
      const newMaxScore = totalPoints || 100; // Default to 100 if no questions
      await Quiz.update({ maxScore: newMaxScore }, { where: { id: quizId } });
    } catch (error) {
      console.error(`[QuizService] Failed to sync maxScore for quiz ${quizId}:`, error.message);
    }
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
          include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'], required: false }],
        },
      ],
    });

    if (!question) {
      throw { status: 404, message: 'Không tìm thấy câu hỏi' };
    }

    // Handle final quiz (no course)
    const ownerId = question.quiz.isLevelFinal ? question.quiz.createdBy : question.quiz.course?.createdBy;
    if (Number(ownerId) !== Number(userId) && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền cập nhật câu hỏi này' };
    }

    await question.update(updateData);
    
    // 🛡️ FIX: Auto-sync maxScore if points changed
    if (updateData.points !== undefined) {
      await this._syncQuizMaxScore(question.quizId);
    }
    
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
          include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'], required: false }],
        },
      ],
    });

    if (!question) {
      throw { status: 404, message: 'Không tìm thấy câu hỏi' };
    }

    // Handle final quiz (no course)
    const ownerId = question.quiz.isLevelFinal ? question.quiz.createdBy : question.quiz.course?.createdBy;
    if (Number(ownerId) !== Number(userId) && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền xóa câu hỏi này' };
    }

    const quizId = question.quizId;
    await question.destroy();
    
    // 🛡️ FIX: Auto-sync maxScore after deletion
    await this._syncQuizMaxScore(quizId);
    
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
      const access = await EnrollmentAccess.checkAccess(userId, courseId, userRole);
      if (!access.hasAccess) {
        throw { status: 403, message: access.message || 'Bạn chưa đăng ký hoặc ghi danh đã hết hạn' };
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
    try {
      const enrollments = await db.models.Enrollment.findAll({
        where: { 
          userId, 
          enrollmentStatus: { [db.Sequelize.Op.in]: ['active', 'grace_period'] } 
        },
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
    } catch (error) {
      throw error;
    }
  }

  // ========== FINAL QUIZ (LEVEL EXAM) METHODS ==========

  async listFinalQuizzes(userId, userRole) {
    const where = { isLevelFinal: true };
    if (userRole !== 'admin') {
      where.createdBy = userId;
    }
    return Quiz.findAll({
      where,
      include: [
        { model: Question, as: 'questions', attributes: ['id'] },
        { model: db.models.User, as: 'creator', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  async getUnlockStatus(userId, level) {
    const courseLevel = CEFR_TO_COURSE_LEVEL[level];
    const requiredCourses = await Course.findAll({
      where: {
        level: courseLevel,
        isRequired: true,
        status: 'published',
        deletedAt: null,
      },
      attributes: ['id', 'title'],
    });

    if (requiredCourses.length === 0) {
      return { unlocked: true, requiredCourses: [], completedCourses: [] };
    }

    const requiredCourseIds = requiredCourses.map(c => c.id);
    const enrollments = await Enrollment.findAll({
      where: {
        userId,
        courseId: { [Op.in]: requiredCourseIds },
        status: 'active',
      },
      attributes: ['courseId', 'progressPercent'],
    });

    const enrollmentMap = new Map();
    enrollments.forEach(e => enrollmentMap.set(Number(e.courseId), Number(e.progressPercent)));

    const completedCourseIds = requiredCourseIds.filter(id => {
      const progress = enrollmentMap.get(Number(id));
      return progress !== undefined && progress >= 100;
    });

    const unlocked = completedCourseIds.length >= requiredCourses.length;

    return {
      unlocked,
      requiredCourses: requiredCourses.map(c => ({ id: c.id, title: c.title })),
      completedCourses: completedCourseIds,
    };
  }

  async getStudentFinalQuiz(level, userId) {
    const quiz = await Quiz.findOne({
      where: { level, isLevelFinal: true, status: 'published' },
      include: [
        {
          model: Question,
          as: 'questions',
          attributes: ['id', 'type', 'content', 'options', 'points'],
        },
      ],
    });

    if (!quiz) {
      throw { status: 404, message: 'Chưa có bài kiểm tra cuối trình độ cho cấp độ này' };
    }

    const unlock = await this.getUnlockStatus(userId, level);
    if (!unlock.unlocked) {
      throw {
        status: 403,
        message: 'Bạn cần hoàn thành tất cả khóa học bắt buộc của trình độ này trước khi làm bài kiểm tra.',
        data: unlock,
      };
    }

    // Check if user already passed this final quiz
    const { Attempt } = db.models;
    const passedAttempt = await Attempt.findOne({
      where: { userId, quizId: quiz.id, passed: true },
      order: [['completedAt', 'DESC']],
    });

    return { quiz, unlockStatus: unlock, passedAttempt: passedAttempt ? {
      id: passedAttempt.id,
      score: passedAttempt.score,
      percentageScore: passedAttempt.percentageScore,
      completedAt: passedAttempt.completedAt,
    } : null };
  }

  async awardCertificateAndLevelUp(userId, level) {
    let cert = await LevelCertificate.findOne({ where: { userId, level } });
    let isNew = false;
    if (!cert) {
      const certificateId = `LEVEL-CERT-${level}-${userId}-${Date.now()}`;
      cert = await LevelCertificate.create({
        userId,
        level,
        certificateId,
        issuedAt: new Date(),
      });
      isNew = true;
    }

    const idx = CEFR_SEQUENCE.indexOf(level);
    let levelUp = null;
    if (idx !== -1 && idx < CEFR_SEQUENCE.length - 1) {
      const nextLevel = CEFR_SEQUENCE[idx + 1];
      const userPath = await UserLearningPath.findOne({
        where: { userId, status: { [Op.in]: ['active', 'completed'] } },
      });
      if (userPath) {
        await userPath.update({ currentLevel: nextLevel });
      }
      levelUp = { leveledUp: true, newLevel: nextLevel };
    } else {
      levelUp = { leveledUp: false, message: 'Đã đạt trình độ cao nhất' };
    }

    return { certificate: { certificateId: cert.certificateId, issuedAt: cert.issuedAt, isNew }, levelUp };
  }
}

module.exports = new QuizService();
