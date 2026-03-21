const db = require('../../models');
const { Attempt, Quiz, Question, Course, User, Enrollment } = db.models;

/**
 * Attempt Service - Business logic for quiz attempts
 */
class AttemptService {
  /**
   * Start a quiz attempt
   */
  async startAttempt(quizId, userId, userRole) {
    const quiz = await Quiz.findByPk(quizId, {
      include: [
        { model: Course, as: 'course', attributes: ['id', 'title', 'published'] },
        { model: Question, as: 'questions', attributes: ['id', 'type', 'content', 'options', 'points'] },
      ],
      attributes: ['id', 'title', 'description', 'timeLimit', 'maxScore', 'startTime', 'endTime', 'courseId'],
    });

    if (!quiz) {
      throw { status: 404, message: 'Không tìm thấy quiz' };
    }

    if (!quiz.course.published) {
      throw { status: 400, message: 'Khóa học chưa được xuất bản' };
    }

    // Check scheduled time
    const now = new Date();
    if (quiz.startTime && now < new Date(quiz.startTime)) {
      throw { status: 403, message: 'Bài thi chưa đến thời gian bắt đầu', data: { startTime: quiz.startTime } };
    }

    if (quiz.endTime && now > new Date(quiz.endTime)) {
      throw { status: 403, message: 'Bài thi đã hết thời gian thực hiện', data: { endTime: quiz.endTime } };
    }

    // Check enrollment
    if (userRole !== 'admin') {
      const enrollment = await Enrollment.findOne({
        where: { userId, courseId: quiz.courseId, status: 'enrolled' },
      });
      if (!enrollment) {
        throw { status: 403, message: 'Bạn chưa đăng ký khóa học này' };
      }
    }

    // Check for active attempt
    const activeAttempt = await Attempt.findOne({
      where: { userId, quizId, completedAt: null },
    });

    if (activeAttempt) {
      return {
        attempt: {
          id: activeAttempt.id,
          quizId: activeAttempt.quizId,
          startedAt: activeAttempt.startedAt,
          timeLimit: quiz.timeLimit,
        },
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          timeLimit: quiz.timeLimit,
          maxScore: quiz.maxScore,
          questions: quiz.questions,
        },
      };
    }

    // Create new attempt
    const attempt = await Attempt.create({
      userId,
      quizId,
      answers: {},
      score: 0,
      startedAt: new Date(),
    });

