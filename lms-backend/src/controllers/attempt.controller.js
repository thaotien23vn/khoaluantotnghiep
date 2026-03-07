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

    // Check if quiz exists and is accessible
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
      ]
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
      return res.status(409).json({
        success: false,
        message: 'Bạn đang có một lần làm bài chưa hoàn thành',
        data: { attempt: activeAttempt }
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
    const results = [];

    for (const question of attempt.quiz.questions) {
      maxScore += question.points;
      const userAnswer = answers[question.id];
      let isCorrect = false;
      let pointsEarned = 0;

      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        isCorrect = JSON.stringify(userAnswer) === JSON.stringify(question.correctAnswer);
        pointsEarned = isCorrect ? question.points : 0;
      } else if (question.type === 'short_answer') {
        // Case-insensitive comparison for short answers
        isCorrect = userAnswer && userAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
        pointsEarned = isCorrect ? question.points : 0;
      } else if (question.type === 'essay') {
        // Essay questions need manual grading
        pointsEarned = 0; // Will be graded by teacher
      }

      totalScore += pointsEarned;

      results.push({
        questionId: question.id,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        pointsEarned,
        maxPoints: question.points,
        explanation: question.explanation
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
          completedAt: attempt.completedAt
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

    // If attempt is not completed, don't show correct answers
    let questions = attempt.quiz.questions;
    if (!attempt.completedAt) {
      questions = questions.map(q => ({
        ...q.toJSON(),
        correctAnswer: undefined,
        explanation: undefined
      }));
    }

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
        }
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
    const completedAttempts = attempts.filter(a => a.completedAt).length;
    const passedAttempts = attempts.filter(a => a.passed).length;
    const averageScore = completedAttempts > 0 
      ? attempts.filter(a => a.completedAt).reduce((sum, a) => sum + a.percentageScore, 0) / completedAttempts 
      : 0;

    res.json({
      success: true,
      data: {
        attempts,
        statistics: {
          totalAttempts,
          completedAttempts,
          passedAttempts,
          passRate: completedAttempts > 0 ? (passedAttempts / completedAttempts) * 100 : 0,
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
