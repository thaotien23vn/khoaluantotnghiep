const db = require('../models');
const { Quiz, Question, Attempt, Course, User } = db.models;
const { validationResult } = require('express-validator');
const mediaService = require('../services/media.service');

/**
 * @desc    Create a new quiz for a course
 * @route   POST /api/teacher/courses/:courseId/quizzes
 * @access  Private (Teacher & Admin)
 */
exports.createQuiz = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    const { courseId } = req.params;
    const { title, description, maxScore, timeLimit, passingScore } = req.body;

    // Check if course exists and user owns it
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học'
      });
    }

    if (course.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền tạo quiz cho khóa học này'
      });
    }

    const quiz = await Quiz.create({
      courseId,
      title,
      description,
      maxScore: maxScore || 100,
      timeLimit: timeLimit || 60, // minutes
      passingScore: passingScore || 60,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Tạo quiz thành công',
      data: { quiz }
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Upload quiz media (image/audio/video)
 * @route   POST /api/teacher/media/quiz
 * @access  Private (Teacher & Admin)
 */
exports.uploadQuizMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn file'
      });
    }

    const uploadResult = await mediaService.uploadLectureMedia(req.file);

    return res.status(201).json({
      success: true,
      message: 'Upload thành công',
      data: {
        url: uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        publicId: uploadResult.publicId,
      },
    });
  } catch (error) {
    console.error('Upload quiz media error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all quizzes for a course
 * @route   GET /api/teacher/courses/:courseId/quizzes
 * @access  Private (Teacher & Admin of course)
 */
exports.getCourseQuizzes = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if course exists and user owns it
    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học'
      });
    }

    if (course.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem quiz của khóa học này'
      });
    }

    const quizzes = await Quiz.findAll({
      where: { courseId },
      include: [
        {
          model: Question,
          as: 'questions'
        }
      ],
      order: [[db.sequelize.col('Quiz.created_at'), 'DESC']]
    });

    res.json({
      success: true,
      data: { quizzes }
    });
  } catch (error) {
    console.error('Get course quizzes error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Get quiz details
 * @route   GET /api/teacher/quizzes/:quizId
 * @access  Private (Teacher & Admin)
 */
exports.getQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findByPk(quizId, {
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
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy quiz'
      });
    }

    // Check ownership
    if (quiz.course.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem quiz này'
      });
    }

    res.json({
      success: true,
      data: { quiz }
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Update quiz
 * @route   PUT /api/teacher/quizzes/:quizId
 * @access  Private (Teacher & Admin)
 */
exports.updateQuiz = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    const { quizId } = req.params;
    const { title, description, maxScore, timeLimit, passingScore } = req.body;

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

    // Check ownership
    if (quiz.course.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật quiz này'
      });
    }

    await quiz.update({
      title,
      description,
      maxScore,
      timeLimit,
      passingScore
    });

    res.json({
      success: true,
      message: 'Cập nhật quiz thành công',
      data: { quiz }
    });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Delete quiz
 * @route   DELETE /api/teacher/quizzes/:quizId
 * @access  Private (Teacher & Admin)
 */
exports.deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;

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

    // Check ownership
    if (quiz.course.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa quiz này'
      });
    }

    await quiz.destroy();

    res.json({
      success: true,
      message: 'Xóa quiz thành công'
    });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

// ========== QUESTION MANAGEMENT ==========

/**
 * @desc    Add question to quiz
 * @route   POST /api/teacher/quizzes/:quizId/questions
 * @access  Private (Teacher & Admin)
 */
exports.addQuestion = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    const { quizId } = req.params;
    const { type, content, options, correctAnswer, points, explanation } = req.body;

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
        message: 'Bạn không có quyền thêm câu hỏi cho quiz này'
      });
    }

    const question = await Question.create({
      quizId,
      type, // 'multiple_choice', 'true_false', 'short_answer', 'essay'
      content,
      options: options || null,
      correctAnswer,
      points: points || 1,
      explanation
    });

    res.status(201).json({
      success: true,
      message: 'Thêm câu hỏi thành công',
      data: { question }
    });
  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Update question
 * @route   PUT /api/teacher/questions/:questionId
 * @access  Private (Teacher & Admin)
 */
exports.updateQuestion = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array()
      });
    }

    const { questionId } = req.params;
    const { type, content, options, correctAnswer, points, explanation } = req.body;

    const question = await Question.findByPk(questionId, {
      include: [
        {
          model: Quiz,
          as: 'quiz',
          include: [
            {
              model: Course,
              as: 'course',
              attributes: ['id', 'title', 'createdBy']
            }
          ]
        }
      ]
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy câu hỏi'
      });
    }

    // Check ownership
    if (question.quiz.course.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật câu hỏi này'
      });
    }

    await question.update({
      type,
      content,
      options,
      correctAnswer,
      points,
      explanation
    });

    res.json({
      success: true,
      message: 'Cập nhật câu hỏi thành công',
      data: { question }
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};

/**
 * @desc    Delete question
 * @route   DELETE /api/teacher/questions/:questionId
 * @access  Private (Teacher & Admin)
 */
exports.deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await Question.findByPk(questionId, {
      include: [
        {
          model: Quiz,
          as: 'quiz',
          include: [
            {
              model: Course,
              as: 'course',
              attributes: ['id', 'title', 'createdBy']
            }
          ]
        }
      ]
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy câu hỏi'
      });
    }

    // Check ownership
    if (question.quiz.course.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa câu hỏi này'
      });
    }

    await question.destroy();

    res.json({
      success: true,
      message: 'Xóa câu hỏi thành công'
    });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message
    });
  }
};
