/**
 * Example protected routes demonstrating role-based authorization
 * These routes show how to control access based on user roles
 */

const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const courseController = require('../controllers/course.controller');
const enrollmentController = require('../controllers/enrollment.controller');

const router = express.Router();

/**
 * @route   GET /api/admin/dashboard
 * @desc    Admin-only endpoint
 * @access  Private (Admin only)
 */
router.get(
  '/dashboard',
  authMiddleware,
  authorizeRole('admin'),
  (req, res) => {
    res.json({
      success: true,
      message: 'Chào mừng Admin đến dashboard',
      data: {
        user: req.user,
        stats: {
          totalUsers: 150,
          totalCourses: 25,
          totalEnrollments: 500,
        },
      },
    });
  }
);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (Admin only)
 * @access  Private (Admin only)
 */
router.get(
  '/users',
  authMiddleware,
  authorizeRole('admin'),
  (req, res) => {
    res.json({
      success: true,
      message: 'Danh sách tất cả người dùng',
      data: {
        users: [
          { id: 1, name: 'Trịnh Ngọc Thái', role: 'teacher' },
          { id: 2, name: 'Trần Thảo Tiên', role: 'student' },
        ],
      },
    });
  }
);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete a user (Admin only)
 * @access  Private (Admin only)
 */
router.delete(
  '/users/:id',
  authMiddleware,
  authorizeRole('admin'),
  (req, res) => {
    const { id } = req.params;
    res.json({
      success: true,
      message: `Xóa người dùng id ${id} thành công`,
    });
  }
);

/**
 * @route   GET /api/teacher/courses
 * @desc    Get teacher's courses
 * @access  Private (Teacher & Admin)
 */
router.get(
  '/courses',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.getMyCourses
);

/**
 * @route   POST /api/teacher/courses
 * @desc    Create a new course
 * @access  Private (Teacher & Admin)
 */
router.post(
  '/courses',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.createCourse
);

/**
 * @route   GET /api/teacher/courses/:id
 * @desc    Get a specific course (teacher's own or any for admin)
 * @access  Private (Teacher & Admin)
 */
router.get(
  '/courses/:id',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.getCourseForOwner
);

/**
 * @route   PUT /api/teacher/courses/:id
 * @desc    Update a specific course
 * @access  Private (Teacher & Admin)
 */
router.put(
  '/courses/:id',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.updateCourse
);

/**
 * @route   DELETE /api/teacher/courses/:id
 * @desc    Delete a specific course
 * @access  Private (Teacher & Admin)
 */
router.delete(
  '/courses/:id',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.deleteCourse
);

/**
 * @route   GET /api/teacher/courses/:courseId/chapters
 * @desc    Get course content (chapters + lectures)
 * @access  Private (Teacher & Admin)
 */
router.get(
  '/courses/:courseId/chapters',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.getCourseContentForOwner
);

/**
 * @route   POST /api/teacher/courses/:courseId/chapters
 * @desc    Create a chapter in a course
 * @access  Private (Teacher & Admin)
 */
router.post(
  '/courses/:courseId/chapters',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.createChapter
);

/**
 * @route   PUT /api/teacher/chapters/:id
 * @desc    Update a chapter
 * @access  Private (Teacher & Admin)
 */
router.put(
  '/chapters/:id',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.updateChapter
);

/**
 * @route   DELETE /api/teacher/chapters/:id
 * @desc    Delete a chapter (and its lectures)
 * @access  Private (Teacher & Admin)
 */
router.delete(
  '/chapters/:id',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.deleteChapter
);

/**
 * @route   POST /api/teacher/chapters/:chapterId/lectures
 * @desc    Create a lecture in a chapter
 * @access  Private (Teacher & Admin)
 */
router.post(
  '/chapters/:chapterId/lectures',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.createLecture
);

/**
 * @route   PUT /api/teacher/lectures/:id
 * @desc    Update a lecture
 * @access  Private (Teacher & Admin)
 */
router.put(
  '/lectures/:id',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.updateLecture
);

/**
 * @route   DELETE /api/teacher/lectures/:id
 * @desc    Delete a lecture
 * @access  Private (Teacher & Admin)
 */
router.delete(
  '/lectures/:id',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.deleteLecture
);

// ---------- Enrollment (Student & Admin) ----------

/**
 * @route   POST /api/student/courses/:courseId/enroll
 * @desc    Enroll in a course
 * @access  Private (Student & Admin)
 */
router.post(
  '/courses/:courseId/enroll',
  authMiddleware,
  authorizeRole('student', 'admin'),
  enrollmentController.enroll
);

/**
 * @route   DELETE /api/student/courses/:courseId/enroll
 * @desc    Unenroll from a course
 * @access  Private (Student & Admin)
 */
router.delete(
  '/courses/:courseId/enroll',
  authMiddleware,
  authorizeRole('student', 'admin'),
  enrollmentController.unenroll
);

/**
 * @route   GET /api/student/enrollments/course/:courseId
 * @desc    Get enrollment detail for one course (progress, etc.)
 * @access  Private (Student & Admin)
 */
router.get(
  '/enrollments/course/:courseId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  enrollmentController.getEnrollmentByCourse
);

/**
 * @route   GET /api/student/enrollments
 * @desc    Get student's enrollments (list all enrolled courses)
 * @access  Private (Student & Admin)
 */
router.get(
  '/enrollments',
  authMiddleware,
  authorizeRole('student', 'admin'),
  enrollmentController.getMyEnrollments
);

/**
 * @route   PUT /api/student/progress/:courseId
 * @desc    Update progress percent for a course (0-100)
 * @access  Private (Student & Admin)
 */
router.put(
  '/progress/:courseId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  enrollmentController.updateProgress
);

/**
 * @route   POST /api/student/submit-assignment
 * @desc    Student submits assignment
 * @access  Private (Student & Admin)
 */
router.post(
  '/submit-assignment',
  authMiddleware,
  authorizeRole('student', 'admin'),
  (req, res) => {
    res.json({
      success: true,
      message: 'Bài tập đã được nộp thành công',
      data: {
        submissionId: 123,
        status: 'submitted',
        submittedAt: new Date(),
      },
    });
  }
);

module.exports = router;
