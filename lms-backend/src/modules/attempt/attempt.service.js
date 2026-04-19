const { Op } = require('sequelize');
const db = require('../../models');
const EnrollmentAccess = require('../enrollment/enrollment.access');
const { Attempt, Quiz, Question, Course, User, Enrollment } = db.models;

/**
 * Grade a single answer and return { isCorrect, pointsEarned }
 */
function gradeAnswer(question, userAnswer) {
  if (question.type === 'multiple_choice' || question.type === 'true_false') {
    const userVal = userAnswer !== undefined && userAnswer !== null ? String(userAnswer).trim() : '';
    let correctVal = question.correctAnswer !== undefined && question.correctAnswer !== null
      ? String(question.correctAnswer).trim() : '';
    // Strip wrapping quotes added during serialization
    while (correctVal.startsWith('"') && correctVal.endsWith('"') && correctVal.length >= 2) {
      correctVal = correctVal.substring(1, correctVal.length - 1);
    }
    const isCorrect = userVal === correctVal;
    return { isCorrect, pointsEarned: isCorrect ? question.points : 0 };
  }

  if (question.type === 'short_answer') {
    // FIXED: Loại bỏ ký tự đặc biệt, dấu câu và đưa về lowercase, chuẩn hóa khoảng trắng
    const sanitizeStr = (str) => {
      if (!str) return '';
      let s = String(str).toLowerCase();
      // Bỏ ngoặc, dấu câu dư thừa
      while (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
        s = s.substring(1, s.length - 1);
      }
      return s.replace(/[.,/#!$%^&*;:{}=_`~()]/g, "").replace(/\s{2,}/g, " ").trim();
    };

    const userStr = sanitizeStr(userAnswer);
    const correctStr = sanitizeStr(question.correctAnswer);
    const isCorrect = userStr === correctStr && correctStr !== '';
    return { isCorrect, pointsEarned: isCorrect ? question.points : 0 };
  }

  if (question.type === 'essay') {
    return { isCorrect: false, pointsEarned: 0, isManual: true };
  }

  return { isCorrect: false, pointsEarned: 0 };
}

/**
 * Auto-submit an expired attempt (when time limit exceeded)
 */
async function autoSubmitExpiredAttempt(attempt, quiz) {
  const answers = attempt.answers || {};
  const questions = quiz.questions || [];

  let totalScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let manualCount = 0;

  for (const question of questions) {
    maxScore += question.points;
    const userAnswer = answers[question.id];
    const { isCorrect, pointsEarned, isManual } = gradeAnswer(question, userAnswer);
    if (isManual) { manualCount++; } else if (isCorrect) { correctCount++; } else { incorrectCount++; }
    totalScore += pointsEarned;
  }

  // 🛡️ FIX: Calculate percentage based on actual sum of question points
  const effectiveMaxScore = maxScore > 0 ? maxScore : 100;
  const percentageScore = effectiveMaxScore > 0 ? (totalScore / effectiveMaxScore) * 100 : 0;
  let passed = percentageScore >= quiz.passingScore;
  if (!passed && manualCount > 0) passed = null;

  // FIXED: Gán thời gian nộp bài đúng bằng thời gian lúc hết giờ, không dùng thời điểm hệ thống claim lại
  let actualCompletedAt = new Date();
  if (quiz.timeLimit && attempt.startedAt) {
    const expiredTime = new Date(new Date(attempt.startedAt).getTime() + (quiz.timeLimit * 60000));
    actualCompletedAt = expiredTime < new Date() ? expiredTime : new Date();
  }

  await attempt.update({
    score: totalScore,
    percentageScore,
    passed,
    completedAt: actualCompletedAt,
  });

  return attempt;
}

/**
 * Attempt Service - Business logic for quiz attempts
 */
class AttemptService {
  /**
   * Start a quiz attempt — ENHANCED: time enforcement + maxAttempts check
   */
  async startAttempt(quizId, userId, userRole) {
    const quiz = await Quiz.findByPk(quizId, {
      include: [
        { model: Course, as: 'course', attributes: ['id', 'title', 'published'] },
        { model: Question, as: 'questions', attributes: ['id', 'type', 'content', 'options', 'points'] },
      ],
      attributes: ['id', 'title', 'description', 'timeLimit', 'maxScore', 'passingScore', 'maxAttempts', 'startTime', 'endTime', 'courseId'],
    });

    if (!quiz) throw { status: 404, message: 'Không tìm thấy quiz' };
    if (!quiz.course.published) throw { status: 400, message: 'Khóa học chưa được xuất bản' };

    const now = new Date();
    if (quiz.startTime && now < new Date(quiz.startTime)) {
      throw { status: 403, message: 'Bài thi chưa đến thời gian bắt đầu', data: { startTime: quiz.startTime } };
    }
    if (quiz.endTime && now > new Date(quiz.endTime)) {
      throw { status: 403, message: 'Bài thi đã hết thời gian thực hiện', data: { endTime: quiz.endTime } };
    }

    // Check enrollment using unified access helper
    if (userRole !== 'admin') {
      const access = await EnrollmentAccess.checkAccess(userId, quiz.courseId);
      if (!access.hasAccess) {
        throw { status: 403, message: access.message || 'Bạn chưa đăng ký hoặc ghi danh đã hết hạn' };
      }
    }

    // Check for active (in-progress) attempt
    const activeAttempt = await Attempt.findOne({
      where: { userId, quizId, completedAt: null },
    });

    if (activeAttempt) {
      // ENHANCED: Check if time limit has been exceeded for the active attempt
      if (quiz.timeLimit && quiz.timeLimit > 0) {
        const elapsedMinutes = (now - new Date(activeAttempt.startedAt)) / 60000;
        if (elapsedMinutes > quiz.timeLimit) {
          // Auto-submit the expired attempt
          const quizWithQuestions = await Quiz.findByPk(quizId, {
            include: [{ model: Question, as: 'questions' }],
            attributes: ['id', 'passingScore', 'timeLimit'],
          });
          await autoSubmitExpiredAttempt(activeAttempt, quizWithQuestions);
          // Fall through to create a new attempt
        } else {
          // Return existing active attempt
          return {
            attempt: {
              id: activeAttempt.id,
              quizId: activeAttempt.quizId,
              startedAt: activeAttempt.startedAt,
              timeLimit: quiz.timeLimit,
              remainingSeconds: Math.max(0, Math.round((quiz.timeLimit * 60) - (elapsedMinutes * 60))),
            },
            quiz: {
              id: quiz.id,
              title: quiz.title,
              description: quiz.description,
              timeLimit: quiz.timeLimit,
              maxScore: quiz.maxScore,
              questions: quiz.questions,
            },
            resumed: true,
          };
        }
      } else {
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
          resumed: true,
        };
      }
    }

    // ADDED: Enforce maxAttempts — count completed attempts before creating a new one
    if (quiz.maxAttempts && quiz.maxAttempts > 0) {
      const completedAttemptCount = await Attempt.count({
        where: { userId, quizId, completedAt: { [db.Sequelize.Op.ne]: null } },
      });
      if (completedAttemptCount >= quiz.maxAttempts) {
        throw {
          status: 403,
          message: `Bạn đã đạt tối đa ${quiz.maxAttempts} lần làm bài cho quiz này`,
          data: { maxAttempts: quiz.maxAttempts, usedAttempts: completedAttemptCount },
        };
      }
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
        remainingSeconds: quiz.timeLimit ? quiz.timeLimit * 60 : null,
      },
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        timeLimit: quiz.timeLimit,
        maxScore: quiz.maxScore,
        questions: quiz.questions,
      },
      resumed: false,
    };
  }

  /**
   * Submit quiz attempt — uses shared gradeAnswer helper
   * 🔒 FIXED: Added transaction with row-level lock to prevent race condition
   */
  async submitAttempt(attemptId, userId, userRole, answers) {
    // 🛡️ FIX: Use transaction with row-level lock to prevent double submission
    return await db.sequelize.transaction(async (t) => {
      // 🛡️ FIX: Re-fetch and lock attempt with status check
      const attempt = await Attempt.findOne({
        where: { 
          id: attemptId, 
          userId: Number(userId),
          completedAt: null  // Chỉ lấy nếu chưa completed
        },
        include: [{
          model: Quiz,
          as: 'quiz',
          attributes: ['id', 'title', 'description', 'passingScore', 'showResults', 'timeLimit', 'courseId'],
          include: [{ model: Question, as: 'questions' }],
        }],
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!attempt) {
        // Check if already submitted by another thread
        const existingAttempt = await Attempt.findByPk(attemptId, {
          include: [{
            model: Quiz,
            as: 'quiz',
            attributes: ['id', 'title', 'description', 'passingScore', 'showResults', 'timeLimit', 'courseId'],
            include: [{ model: Question, as: 'questions' }],
          }],
        });
        
        if (!existingAttempt) {
          throw { status: 404, message: 'Không tìm thấy lần làm bài' };
        }
        
        // 🛡️ Fix: Use Number() for consistent comparison
        if (Number(existingAttempt.userId) !== Number(userId) && userRole !== 'admin') {
          throw { status: 403, message: 'Bạn không có quyền nộp bài này' };
        }
        
        if (existingAttempt.completedAt) {
          throw { status: 409, message: 'Lần làm bài này đã được nộp' };
        }
        
        // Trả về attempt nếu đã được xử lý
        return {
          attempt: {
            id: existingAttempt.id,
            score: existingAttempt.score,
            percentageScore: existingAttempt.percentageScore,
            passed: existingAttempt.passed,
            completedAt: existingAttempt.completedAt,
            summary: { totalQuestions: existingAttempt.quiz.questions.length, correctCount: 0, incorrectCount: 0, manualGradingCount: 0 },
          },
          quiz: { id: existingAttempt.quiz.id, title: existingAttempt.quiz.title },
          results: [],
          alreadySubmitted: true,
        };
      }

      // Admin override - if admin is submitting for another user, check ownership
      if (Number(attempt.userId) !== Number(userId) && userRole !== 'admin') {
        throw { status: 403, message: 'Bạn không có quyền nộp bài này' };
      }

    // Check time limit — reject if too much time has passed (with 30s grace)
    if (attempt.quiz.timeLimit) {
      const elapsedMinutes = (new Date() - new Date(attempt.startedAt)) / 60000;
      const gracePeriodMinutes = 0.5; // 30 second grace
      if (elapsedMinutes > attempt.quiz.timeLimit + gracePeriodMinutes) {
        // Auto-grade with existing answers (time expired)
        await autoSubmitExpiredAttempt(attempt, attempt.quiz);

        try {
          const progressService = require('../progress/progress.service');
          await progressService.getStudentCourseProgress(userId, attempt.quiz.courseId);
        } catch (e) {
          console.error('[Quiz] Lỗi đồng bộ tiến độ sau khi tự động nộp bài:', e);
        }

        return {
          attempt: {
            id: attempt.id,
            score: attempt.score,
            percentageScore: attempt.percentageScore,
            passed: attempt.passed,
            completedAt: attempt.completedAt,
            timedOut: true,
            summary: { totalQuestions: attempt.quiz.questions.length, correctCount: 0, incorrectCount: 0, manualGradingCount: attempt.quiz.questions.filter(q => q.type === 'essay').length },
          },
          quiz: { id: attempt.quiz.id, title: attempt.quiz.title },
          results: [],
          message: 'Bài thi đã hết thời gian, đã tự động nộp với đáp án hiện tại',
        };
      }
    }

      let totalScore = 0;
      let maxScore = 0;
      let correctCount = 0;
      let incorrectCount = 0;
      let manualGradingCount = 0;
      const results = [];

      for (const question of attempt.quiz.questions) {
        maxScore += question.points;
        const userAnswer = answers[question.id];
        const { isCorrect, pointsEarned, isManual } = gradeAnswer(question, userAnswer);

        if (isManual) { manualGradingCount++; }
        else if (isCorrect) { correctCount++; }
        else { incorrectCount++; }

        totalScore += pointsEarned;

        results.push({
          questionId: question.id,
          userAnswer,
          correctAnswer: attempt.quiz.showResults ? question.correctAnswer : undefined,
          isCorrect: isManual ? undefined : isCorrect,
          pointsEarned,
          maxPoints: question.points,
          explanation: attempt.quiz.showResults ? question.explanation : undefined,
        });
      }

      // 🛡️ FIX: Calculate percentage based on actual sum of question points
      const effectiveMaxScore = maxScore > 0 ? maxScore : 100;
      const percentageScore = effectiveMaxScore > 0 ? (totalScore / effectiveMaxScore) * 100 : 0;
      let passed = percentageScore >= attempt.quiz.passingScore;
      if (!passed && manualGradingCount > 0) passed = null;

      // 🛡️ FIX: Update within transaction
      await attempt.update({ 
        answers, 
        score: totalScore, 
        percentageScore, 
        passed, 
        completedAt: new Date() 
      }, { transaction: t });

      return {
        attemptId: attempt.id,
        score: totalScore,
        percentageScore,
        maxScore,
        passed,
        completedAt: new Date(),
        summary: { totalQuestions: attempt.quiz.questions.length, correctCount, incorrectCount, manualGradingCount },
        quizId: attempt.quiz.id,
        quizTitle: attempt.quiz.title,
        courseId: attempt.quiz.courseId,
        results,
      };
    }).then(async (result) => {
      // Non-critical: sync progress outside transaction
      try {
        const progressService = require('../progress/progress.service');
        await progressService.getStudentCourseProgress(userId, result.courseId);
      } catch (e) {
        console.error('[Quiz] Lỗi đồng bộ tiến độ khóa học sau khi nộp bài:', e);
      }

      return {
        attempt: {
          id: result.attemptId,
          score: result.score,
          percentageScore: result.percentageScore,
          maxScore: result.maxScore,
          passed: result.passed,
          completedAt: result.completedAt,
          summary: result.summary,
        },
        quiz: { id: result.quizId, title: result.quizTitle },
        results: result.results,
      };
    });
  }

  /**
   * Get student's quiz attempts
   */
  async getQuizAttempts(quizId, userId, userRole) {
    const quiz = await Quiz.findByPk(quizId, {
      include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'published'] }],
    });

    if (!quiz) throw { status: 404, message: 'Không tìm thấy quiz' };
    if (!quiz.course.published && userRole !== 'admin') {
      throw { status: 403, message: 'Khóa học chưa được xuất bản' };
    }

    if (userRole !== 'admin') {
      const access = await EnrollmentAccess.checkAccess(userId, quiz.courseId);
      if (!access.hasAccess) {
        throw { status: 403, message: access.message || 'Bạn chưa đăng ký hoặc ghi danh đã hết hạn' };
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
   * Get attempt details — uses shared gradeAnswer helper
   */
  async getAttempt(attemptId, userId, userRole) {
    const attempt = await Attempt.findByPk(attemptId, {
      include: [{
        model: Quiz,
        as: 'quiz',
        attributes: ['id', 'title', 'description', 'showResults', 'maxScore', 'passingScore'],
        include: [{ model: Question, as: 'questions' }, { model: Course, as: 'course', attributes: ['id', 'title'] }],
      }],
    });

    if (!attempt) throw { status: 404, message: 'Không tìm thấy lần làm bài' };
    // 🛡️ Fix: Use Number() for consistent comparison
    if (Number(attempt.userId) !== Number(userId) && userRole !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền xem lần làm bài này' };
    }

    let userAnswers = attempt.answers || {};
    while (typeof userAnswers === 'string' && userAnswers.length > 0) {
      try { userAnswers = JSON.parse(userAnswers); } catch (e) { break; }
    }

    const hideDetails = !attempt.completedAt || (!attempt.quiz.showResults && userRole !== 'admin');
    let questions = attempt.quiz.questions;
    if (hideDetails) {
      questions = questions.map(q => ({ ...q.toJSON(), correctAnswer: undefined, explanation: undefined }));
    }

    const results = questions.map(question => {
      const qId = question.id || question.toJSON?.().id;
      const userAnswer = typeof userAnswers === 'object' && userAnswers !== null ? userAnswers[qId] : undefined;
      const { isCorrect, pointsEarned } = gradeAnswer(question, userAnswer);
      return {
        questionId: question.id,
        userAnswer,
        correctAnswer: !hideDetails ? question.correctAnswer : undefined,
        isCorrect: attempt.completedAt ? isCorrect : undefined,
        pointsEarned: attempt.completedAt ? pointsEarned : undefined,
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
        summary: attempt.completedAt ? { manualGradingCount: questions.filter(q => q.type === 'essay').length } : undefined,
      },
      quiz: { ...attempt.quiz.toJSON(), questions },
      results,
    };
  }

  /**
   * Get quiz attempts for teacher view (with statistics)
   */
  async getQuizAttemptsForTeacher(quizId, userId, userRole) {
    const quiz = await Quiz.findByPk(quizId, {
      include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'createdBy'] }],
    });

    if (!quiz) throw { status: 404, message: 'Không tìm thấy quiz' };
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

    const completedAttempts = attempts.filter(a => a.completedAt);
    const completedCount = completedAttempts.length;
    const passedAttempts = completedAttempts.filter(a => a.passed).length;
    const averageScore = completedCount > 0
      ? completedAttempts.reduce((sum, a) => sum + Number(a.percentageScore), 0) / completedCount
      : 0;

    const rankingMap = {};
    completedAttempts.forEach(a => {
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
        totalAttempts: attempts.length,
        completedAttempts: completedCount,
        passedAttempts,
        passRate: completedCount > 0 ? (passedAttempts / completedCount) * 100 : 0,
        averageScore: Math.round(averageScore * 100) / 100,
      },
    };
  }

  /**
   * Get attempt for teacher view (full details)
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

    if (!attempt) throw { status: 404, message: 'Không tìm thấy lần làm bài' };
    // 🛡️ Fix: Use Number() for consistent comparison
    const isOwner = Number(attempt.quiz?.course?.createdBy) === Number(userId);
    if (!isOwner && userRole !== 'admin') throw { status: 403, message: 'Bạn không có quyền xem bài làm này' };

    let userAnswers = attempt.answers || {};
    while (typeof userAnswers === 'string' && userAnswers.length > 0) {
      try { userAnswers = JSON.parse(userAnswers); } catch (e) { break; }
    }

    const questions = attempt.quiz.questions;
    const results = questions.map(question => {
      const qId = question.id || question.toJSON?.().id;
      const userAnswer = typeof userAnswers === 'object' && userAnswers !== null ? userAnswers[qId] : undefined;
      const { isCorrect, pointsEarned } = gradeAnswer(question, userAnswer);
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

  /**
   * Delete/reset student attempt
   */
  async deleteAttempt(attemptId, userId, userRole) {
    const attempt = await Attempt.findByPk(attemptId, {
      include: [{ model: Quiz, as: 'quiz', include: [{ model: Course, as: 'course' }] }],
    });
    if (!attempt) throw { status: 404, message: 'Không tìm thấy bài nộp' };
    // 🛡️ Fix: Use Number() for consistent comparison
    const isOwner = Number(attempt.quiz?.course?.createdBy) === Number(userId);
    if (!isOwner && userRole !== 'admin') throw { status: 403, message: 'Bạn không có quyền xóa bài nộp này' };
    await attempt.destroy();
    return { message: 'Đã xóa bài nộp thành công. Học viên có thể thực hiện lại bài thi.' };
  }
}

module.exports = new AttemptService();
