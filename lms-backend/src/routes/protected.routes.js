/**
 * Example protected routes demonstrating role-based authorization
 * These routes show how to control access based on user roles
 */

const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const uploadMedia = require('../middlewares/uploadMedia');
const courseController = require('../modules/course/course.controller');
const chapterController = require('../modules/chapter/chapter.controller');
const lessonController = require('../modules/lesson/lesson.controller');
const paymentController = require('../modules/payment/payment.controller');
const enrollmentController = require('../modules/enrollment/enrollment.controller');
const adminController = require('../modules/admin/admin.controller');
const scheduleController = require('../modules/schedule/schedule.controller');
const {
  createCourseValidation,
  updateCourseValidation,
  getMyCoursesValidation,
  setPublishedValidation,
  getCourseEnrollmentsValidation,
} = require('../modules/course/course.validation');

const {
  createChapterValidation,
  updateChapterValidation,
  deleteChapterValidation,
} = require('../modules/chapter/chapter.validation');

const {
  createLessonValidation,
  updateLessonValidation,
  deleteLessonValidation,
  getLessonDetailValidation,
} = require('../modules/lesson/lesson.validation');

const {
  createPaymentValidation,
  processPaymentValidation,
  getPaymentHistoryValidation,
  getPaymentDetailValidation,
} = require('../middlewares/payment.validation');

const {
  createUserValidation,
  updateUserValidation,
  deleteUserValidation,
  getPaymentsValidation,
  enrollUserValidation,
  unenrollUserValidation,
  getCourseEnrollmentsValidation: getAdminCourseEnrollmentsValidation,
  getUserEnrollmentsValidation,
  getReviewsValidation,
  deleteReviewValidation,
  createCategoryValidation,
  updateCategoryValidation,
  deleteCategoryValidation,
} = require('../modules/admin/admin.validation');

const {
  getMyScheduleValidation,
  updateScheduleEventValidation,
  deleteScheduleEventValidation,
  listCourseScheduleEventsValidation,
  createScheduleEventValidation,
} = require('../modules/schedule/schedule.validation');

const {
  enrollCourseValidation,
  unenrollCourseValidation,
  getEnrollmentByCourseValidation,
  updateProgressValidation,
} = require('../modules/enrollment/enrollment.validation');

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
  createUserValidation,
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
  updateUserValidation,
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
  deleteUserValidation,
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
  getPaymentsValidation,
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
  enrollUserValidation,
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
  unenrollUserValidation,
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
  getAdminCourseEnrollmentsValidation,
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
  getUserEnrollmentsValidation,
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
  getReviewsValidation,
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
  deleteReviewValidation,
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
  createCategoryValidation,
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
  updateCategoryValidation,
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
  deleteCategoryValidation,
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
  getMyCoursesValidation,
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
  createCourseValidation,
  courseController.createCourse
);

// ---------- Progress Tracking (MUST be before /courses/:id) ----------
const progressController = require('../modules/progress/progress.controller');
const {
  updateLectureProgressValidation,
  getStudentCourseProgressValidation,
  getTeacherStudentProgressValidation,
  getCourseStudentsProgressValidation,
} = require('../modules/progress/progress.validation');

/**
 * @route   GET /api/teacher/courses/:courseId/progress
 * @desc    Get all students progress for a course
 * @access  Private (Teacher)
 */
router.get(
  '/courses/:courseId/progress',
  authMiddleware,
  authorizeRole('teacher'),
  getCourseStudentsProgressValidation,
  progressController.getCourseStudentsProgress
);

/**
 * @route   GET /api/teacher/courses/:courseId/students/:studentId/progress
 * @desc    Get specific student progress detail
 * @access  Private (Teacher)
 */
router.get(
  '/courses/:courseId/students/:studentId/progress',
  authMiddleware,
  authorizeRole('teacher'),
  getTeacherStudentProgressValidation,
  progressController.getTeacherStudentProgress
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
  updateCourseValidation,
  courseController.updateCourse
);

/**
 * @route   PUT /api/teacher/courses/:id/publish
 * @desc    Publish or unpublish a course
 * @access  Private (Teacher & Admin)
 */
router.put(
  '/courses/:id/publish',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  setPublishedValidation,
  courseController.setCoursePublished
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
  listCourseScheduleEventsValidation,
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
  createScheduleEventValidation,
  scheduleController.createCourseScheduleEvent
);

/**
 * @route   PUT /api/teacher/schedule-events/:eventId
 * @desc    Update schedule event
 * @access  Private (Teacher & Admin)
 */
router.put(
  '/schedule-events/:eventId',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  updateScheduleEventValidation,
  scheduleController.updateScheduleEvent
);

/**
 * @route   DELETE /api/teacher/schedule-events/:eventId
 * @desc    Delete schedule event
 * @access  Private (Teacher & Admin)
 */
