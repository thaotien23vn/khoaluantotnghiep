const db = require('../models');
const { Attempt, Quiz, Question, Course, User, Enrollment } = db.models;
const { validationResult } = require('express-validator');
 const notificationController = require('./notification.controller');

/**
 * @desc    Start a quiz attempt
 * @route   POST /api/student/quizzes/:quizId/start
 * @access  Private (Student & Admin)
 */
exports.startAttempt = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findByPk(quizId, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'published']
        },
        {
          model: Question,
          as: 'questions',
          attributes: ['id', 'type', 'content', 'options', 'points']
        }
      ],
      attributes: ['id', 'title', 'description', 'timeLimit', 'maxScore', 'startTime', 'endTime', 'courseId']
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quiz'
      });
    }

    if (!quiz.course.published) {
      return res.status(400).json({
        success: false,
        message: 'Khóa học chưa được xuất bản'
      });
    }

    // Check scheduled time
    const now = new Date();
    if (quiz.startTime && now < new Date(quiz.startTime)) {
      return res.status(403).json({
        success: false,
        message: 'Bài thi chưa đến thời gian bắt đầu',
        data: { startTime: quiz.startTime }
      });
    }

    if (quiz.endTime && now > new Date(quiz.endTime)) {
      return res.status(403).json({
        success: false,
        message: 'Bài thi đã hết thời gian thực hiện',
        data: { endTime: quiz.endTime }
      });
    }

    // Check if student is enrolled in the course
    const enrollment = await Enrollment.findOne({
      where: {
        userId: req.user.id,
        courseId: quiz.courseId,
        status: 'enrolled'
      }
    });

    if (!enrollment && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn chưa đăng ký khóa học này'
      });
    }

    // Check if there's already an active attempt
    const activeAttempt = await Attempt.findOne({
      where: {
        userId: req.user.id,
        quizId,
        completedAt: null
      }
    });

    if (activeAttempt) {
      return res.status(200).json({
        success: true,
        message: 'Bạn đang tiếp tục bài làm chưa hoàn thành',
        data: {
          attempt: {
            id: activeAttempt.id,
            quizId: activeAttempt.quizId,
            startedAt: activeAttempt.startedAt,
            timeLimit: quiz.timeLimit
          },
          quiz: {
            id: quiz.id,
            title: quiz.title,
            description: quiz.description,
            timeLimit: quiz.timeLimit,
            maxScore: quiz.maxScore,
            questions: quiz.questions
          }
        }
      });
    }

    // Create new attempt
    const attempt = await Attempt.create({
      userId: req.user.id,
      quizId,
      answers: {},
      score: 0,
      startedAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Bắt đầu làm bài thành công',
      data: {
        attempt: {
          id: attempt.id,
          quizId: attempt.quizId,
          startedAt: attempt.startedAt,
          timeLimit: quiz.timeLimit
        },
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          timeLimit: quiz.timeLimit,
          maxScore: quiz.maxScore,
          questions: quiz.questions
        }
      }
    });
  } catch (error) {
    console.error('Start attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Submit quiz attempt
 * @route   POST /api/student/attempts/:attemptId/submit
 * @access  Private (Student & Admin)
 */
exports.submitAttempt = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    const { attemptId } = req.params;
    const { answers } = req.body;

    const attempt = await Attempt.findByPk(attemptId, {
      include: [
        {
          model: Quiz,
          as: 'quiz',
          attributes: ['id', 'title', 'description', 'passingScore', 'showResults'],
          include: [
            {
              model: Question,
              as: 'questions'
            }
          ]
        }
      ]
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lần làm bài'
      });
    }

    // Check ownership
    if (attempt.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền nộp bài này'
      });
    }

    if (attempt.completedAt) {
      return res.status(400).json({
        success: false,
        message: 'Lần làm bài này đã được nộp'
      });
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
        // So sánh linh hoạt hơn (ép kiểu về string và trim để tránh lỗi format)
        const userVal = userAnswer !== undefined && userAnswer !== null ? String(userAnswer).trim() : '';
        let correctVal = question.correctAnswer !== undefined && question.correctAnswer !== null ? String(question.correctAnswer).trim() : '';
        
        // Xử lý triệt để trường hợp đáp án bị bao bởi dấu ngoặc kép (thường gặp khi lưu JSON)
        while (correctVal.startsWith('"') && correctVal.endsWith('"') && correctVal.length >= 2) {
          correctVal = correctVal.substring(1, correctVal.length - 1);
        }
        
        isCorrect = userVal === correctVal;
        pointsEarned = isCorrect ? question.points : 0;
      } else if (question.type === 'short_answer') {
        // Case-insensitive comparison for short answers
        const userStr = userAnswer ? String(userAnswer).toLowerCase().trim() : '';
        let correctStr = question.correctAnswer ? String(question.correctAnswer).toLowerCase().trim() : '';
        
        // Xử lý dấu ngoặc kép cho short_answer
        while (correctStr.startsWith('"') && correctStr.endsWith('"') && correctStr.length >= 2) {
          correctStr = correctStr.substring(1, correctStr.length - 1).trim();
        }
        
        isCorrect = userStr === correctStr;
        pointsEarned = isCorrect ? question.points : 0;
      } else if (question.type === 'essay') {
        // Essay questions need manual grading
        pointsEarned = 0; // Will be graded by teacher
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
        explanation: attempt.quiz.showResults ? question.explanation : undefined
      });
    }

    // Calculate percentage score
    const percentageScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const passed = percentageScore >= attempt.quiz.passingScore;

    // Update attempt
    await attempt.update({
      answers,
      score: totalScore,
      percentageScore,
      passed,
      completedAt: new Date()
    });

     try {
       await notificationController.createQuizCompletionNotification(
         attempt.userId,
         attempt.quizId,
         totalScore,
         passed,
       );
     } catch (notifyErr) {
       console.error('Create quiz completion notification (silent) error:', notifyErr);
     }

    res.json({
      success: true,
      message: 'Nộp bài thành công',
      data: {
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
            manualGradingCount
          }
        },
        quiz: {
          id: attempt.quiz.id,
          title: attempt.quiz.title,
          description: attempt.quiz.description
        },
        results
      }
    });
  } catch (error) {
    console.error('Submit attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Get student's attempts for a quiz
 * @route   GET /api/student/quizzes/:quizId/attempts
 * @access  Private (Student & Admin)
 */
exports.getQuizAttempts = async (req, res) => {
  try {
    const { quizId } = req.params;

    // Check if quiz exists and student has access
    const quiz = await Quiz.findByPk(quizId, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'published']
        }
      ]
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quiz'
      });
    }

    if (!quiz.course.published && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Khóa học chưa được xuất bản'
      });
    }

    // Check enrollment
    if (req.user.role !== 'admin') {
      const enrollment = await Enrollment.findOne({
        where: {
          userId: req.user.id,
          courseId: quiz.courseId,
          status: 'enrolled'
        }
      });

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'Bạn chưa đăng ký khóa học này'
        });
      }
    }

    const attempts = await Attempt.findAll({
      where: {
        userId: req.user.id,
        quizId
      },
      include: [
        {
          model: Quiz,
          as: 'quiz',
          attributes: ['id', 'title', 'maxScore', 'passingScore', 'timeLimit']
        }
      ],
      order: [['startedAt', 'DESC']]
    });

    res.json({
      success: true,
      data: { attempts }
    });
  } catch (error) {
    console.error('Get quiz attempts error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Get attempt details
 * @route   GET /api/student/attempts/:attemptId
 * @access  Private (Student & Admin)
 */
exports.getAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await Attempt.findByPk(attemptId, {
      include: [
        {
          model: Quiz,
          as: 'quiz',
          attributes: ['id', 'title', 'description', 'showResults', 'maxScore', 'passingScore'],
          include: [
            {
              model: Question,
              as: 'questions'
            },
            {
              model: Course,
              as: 'course',
              attributes: ['id', 'title']
            }
          ]
        }
      ]
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lần làm bài'
      });
    }

    // Check ownership
    if (attempt.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem lần làm bài này'
      });
    }

    // Parse answers if stored as string (handle double-stringified cases)
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

    // Hide details if teacher disabled results view
    let questions = attempt.quiz.questions;
    const hideDetails = !attempt.completedAt || (!attempt.quiz.showResults && req.user.role !== 'admin');
    
    if (hideDetails) {
      questions = questions.map(q => ({
        ...q.toJSON(),
        correctAnswer: undefined,
        explanation: undefined
      }));
    }

    // Map answers to results array for easier display
    const results = questions.map(question => {
      const qId = question.id || (question.toJSON ? question.toJSON().id : undefined);
      const userAnswer = (typeof userAnswers === 'object' && userAnswers !== null) ? userAnswers[qId] : undefined;
      let isCorrect = false;

      // Logic so sánh tương tự submitAttempt
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
        explanation: !hideDetails ? question.explanation : undefined
      };
    });

    res.json({
      success: true,
      data: {
        attempt: {
          id: attempt.id,
          score: attempt.score,
          percentageScore: attempt.percentageScore,
          passed: attempt.passed,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
          answers: attempt.answers
        },
        quiz: {
          ...attempt.quiz.toJSON(),
          questions
        },
        results
      }
    });
  } catch (error) {
    console.error('Get attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Get all attempts for a quiz (Teacher/Admin)
 * @route   GET /api/teacher/quizzes/:quizId/attempts
 * @access  Private (Teacher & Admin)
 */
exports.getQuizAttemptsForTeacher = async (req, res) => {
  try {
    const { quizId } = req.params;

    // Check quiz ownership
    const quiz = await Quiz.findByPk(quizId, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'createdBy']
        }
      ]
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quiz'
      });
    }

    if (quiz.course.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem kết quả quiz này'
      });
    }

    const attempts = await Attempt.findAll({
      where: { quizId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Quiz,
          as: 'quiz',
          attributes: ['id', 'title', 'maxScore', 'passingScore']
        }
      ],
      order: [['completedAt', 'DESC']]
    });

    // Calculate statistics
    const totalAttempts = attempts.length;
    const completedAttempts = attempts.filter(a => a.completedAt);
    const completedCount = completedAttempts.length;
    const passedAttempts = completedAttempts.filter(a => a.passed).length;
    const averageScore = completedCount > 0 
      ? completedAttempts.reduce((sum, a) => sum + Number(a.percentageScore), 0) / completedCount 
      : 0;

    // Calculate ranking (Highest score per student)
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
          completedAt: a.completedAt
        };
      }
    });

    const ranking = Object.values(rankingMap)
      .sort((a, b) => b.highestScore - a.highestScore)
      .map((item, index) => ({
        rank: index + 1,
        ...item
      }));

    res.json({
      success: true,
      data: {
        attempts,
        ranking,
        statistics: {
          totalAttempts,
          completedAttempts: completedCount,
          passedAttempts,
          passRate: completedCount > 0 ? (passedAttempts / completedCount) * 100 : 0,
          averageScore: Math.round(averageScore * 100) / 100
        }
      }
    });
  } catch (error) {
    console.error('Get quiz attempts for teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Delete/Reset student attempt (Allow retake)
 * @route   DELETE /api/teacher/attempts/:attemptId
 * @access  Private (Teacher & Admin)
 */
exports.deleteAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await Attempt.findByPk(attemptId, {
      include: [
        {
          model: Quiz,
          as: 'quiz',
          include: [{ model: Course, as: 'course' }]
        }
      ]
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài nộp'
      });
    }

    // Check ownership (Teacher of the course or Admin)
    const isOwner = attempt.quiz?.course?.createdBy === req.user.id;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa bài nộp này'
      });
    }

    await attempt.destroy();

    res.json({
      success: true,
      message: 'Đã xóa bài nộp thành công. Học viên có thể thực hiện lại bài thi.'
    });
  } catch (error) {
    console.error('Delete attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Get specific attempt detail for teacher
 * @route   GET /api/teacher/attempts/:attemptId
 * @access  Private (Teacher & Admin)
 */
exports.getAttemptForTeacher = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await Attempt.findByPk(attemptId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Quiz,
          as: 'quiz',
          attributes: ['id', 'title', 'description', 'showResults', 'maxScore', 'passingScore'],
          include: [
            {
              model: Question,
              as: 'questions'
            },
            {
              model: Course,
              as: 'course',
              attributes: ['id', 'title', 'createdBy']
            }
          ]
        }
      ]
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lần làm bài'
      });
    }

    // Check ownership (Teacher of the course or Admin)
    const isOwner = attempt.quiz?.course?.createdBy === req.user.id;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem bài làm này'
      });
    }

    // Parse answers if stored as string (handle double-stringified cases)
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

    // Teachers ALWAYS see full details
    let questions = attempt.quiz.questions;
    
    // Map answers to results array for easier display
    const results = questions.map(question => {
      const qId = question.id || (question.toJSON ? question.toJSON().id : undefined);
      const userAnswer = (typeof userAnswers === 'object' && userAnswers !== null) ? userAnswers[qId] : undefined;
      let isCorrect = false;

      // Comparison logic
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
        explanation: question.explanation
      };
    });

    res.json({
      success: true,
      data: {
        attempt: {
          id: attempt.id,
          user: attempt.user,
          score: attempt.score,
          percentageScore: attempt.percentageScore,
          passed: attempt.passed,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
        },
        quiz: {
          ...attempt.quiz.toJSON(),
          questions
        },
        results
      }
    });
  } catch (error) {
    console.error('Get teacher attempt detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};
