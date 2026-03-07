/**
 * Example protected routes demonstrating role-based authorization
 * These routes show how to control access based on user roles
 */

const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const uploadMedia = require('../middlewares/uploadMedia');
const courseController = require('../controllers/course.controller');
const enrollmentController = require('../controllers/enrollment.controller');
const adminController = require('../controllers/admin.controller');
const scheduleController = require('../controllers/schedule.controller');

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
  adminController.getDashboard
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
  adminController.getUsers
);

/**
 * @route   POST /api/admin/users
 * @desc    Create a new user (Admin only)
 * @access  Private (Admin only)
 */
router.post(
  '/users',
  authMiddleware,
  authorizeRole('admin'),
  adminController.createUser
);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update a user (Admin only)
 * @access  Private (Admin only)
 */
router.put(
  '/users/:id',
  authMiddleware,
  authorizeRole('admin'),
  adminController.updateUser
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
  adminController.deleteUser
);

/**
 * @route   GET /api/admin/payments
 * @desc    Get payments (Admin only)
 * @access  Private (Admin only)
 */
router.get(
  '/payments',
  authMiddleware,
  authorizeRole('admin'),
  adminController.getPayments
);

/**
 * @route   POST /api/admin/enrollments
 * @desc    Enroll any user to a course (Admin only)
 * @access  Private (Admin only)
 */
router.post(
  '/enrollments',
  authMiddleware,
  authorizeRole('admin'),
  adminController.enrollUserToCourse
);

/**
 * @route   DELETE /api/admin/enrollments
 * @desc    Unenroll any user from a course (Admin only)
 * @access  Private (Admin only)
 */
router.delete(
  '/enrollments',
  authMiddleware,
  authorizeRole('admin'),
  adminController.unenrollUserFromCourse
);

/**
 * @route   GET /api/admin/courses/:courseId/enrollments
 * @desc    Get all enrollments for a course
 * @access  Private (Admin only)
 */
router.get(
  '/courses/:courseId/enrollments-admin',
  authMiddleware,
  authorizeRole('admin'),
  adminController.getCourseEnrollments
);

/**
 * @route   GET /api/admin/users/:userId/enrollments
 * @desc    Get all enrollments for a user
 * @access  Private (Admin only)
 */
router.get(
  '/users/:userId/enrollments',
  authMiddleware,
  authorizeRole('admin'),
  adminController.getUserEnrollments
);

/**
 * @route   GET /api/admin/reviews
 * @desc    Get reviews (optionally by course)
 * @access  Private (Admin only)
 */
router.get(
  '/reviews',
  authMiddleware,
  authorizeRole('admin'),
  adminController.getReviews
);

/**
 * @route   DELETE /api/admin/reviews/:id
 * @desc    Delete a review
 * @access  Private (Admin only)
 */
router.delete(
  '/reviews/:id',
  authMiddleware,
  authorizeRole('admin'),
  adminController.deleteReview
);

/**
 * @route   GET /api/admin/categories
 * @desc    Get all categories (Admin only)
 * @access  Private (Admin only)
 */
router.get(
  '/categories',
  authMiddleware,
  authorizeRole('admin'),
  adminController.getCategoriesAdmin
);

/**
 * @route   POST /api/admin/categories
 * @desc    Create a new category (Admin only)
 * @access  Private (Admin only)
 */
router.post(
  '/categories',
  authMiddleware,
  authorizeRole('admin'),
  adminController.createCategory
);

/**
 * @route   PUT /api/admin/categories/:id
 * @desc    Update a category (Admin only)
 * @access  Private (Admin only)
 */
router.put(
  '/categories/:id',
  authMiddleware,
  authorizeRole('admin'),
  adminController.updateCategory
);

/**
 * @route   DELETE /api/admin/categories/:id
 * @desc    Delete a category (Admin only)
 * @access  Private (Admin only)
 */
router.delete(
  '/categories/:id',
  authMiddleware,
  authorizeRole('admin'),
  adminController.deleteCategory
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
 * @route   GET /api/teacher/courses/:courseId/schedule-events
 * @desc    List schedule events for a course
 * @access  Private (Teacher & Admin)
 */
router.get(
  '/courses/:courseId/schedule-events',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  scheduleController.listCourseScheduleEvents
);

/**
 * @route   POST /api/teacher/courses/:courseId/schedule-events
 * @desc    Create schedule event for a course
 * @access  Private (Teacher & Admin)
 */
router.post(
  '/courses/:courseId/schedule-events',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  scheduleController.createCourseScheduleEvent
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
  uploadMedia.single('file'),
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
  uploadMedia.single('file'),
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

/**
 * @route   GET /api/teacher/courses/:courseId/enrollments
 * @desc    Get enrollments for a course (teacher's own or any for admin)
 * @access  Private (Teacher & Admin)
 */
router.get(
  '/courses/:courseId/enrollments',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.getCourseEnrollmentsForOwner
);

// ---------- Enrollment (Student & Admin) ----------

/**
 * @route   POST /api/student/courses/:courseId/enroll
 * @desc    Enroll in a course
 * @access  Private (Student)
 */
router.post(
  '/courses/:courseId/enroll',
  authMiddleware,
  authorizeRole('student'),
  enrollmentController.enroll
);

/**
 * @route   DELETE /api/student/courses/:courseId/enroll
 * @desc    Unenroll from a course
 * @access  Private (Student)
 */
router.delete(
  '/courses/:courseId/enroll',
  authMiddleware,
  authorizeRole('student'),
  enrollmentController.unenroll
);

/**
 * @route   GET /api/student/enrollments/course/:courseId
 * @desc    Get enrollment detail for one course (progress, etc.)
 * @access  Private (Student)
 */
router.get(
  '/enrollments/course/:courseId',
  authMiddleware,
  authorizeRole('student'),
  enrollmentController.getEnrollmentByCourse
);

/**
 * @route   GET /api/student/enrollments
 * @desc    Get student's enrollments (list all enrolled courses)
 * @access  Private (Student)
 */
router.get(
  '/enrollments',
  authMiddleware,
  authorizeRole('student'),
  enrollmentController.getMyEnrollments
);

/**
 * @route   GET /api/student/schedule
 * @desc    Get student's learning schedule
 * @access  Private (Student)
 */
router.get(
  '/schedule',
  authMiddleware,
  authorizeRole('student'),
  scheduleController.getMySchedule
);

/**
 * @route   PUT /api/student/progress/:courseId
 * @desc    Update progress percent for a course (0-100)
 * @access  Private (Student)
 */
router.put(
  '/progress/:courseId',
  authMiddleware,
  authorizeRole('student'),
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
