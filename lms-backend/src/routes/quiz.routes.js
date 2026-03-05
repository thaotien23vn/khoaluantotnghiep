const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const quizController = require('../controllers/quiz.controller');
const attemptController = require('../controllers/attempt.controller');
const { body } = require('express-validator');
const uploadMedia = require('../middlewares/uploadMedia');

const router = express.Router();

// Quiz validation rules
const quizValidation = [
  body('title').notEmpty().withMessage('Tiêu đề quiz không được để trống'),
  body('maxScore').optional().isNumeric().withMessage('Điểm tối đa phải là số'),
  body('timeLimit').optional().isNumeric().withMessage('Thời gian làm bài phải là số'),
  body('passingScore').optional().isNumeric().withMessage('Điểm đạt phải là số')
];

// Question validation rules are now inline in routes

// ========== TEACHER/ADMIN ROUTES ==========

/**
 * @route   POST /api/teacher/media/quiz
 * @desc    Upload quiz media (image/audio/video)
 * @access  Private (Teacher & Admin)
 */
router.post(
  '/media/quiz',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  uploadMedia.single('file'),
  quizController.uploadQuizMedia
);

/**
 * @route   POST /api/teacher/courses/:courseId/quizzes
 * @desc    Create a new quiz for a course
 * @access  Private (Teacher & Admin)
 */
router.post(
  '/courses/:courseId/quizzes',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  quizValidation,
  quizController.createQuiz
);

/**
 * @route   GET /api/teacher/courses/:courseId/quizzes
 * @desc    Get all quizzes for a course
 * @access  Private (Teacher & Admin)
 */
router.get(
  '/courses/:courseId/quizzes',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  quizController.getCourseQuizzes
);

/**
 * @route   GET /api/teacher/quizzes/:quizId
 * @desc    Get quiz details
 * @access  Private (Teacher & Admin)
 */
router.get(
  '/quizzes/:quizId',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  quizController.getQuiz
);

/**
 * @route   PUT /api/teacher/quizzes/:quizId
 * @desc    Update quiz
 * @access  Private (Teacher & Admin)
 */
router.put(
  '/quizzes/:quizId',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  quizValidation,
  quizController.updateQuiz
);

/**
 * @route   DELETE /api/teacher/quizzes/:quizId
 * @desc    Delete quiz
 * @access  Private (Teacher & Admin)
 */
router.delete(
  '/quizzes/:quizId',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  quizController.deleteQuiz
);

// ========== QUESTION MANAGEMENT ==========

/**
 * @route   POST /api/teacher/quizzes/:quizId/questions
 * @desc    Add question to quiz
 * @access  Private (Teacher & Admin)
 */
router.post(
  '/quizzes/:quizId/questions',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  // Use combined validation for all question types
  [
    body('type').isIn(['multiple_choice', 'true_false', 'short_answer', 'essay']).withMessage('Loại câu hỏi không hợp lệ'),
    body('content').notEmpty().withMessage('Nội dung câu hỏi không được để trống'),
    body('points').optional().isNumeric().withMessage('Điểm phải là số'),
    // Multiple choice specific validation
    body('options').if(body('type').equals('multiple_choice')).isArray({ min: 2 }).withMessage('Câu hỏi trắc nghiệm phải có ít nhất 2 lựa chọn'),
    body('correctAnswer').if(body('type').equals('multiple_choice')).notEmpty().withMessage('Đáp án đúng không được để trống')
  ],
  quizController.addQuestion
);

/**
 * @route   PUT /api/teacher/questions/:questionId
 * @desc    Update question
 * @access  Private (Teacher & Admin)
 */
router.put(
  '/questions/:questionId',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  // Use combined validation for all question types
  [
    body('type').optional().isIn(['multiple_choice', 'true_false', 'short_answer', 'essay']).withMessage('Loại câu hỏi không hợp lệ'),
    body('content').optional().notEmpty().withMessage('Nội dung câu hỏi không được để trống'),
    body('points').optional().isNumeric().withMessage('Điểm phải là số'),
    // Multiple choice specific validation
    body('options').if(body('type').equals('multiple_choice')).isArray({ min: 2 }).withMessage('Câu hỏi trắc nghiệm phải có ít nhất 2 lựa chọn'),
    body('correctAnswer').if(body('type').equals('multiple_choice')).notEmpty().withMessage('Đáp án đúng không được để trống')
  ],
  quizController.updateQuestion
);

/**
 * @route   DELETE /api/teacher/questions/:questionId
 * @desc    Delete question
 * @access  Private (Teacher & Admin)
 */
router.delete(
  '/questions/:questionId',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  quizController.deleteQuestion
);

/**
 * @route   GET /api/teacher/quizzes/:quizId/attempts
 * @desc    Get all attempts for a quiz (with statistics)
 * @access  Private (Teacher & Admin)
 */
router.get(
  '/quizzes/:quizId/attempts',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  attemptController.getQuizAttemptsForTeacher
);

// ========== STUDENT ROUTES ==========

/**
 * @route   POST /api/student/quizzes/:quizId/start
 * @desc    Start a quiz attempt
 * @access  Private (Student & Admin)
 */
router.post(
  '/quizzes/:quizId/start',
  authMiddleware,
  authorizeRole('student', 'admin'),
  attemptController.startAttempt
);

/**
 * @route   POST /api/student/attempts/:attemptId/submit
 * @desc    Submit quiz attempt
 * @access  Private (Student & Admin)
 */
router.post(
  '/attempts/:attemptId/submit',
  authMiddleware,
  authorizeRole('student', 'admin'),
  body('answers').isObject().withMessage('Đáp án phải là object'),
  attemptController.submitAttempt
);

/**
 * @route   GET /api/student/quizzes/:quizId/attempts
 * @desc    Get student's attempts for a quiz
 * @access  Private (Student & Admin)
 */
router.get(
  '/quizzes/:quizId/attempts',
  authMiddleware,
  authorizeRole('student', 'admin'),
  attemptController.getQuizAttempts
);

/**
 * @route   GET /api/student/attempts/:attemptId
 * @desc    Get attempt details
 * @access  Private (Student & Admin)
 */
router.get(
  '/attempts/:attemptId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  attemptController.getAttempt
);

module.exports = router;