    return {
      attempt: {
        id: attempt.id,
        quizId: attempt.quizId,
        startedAt: attempt.startedAt,
        timeLimit: quiz.timeLimit,
      },
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        timeLimit: quiz.timeLimit,
        maxScore: quiz.maxScore,
        questions: quiz.questions,
      },
    };
  }

  /**
   * Submit quiz attempt
   */
  async submitAttempt(attemptId, userId, userRole, answers) {
    const attempt = await Attempt.findByPk(attemptId, {
      include: [
        {
          model: Quiz,
          as: 'quiz',
          attributes: ['id', 'title', 'description', 'passingScore', 'showResults'],
          include: [{ model: Question, as: 'questions' }],
        },
      ],
    });

    if (!attempt) {
      throw { status: 404, message: 'Không tìm thấy lần làm bài' };
    }

    if (attempt.userId !== userId && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền nộp bài này' };
    }

    if (attempt.completedAt) {
      throw { status: 400, message: 'Lần làm bài này đã được nộp' };
    }

    // Calculate score
    let totalScore = 0;
    let maxScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let manualGradingCount = 0;
    const results = [];

    for (const question of attempt.quiz.questions) {
      maxScore += question.points;
      const userAnswer = answers[question.id];
      let isCorrect = false;
      let pointsEarned = 0;

      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        const userVal = userAnswer !== undefined && userAnswer !== null ? String(userAnswer).trim() : '';
        let correctVal = question.correctAnswer !== undefined && question.correctAnswer !== null ? String(question.correctAnswer).trim() : '';
        while (correctVal.startsWith('"') && correctVal.endsWith('"') && correctVal.length >= 2) {
          correctVal = correctVal.substring(1, correctVal.length - 1);
        }
        isCorrect = userVal === correctVal;
        pointsEarned = isCorrect ? question.points : 0;
      } else if (question.type === 'short_answer') {
        const userStr = userAnswer ? String(userAnswer).toLowerCase().trim() : '';
        let correctStr = question.correctAnswer ? String(question.correctAnswer).toLowerCase().trim() : '';
        while (correctStr.startsWith('"') && correctStr.endsWith('"') && correctStr.length >= 2) {
          correctStr = correctStr.substring(1, correctStr.length - 1).trim();
        }
        isCorrect = userStr === correctStr;
        pointsEarned = isCorrect ? question.points : 0;
      } else if (question.type === 'essay') {
        pointsEarned = 0;
        manualGradingCount++;
      }

      if (question.type !== 'essay') {
        if (isCorrect) correctCount++;
        else incorrectCount++;
      }

      totalScore += pointsEarned;

      results.push({
        questionId: question.id,
        userAnswer,
        correctAnswer: attempt.quiz.showResults ? question.correctAnswer : undefined,
        isCorrect,
        pointsEarned,
        maxPoints: question.points,
        explanation: attempt.quiz.showResults ? question.explanation : undefined,
      });
    }

    const percentageScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const passed = percentageScore >= attempt.quiz.passingScore;

    await attempt.update({
      answers,
      score: totalScore,
      percentageScore,
      passed,
      completedAt: new Date(),
    });

    return {
      attempt: {
        id: attempt.id,
        score: totalScore,
        percentageScore,
        maxScore,
        passed,
        completedAt: attempt.completedAt,
        summary: {
          totalQuestions: attempt.quiz.questions.length,
          correctCount,
          incorrectCount,
          manualGradingCount,
        },
      },
      quiz: {
        id: attempt.quiz.id,
        title: attempt.quiz.title,
        description: attempt.quiz.description,
      },
      results,
    };
  }

  /**
   * Get student's quiz attempts
   */
  async getQuizAttempts(quizId, userId, userRole) {
    const quiz = await Quiz.findByPk(quizId, {
      include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'published'] }],
    });

    if (!quiz) {
      throw { status: 404, message: 'Không tìm thấy quiz' };
    }

    if (!quiz.course.published && userRole !== 'admin') {
      throw { status: 403, message: 'Khóa học chưa được xuất bản' };
    }

    if (userRole !== 'admin') {
      const enrollment = await Enrollment.findOne({
        where: { userId, courseId: quiz.courseId, status: 'enrolled' },
      });
      if (!enrollment) {
        throw { status: 403, message: 'Bạn chưa đăng ký khóa học này' };
      }
    }

    const attempts = await Attempt.findAll({
      where: { userId, quizId },
      include: [{ model: Quiz, as: 'quiz', attributes: ['id', 'title', 'maxScore', 'passingScore', 'timeLimit'] }],
      order: [['startedAt', 'DESC']],
    });

    return { attempts };
  }

  /**
   * Get attempt details
   */
  async getAttempt(attemptId, userId, userRole) {
    const attempt = await Attempt.findByPk(attemptId, {
      include: [
        {
          model: Quiz,
          as: 'quiz',
          attributes: ['id', 'title', 'description', 'showResults', 'maxScore', 'passingScore'],
          include: [{ model: Question, as: 'questions' }, { model: Course, as: 'course', attributes: ['id', 'title'] }],
        },
      ],
    });

    if (!attempt) {
      throw { status: 404, message: 'Không tìm thấy lần làm bài' };
    }

    if (attempt.userId !== userId && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền xem lần làm bài này' };
    }

    // Parse answers
    let userAnswers = attempt.answers || {};
    while (typeof userAnswers === 'string' && userAnswers.length > 0) {
      try {
        const parsed = JSON.parse(userAnswers);
        if (typeof parsed === 'object' || typeof parsed === 'string') {
          userAnswers = parsed;
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }

    // Hide details if needed
    let questions = attempt.quiz.questions;
    const hideDetails = !attempt.completedAt || (!attempt.quiz.showResults && userRole !== 'admin');

    if (hideDetails) {
      questions = questions.map((q) => ({ ...q.toJSON(), correctAnswer: undefined, explanation: undefined }));
    }

    // Map answers to results
    const results = questions.map((question) => {
      const qId = question.id || (question.toJSON ? question.toJSON().id : undefined);
      const userAnswer = typeof userAnswers === 'object' && userAnswers !== null ? userAnswers[qId] : undefined;
      let isCorrect = false;

      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        const userVal = userAnswer !== undefined && userAnswer !== null ? String(userAnswer).trim() : '';
        let correctVal = question.correctAnswer !== undefined && question.correctAnswer !== null ? String(question.correctAnswer).trim() : '';
        while (correctVal.startsWith('"') && correctVal.endsWith('"') && correctVal.length >= 2) {
          correctVal = correctVal.substring(1, correctVal.length - 1);
        }
        isCorrect = userVal === correctVal;
      } else if (question.type === 'short_answer') {
        const userStr = userAnswer ? String(userAnswer).toLowerCase().trim() : '';
        let correctStr = question.correctAnswer ? String(question.correctAnswer).toLowerCase().trim() : '';
        while (correctStr.startsWith('"') && correctStr.endsWith('"') && correctStr.length >= 2) {
          correctStr = correctStr.substring(1, correctStr.length - 1).trim();
        }
        isCorrect = userStr === correctStr;
      }

      return {
        questionId: question.id,
        userAnswer,
        correctAnswer: !hideDetails ? question.correctAnswer : undefined,
        isCorrect: attempt.completedAt ? isCorrect : undefined,
        pointsEarned: isCorrect ? question.points : 0,
        maxPoints: question.points,
        explanation: !hideDetails ? question.explanation : undefined,
      };
    });

    return {
      attempt: {
        id: attempt.id,
        score: attempt.score,
        percentageScore: attempt.percentageScore,
        passed: attempt.passed,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        answers: attempt.answers,
      },
      quiz: { ...attempt.quiz.toJSON(), questions },
      results,
    };
  }

  /**
   * Get quiz attempts for teacher
   */
  async getQuizAttemptsForTeacher(quizId, userId, userRole) {
    const quiz = await Quiz.findByPk(quizId, {
      include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'] }],
    });

    if (!quiz) {
      throw { status: 404, message: 'Không tìm thấy quiz' };
    }

    if (quiz.course.createdBy !== userId && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền xem kết quả quiz này' };
    }

    const attempts = await Attempt.findAll({
      where: { quizId },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Quiz, as: 'quiz', attributes: ['id', 'title', 'maxScore', 'passingScore'] },
      ],
      order: [['completedAt', 'DESC']],
    });

    // Calculate statistics
    const totalAttempts = attempts.length;
    const completedAttempts = attempts.filter((a) => a.completedAt);
    const completedCount = completedAttempts.length;
    const passedAttempts = completedAttempts.filter((a) => a.passed).length;
    const averageScore = completedCount > 0
      ? completedAttempts.reduce((sum, a) => sum + Number(a.percentageScore), 0) / completedCount
      : 0;

    // Calculate ranking
    const rankingMap = {};
    completedAttempts.forEach((a) => {
      const uId = a.userId;
      if (!rankingMap[uId] || Number(a.percentageScore) > Number(rankingMap[uId].highestScore)) {
        rankingMap[uId] = {
          userId: uId,
          userName: a.user?.name,
          userEmail: a.user?.email,
          highestScore: Number(a.percentageScore),
          passed: a.passed,
          completedAt: a.completedAt,
        };
      }
    });

    const ranking = Object.values(rankingMap)
      .sort((a, b) => b.highestScore - a.highestScore)
      .map((item, index) => ({ rank: index + 1, ...item }));

    return {
      attempts,
      ranking,
      statistics: {
        totalAttempts,
        completedAttempts: completedCount,
        passedAttempts,
        passRate: completedCount > 0 ? (passedAttempts / completedCount) * 100 : 0,
        averageScore: Math.round(averageScore * 100) / 100,
      },
    };
  }

  /**
   * Delete attempt
   */
  async deleteAttempt(attemptId, userId, userRole) {
    const attempt = await Attempt.findByPk(attemptId, {
      include: [{ model: Quiz, as: 'quiz', include: [{ model: Course, as: 'course' }] }],
    });

    if (!attempt) {
      throw { status: 404, message: 'Không tìm thấy bài nộp' };
    }

    const isOwner = attempt.quiz?.course?.createdBy === userId;
    if (!isOwner && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền xóa bài nộp này' };
    }

    await attempt.destroy();
    return { message: 'Đã xóa bài nộp thành công. Học viên có thể thực hiện lại bài thi.' };
  }

  /**
   * Get attempt for teacher
   */
  async getAttemptForTeacher(attemptId, userId, userRole) {
    const attempt = await Attempt.findByPk(attemptId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        {
          model: Quiz,
          as: 'quiz',
          attributes: ['id', 'title', 'description', 'showResults', 'maxScore', 'passingScore'],
          include: [
            { model: Question, as: 'questions' },
            { model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'] },
          ],
        },
      ],
    });

    if (!attempt) {
      throw { status: 404, message: 'Không tìm thấy lần làm bài' };
    }

    const isOwner = attempt.quiz?.course?.createdBy === userId;
    if (!isOwner && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền xem bài làm này' };
    }

    // Parse answers
    let userAnswers = attempt.answers || {};
    while (typeof userAnswers === 'string' && userAnswers.length > 0) {
      try {
        const parsed = JSON.parse(userAnswers);
        if (typeof parsed === 'object' || typeof parsed === 'string') {
          userAnswers = parsed;
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }

    // Teachers always see full details
    const questions = attempt.quiz.questions;

    const results = questions.map((question) => {
      const qId = question.id || (question.toJSON ? question.toJSON().id : undefined);
      const userAnswer = typeof userAnswers === 'object' && userAnswers !== null ? userAnswers[qId] : undefined;
      let isCorrect = false;

      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        const userVal = userAnswer !== undefined && userAnswer !== null ? String(userAnswer).trim() : '';
        let correctVal = question.correctAnswer !== undefined && question.correctAnswer !== null ? String(question.correctAnswer).trim() : '';
        while (correctVal.startsWith('"') && correctVal.endsWith('"') && correctVal.length >= 2) {
          correctVal = correctVal.substring(1, correctVal.length - 1);
        }
        isCorrect = userVal === correctVal;
      } else if (question.type === 'short_answer') {
        const userStr = userAnswer ? String(userAnswer).toLowerCase().trim() : '';
        let correctStr = question.correctAnswer ? String(question.correctAnswer).toLowerCase().trim() : '';
        while (correctStr.startsWith('"') && correctStr.endsWith('"') && correctStr.length >= 2) {
          correctStr = correctStr.substring(1, correctStr.length - 1).trim();
        }
        isCorrect = userStr === correctStr;
      }

      return {
        questionId: question.id,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect: attempt.completedAt ? isCorrect : undefined,
        pointsEarned: isCorrect ? question.points : 0,
        maxPoints: question.points,
        explanation: question.explanation,
      };
    });

    return {
      attempt: {
        id: attempt.id,
        user: attempt.user,
        score: attempt.score,
        percentageScore: attempt.percentageScore,
        passed: attempt.passed,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
      },
      quiz: { ...attempt.quiz.toJSON(), questions },
      results,
    };
  }
}

module.exports = new AttemptService();