router.delete(
  '/schedule-events/:eventId',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  deleteScheduleEventValidation,
  scheduleController.deleteScheduleEvent
);

/**
 * @route   GET /api/teacher/schedule
 * @desc    Get teacher's teaching schedule
 * @access  Private (Teacher & Admin)
 */
router.get(
  '/schedule',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  getMyScheduleValidation,
  scheduleController.getTeacherSchedule
);

/**
 * @route   POST /api/teacher/chapters
 * @desc    Create a chapter in a course
 * @access  Private (Teacher & Admin)
 */
router.post(
  '/chapters',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  createChapterValidation,
  chapterController.createChapter
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
  updateChapterValidation,
  chapterController.updateChapter
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
  deleteChapterValidation,
  chapterController.deleteChapter
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
  uploadMedia.handleUploadError,
  createLessonValidation,
  lessonController.createLesson
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
  uploadMedia.handleUploadError,
  updateLessonValidation,
  lessonController.updateLesson
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
  deleteLessonValidation,
  lessonController.deleteLesson
);

/**
 * @route   GET /api/teacher/lectures/:id
 * @desc    Get lecture detail for teacher (own courses) or admin (all courses)
 * @access  Private (Teacher & Admin)
 */
router.get(
  '/lectures/:id',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  getLessonDetailValidation,
  lessonController.getLessonDetail
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
  getCourseEnrollmentsValidation,
  courseController.getCourseEnrollmentsForOwner
);

// ---------- Enrollment (Student & Admin) ----------

/**
 * @route   POST /api/student/enroll
 * @desc    Enroll in a course
 * @access  Private (Student)
 */
router.post(
  '/enroll/:courseId',
  authMiddleware,
  authorizeRole('student'),
  enrollCourseValidation,
  enrollmentController.enroll
);

/**
 * @route   DELETE /api/student/enroll/:courseId
 * @desc    Unenroll from a course
 * @access  Private (Student)
 */
router.delete(
  '/enroll/:courseId',
  authMiddleware,
  authorizeRole('student'),
  unenrollCourseValidation,
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
  getEnrollmentByCourseValidation,
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
 * @route   GET /api/student/learning-schedule
 * @desc    Get student's learning schedule
 * @access  Private (Student)
 */
router.get(
  '/learning-schedule',
  authMiddleware,
  authorizeRole('student'),
  getMyScheduleValidation,
  scheduleController.getMySchedule
);

/**
 * @route   GET /api/student/learning-schedule/next
 * @desc    Get student's next upcoming schedule event
 * @access  Private (Student)
 */
router.get(
  '/learning-schedule/next',
  authMiddleware,
  authorizeRole('student'),
  scheduleController.getNextScheduleEvent
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
  updateProgressValidation,
  enrollmentController.updateProgress
);

// ---------- Student Progress Tracking (MUST NOT be prefixed by student in app.js or must handle it) ----------

/**
 * @route   PUT /api/student/lectures/:lectureId/progress
 * @desc    Update lecture progress when watching video
 * @access  Private (Student)
 */
router.put(
  '/lectures/:lectureId/progress',
  authMiddleware,
  authorizeRole('student'),
  updateLectureProgressValidation,
  progressController.updateLectureProgress
);

/**
 * @route   GET /api/student/courses/:courseId/progress
 * @desc    Get student's detailed progress for a course
 * @access  Private (Student)
 */
router.get(
  '/student-courses/:courseId/progress',
  authMiddleware,
  authorizeRole('student'),
  getStudentCourseProgressValidation,
  progressController.getStudentCourseProgress
);

// ---------- Payment (Student & Admin) ----------

/**
 * @route   POST /api/student/courses/:courseId/payment
 * @desc    Create payment for a course
 * @access  Private (Student)
 */
router.post(
  '/courses/:courseId/payment',
  authMiddleware,
  authorizeRole('student'),
  createPaymentValidation,
  paymentController.createPayment
);

/**
 * @route   POST /api/student/payments/process
 * @desc    Process payment callback (success/failure)
 * @access  Private (Student)
 */
router.post(
  '/payments/process',
  authMiddleware,
  authorizeRole('student'),
  processPaymentValidation,
  paymentController.processPayment
);

/**
 * @route   GET /api/student/payments
 * @desc    Get payment history
 * @access  Private (Student)
 */
router.get(
  '/payments',
  authMiddleware,
  authorizeRole('student'),
  getPaymentHistoryValidation,
  paymentController.getPaymentHistory
);

/**
 * @route   GET /api/student/payments/:id
 * @desc    Get payment detail
 * @access  Private (Student)
 */
router.get(
  '/payments/:id',
  authMiddleware,
  authorizeRole('student'),
  getPaymentDetailValidation,
  paymentController.getPaymentDetail
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
