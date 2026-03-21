const express = require("express");
const authMiddleware = require("../middlewares/auth");
const authorizeRole = require("../middlewares/authorize");
const quizController = require("../modules/quiz/quiz.controller");
const attemptController = require("../modules/attempt/attempt.controller");
const {
  createQuizValidation,
  updateQuizValidation,
  addQuestionValidation,
  updateQuestionValidation,
  deleteQuestionValidation,
  getQuizValidation,
  getCourseQuizzesValidation,
} = require("../modules/quiz/quiz.validation");
const {
  startAttemptValidation,
  submitAttemptValidation,
  getQuizAttemptsValidation,
  getAttemptValidation,
  deleteAttemptValidation,
} = require("../modules/attempt/attempt.validation");
const uploadMedia = require("../middlewares/uploadMedia");

const router = express.Router();

// ========== TEACHER/ADMIN ROUTES ==========

/**
 * @route   POST /api/teacher/media/quiz
 * @desc    Upload quiz media (image/audio/video)
 * @access  Private (Teacher & Admin)
 */
router.post(
  "/teacher/media/quiz",
  authMiddleware,
  authorizeRole("teacher", "admin"),
  uploadMedia.single("file"),
  uploadMedia.handleUploadError,
  quizController.uploadQuizMedia,
);

/**
 * @route   POST /api/teacher/courses/:courseId/quizzes
 * @desc    Create a new quiz for a course
 * @access  Private (Teacher & Admin)
 */
router.post(
  "/teacher/courses/:courseId/quizzes",
  authMiddleware,
  authorizeRole("teacher", "admin"),
  createQuizValidation,
  quizController.createQuiz,
);

/**
 * @route   GET /api/teacher/courses/:courseId/quizzes
 * @desc    Get all quizzes for a course
 * @access  Private (Teacher & Admin)
 */
router.get(
  "/teacher/courses/:courseId/quizzes",
  authMiddleware,
  authorizeRole("teacher", "admin"),
  getCourseQuizzesValidation,
  quizController.getCourseQuizzes,
);

/**
 * @route   GET /api/teacher/quizzes/:quizId
 * @desc    Get quiz details
 * @access  Private (Teacher & Admin)
 */
router.get(
  "/teacher/quizzes/:quizId",
  authMiddleware,
  authorizeRole("teacher", "admin"),
  getQuizValidation,
  quizController.getQuiz,
);

/**
 * @route   PUT /api/teacher/quizzes/:quizId
 * @desc    Update quiz
 * @access  Private (Teacher & Admin)
 */
router.put(
  "/teacher/quizzes/:quizId",
  authMiddleware,
  authorizeRole("teacher", "admin"),
  updateQuizValidation,
  quizController.updateQuiz,
);

/**
 * @route   DELETE /api/teacher/quizzes/:quizId
 * @desc    Delete quiz
 * @access  Private (Teacher & Admin)
 */
router.delete(
  "/teacher/quizzes/:quizId",
  authMiddleware,
  authorizeRole("teacher", "admin"),
  getQuizValidation,
  quizController.deleteQuiz,
);

// ========== QUESTION MANAGEMENT ==========

/**
 * @route   POST /api/teacher/quizzes/:quizId/questions
 * @desc    Add question to quiz
 * @access  Private (Teacher & Admin)
 */
router.post(
  "/teacher/quizzes/:quizId/questions",
  authMiddleware,
  authorizeRole("teacher", "admin"),
  addQuestionValidation,
  quizController.addQuestion,
);

/**
 * @route   PUT /api/teacher/questions/:questionId
 * @desc    Update question
 * @access  Private (Teacher & Admin)
 */
router.put(
  "/teacher/questions/:questionId",
  authMiddleware,
  authorizeRole("teacher", "admin"),
  updateQuestionValidation,
  quizController.updateQuestion,
);

/**
 * @route   DELETE /api/teacher/questions/:questionId
 * @desc    Delete question
 * @access  Private (Teacher & Admin)
 */
router.delete(
  "/teacher/questions/:questionId",
  authMiddleware,
  authorizeRole("teacher", "admin"),
  deleteQuestionValidation,
  quizController.deleteQuestion,
);

/**
 * @route   GET /api/teacher/quizzes/:quizId/attempts
 * @desc    Get all attempts for a quiz (with statistics)
 * @access  Private (Teacher & Admin)
 */
router.get(
  "/teacher/quizzes/:quizId/attempts",
  authMiddleware,
  authorizeRole("teacher", "admin"),
  getQuizAttemptsValidation,
  attemptController.getQuizAttemptsForTeacher,
);

/**
 * @route   DELETE /api/teacher/attempts/:attemptId
 * @desc    Delete/Reset student attempt
 * @access  Private (Teacher & Admin)
 */
router.delete(
  "/teacher/attempts/:attemptId",
  authMiddleware,
  authorizeRole("teacher", "admin"),
  deleteAttemptValidation,
  attemptController.deleteAttempt,
);

/**
 * @route   GET /api/teacher/attempts/:attemptId
 * @desc    Get specific attempt detail (Teacher view)
 * @access  Private (Teacher & Admin)
 */
router.get(
  "/teacher/attempts/:attemptId",
  authMiddleware,
  authorizeRole("teacher", "admin"),
  getAttemptValidation,
  attemptController.getAttemptForTeacher,
);

// ========== STUDENT ROUTES ==========

/**
 * @route   GET /api/student/quizzes
 * @desc    Get all quizzes from all enrolled courses
 * @access  Private (Student)
 */
router.get(
  "/student/quizzes",
  authMiddleware,
  authorizeRole("student"),
  quizController.getAllMyQuizzes,
);

/**
 * @route   GET /api/student/courses/:courseId/quizzes
 * @desc    Get all quizzes for a course
 * @access  Private (Student & Admin)
 */
router.get(
  "/student/courses/:courseId/quizzes",
  authMiddleware,
  authorizeRole("student", "admin"),
  getCourseQuizzesValidation,
  quizController.getStudentCourseQuizzes,
);

/**
 * @route   POST /api/student/quizzes/:quizId/start
 * @desc    Start a quiz attempt
 * @access  Private (Student & Admin)
 */
router.post(
  "/student/quizzes/:quizId/start",
  authMiddleware,
  authorizeRole("student", "admin"),
  startAttemptValidation,
  attemptController.startAttempt,
);

/**
 * @route   POST /api/student/attempts/:attemptId/submit
 * @desc    Submit quiz attempt
 * @access  Private (Student & Admin)
 */
router.post(
  "/student/attempts/:attemptId/submit",
  authMiddleware,
  authorizeRole("student", "admin"),
  submitAttemptValidation,
  attemptController.submitAttempt,
);

/**
 * @route   GET /api/student/quizzes/:quizId/attempts
 * @desc    Get student's attempts for a quiz
 * @access  Private (Student & Admin)
 */
router.get(
  "/student/quizzes/:quizId/attempts",
  authMiddleware,
  authorizeRole("student", "admin"),
  getQuizAttemptsValidation,
  attemptController.getQuizAttempts,
);

/**
 * @route   GET /api/student/attempts/:attemptId
 * @desc    Get attempt details
 * @access  Private (Student & Admin)
 */
router.get(
  "/student/attempts/:attemptId",
  authMiddleware,
  authorizeRole("student", "admin"),
  getAttemptValidation,
  attemptController.getAttempt,
);

module.exports = router;
