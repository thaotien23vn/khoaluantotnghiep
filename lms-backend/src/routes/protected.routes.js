/**
 * Example protected routes demonstrating role-based authorization
 * These routes show how to control access based on user roles
 */

const express = require('express');
const authMiddleware = require('../middlewares/auth');
const { authorizeRole } = require('../middlewares/authorize');
const uploadMedia = require('../middlewares/uploadMedia');
const courseController = require('../modules/course/course.controller');
const chapterController = require('../modules/chapter/chapter.controller');
const lessonController = require('../modules/lesson/lesson.controller');
const paymentController = require('../modules/payment/payment.controller');
const enrollmentController = require('../modules/enrollment/enrollment.controller');
const adminController = require('../modules/admin/admin.controller');
const trackingController = require('../modules/tracking/tracking.controller');
const {
  createCourseValidation,
  updateCourseValidation,
  getMyCoursesValidation,
  setPublishedValidation,
  getCourseEnrollmentsValidation,
  submitForReviewValidation,
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
  getPaymentHistoryValidation,
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
  deleteReviewValidation,
  createCategoryValidation,
  updateCategoryValidation,
  deleteCategoryValidation,
} = require('../modules/admin/admin.validation');

const {
  enrollCourseValidation,
  unenrollCourseValidation,
  getEnrollmentByCourseValidation,
  updateProgressValidation,
} = require('../modules/enrollment/enrollment.validation');

// IMPORTANT:
// This file is mounted at /api/admin, /api/teacher, /api/student.
// Using a single router causes route shadowing (e.g. /dashboard admin route matches /api/student/dashboard).
// Split routers by audience to keep identical subpaths safe.
const adminRouter = express.Router();
const teacherRouter = express.Router();
const studentRouter = express.Router();

/**
 * @route   GET /api/admin/dashboard
 * @desc    Admin-only endpoint
 * @access  Private (Admin only)
 */
adminRouter.get(
  '/dashboard',
  authMiddleware,
  authorizeRole('admin'),
  adminController.getDashboard
);

/**
 * @route   GET /api/admin/revenue-by-day
 * @desc    Get revenue by day for last 7 days
 * @access  Private (Admin only)
 */
adminRouter.get(
  '/revenue-by-day',
  authMiddleware,
  authorizeRole('admin'),
  adminController.getRevenueByDay
);

/**
 * @route   GET /api/admin/top-courses
 * @desc    Get top courses by enrollment
 * @access  Private (Admin only)
 */
adminRouter.get(
  '/top-courses',
  authMiddleware,
  authorizeRole('admin'),
  adminController.getTopCourses
);

/**
 * @route   GET /api/admin/payment-status-counts
 * @desc    Get payment status counts
 * @access  Private (Admin only)
 */
adminRouter.get(
  '/payment-status-counts',
  authMiddleware,
  authorizeRole('admin'),
  adminController.getPaymentStatusCounts
);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (Admin only)
 * @access  Private (Admin only)
 */
adminRouter.get(
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
adminRouter.post(
  '/users',
  authMiddleware,
  authorizeRole('admin'),
  createUserValidation,
  adminController.createUser
);

/**
 * @route   GET /api/admin/users/export-csv
 * @desc    Export users to CSV
 * @access  Private (Admin only)
 */
adminRouter.get(
  '/users/export-csv',
  authMiddleware,
  authorizeRole('admin'),
  adminController.exportUsersCSV
);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update a user (Admin only)
 * @access  Private (Admin only)
 */
adminRouter.put(
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
adminRouter.delete(
  '/users/:id',
  authMiddleware,
  authorizeRole('admin'),
  deleteUserValidation,
  adminController.deleteUser
);

/**
 * @route   GET /api/admin/teachers/:id/kpis
 * @desc    Get teacher KPIs (performance metrics)
 * @access  Private (Admin only)
 */
adminRouter.get(
  '/teachers/:id/kpis',
  authMiddleware,
  authorizeRole('admin'),
  adminController.getTeacherKPIs
);

/**
 * @route   GET /api/admin/audit-logs
 * @desc    Get audit logs (admin activity history)
 * @access  Private (Admin only)
 */
adminRouter.get(
  '/audit-logs',
  authMiddleware,
  authorizeRole('admin'),
  adminController.getAuditLogs
);

/**
 * @route   GET /api/admin/payments
 * @desc    Get payments (Admin only)
 * @access  Private (Admin only)
 */
adminRouter.get(
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
adminRouter.post(
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
adminRouter.delete(
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
adminRouter.get(
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
adminRouter.get(
  '/users/:userId/enrollments',
  authMiddleware,
  authorizeRole('admin'),
  getUserEnrollmentsValidation,
  adminController.getUserEnrollments
);

/**
 * @route   DELETE /api/admin/reviews/:id
 * @desc    Delete a review
 * @access  Private (Admin only)
 */
adminRouter.delete(
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
adminRouter.get(
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
adminRouter.post(
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
adminRouter.put(
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
adminRouter.delete(
  '/categories/:id',
  authMiddleware,
  authorizeRole('admin'),
  deleteCategoryValidation,
  adminController.deleteCategory
);

// ==========================================
// ADMIN COURSE REVIEW ROUTES
// ==========================================
const { adminReviewValidation } = require('../modules/course/course.validation');

/**
 * @route   GET /api/admin/courses/pending-review
 * @desc    Get all courses pending review
 * @access  Private (Admin only)
 */
adminRouter.get(
  '/courses/pending-review',
  authMiddleware,
  authorizeRole('admin'),
  courseController.getPendingReviewCourses
);

/**
 * @route   POST /api/admin/courses/:id/review
 * @desc    Admin approve or reject a course
 * @access  Private (Admin only)
 */
adminRouter.post(
  '/courses/:id/review',
  authMiddleware,
  authorizeRole('admin'),
  adminReviewValidation,
  courseController.adminReviewCourse
);

/**
 * @route   PATCH /api/admin/courses/:id/toggle-publish
 * @desc    Toggle course publish status (admin only)
 * @access  Private (Admin only)
 */
adminRouter.patch(
  '/courses/:id/toggle-publish',
  authMiddleware,
  authorizeRole('admin'),
  courseController.togglePublish
);

/**
 * @route   GET /api/teacher/courses
 * @desc    Get teacher's courses
 * @access  Private (Teacher & Admin)
 */
teacherRouter.get(
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
teacherRouter.post(
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
  getLastAccessedLectureValidation,
  getCertificateEligibilityValidation,
} = require('../modules/progress/progress.validation');

/**
 * @route   GET /api/teacher/courses/:courseId/progress
 * @desc    Get all students progress for a course
 * @access  Private (Teacher)
 */
teacherRouter.get(
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
teacherRouter.get(
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
teacherRouter.get(
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
teacherRouter.put(
  '/courses/:id',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  updateCourseValidation,
  courseController.updateCourse
);

/**
 * @route   PUT /api/teacher/courses/:id/publish
 * @desc    Publish or unpublish a course - CHỈ ADMIN
 * @access  Private (Admin only)
 */
teacherRouter.put(
  '/courses/:id/publish',
  authMiddleware,
  authorizeRole('admin'),
  setPublishedValidation,
  courseController.setCoursePublished
);

/**
 * @route   POST /api/teacher/courses/:id/submit-review
 * @desc    Submit course for admin review
 * @access  Private (Teacher & Admin)
 */
teacherRouter.post(
  '/courses/:id/submit-review',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  submitForReviewValidation,
  courseController.submitCourseForReview
);

/**
 * @route   DELETE /api/teacher/courses/:id
 * @desc    Delete a specific course
 * @access  Private (Teacher & Admin)
 */
teacherRouter.delete(
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
teacherRouter.get(
  '/courses/:courseId/chapters',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  courseController.getCourseContentForOwner
);


/**
 * @route   POST /api/teacher/chapters
 * @desc    Create a chapter in a course
 * @access  Private (Teacher & Admin)
 */
teacherRouter.post(
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
teacherRouter.put(
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
teacherRouter.delete(
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
teacherRouter.post(
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
teacherRouter.put(
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
teacherRouter.delete(
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
teacherRouter.get(
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
teacherRouter.get(
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
studentRouter.post(
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
studentRouter.delete(
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
studentRouter.get(
  '/enrollments/course/:courseId',
  authMiddleware,
  authorizeRole('student'),
  getEnrollmentByCourseValidation,
  enrollmentController.getEnrollmentByCourse
);

/**
 * @route   GET /api/student/enrolled-courses/:courseId/content
 * @desc    Get full course content for enrolled students (with video URLs)
 * @access  Private (Student - must be enrolled)
 */
studentRouter.get(
  '/enrolled-courses/:courseId/content',
  authMiddleware,
  authorizeRole('student'),
  getCourseEnrollmentsValidation,
  courseController.getEnrolledCourseContent
);

/**
 * @route   GET /api/student/enrollments
 * @desc    Get student's enrollments (list all enrolled courses)
 * @access  Private (Student)
 */
studentRouter.get(
  '/enrollments',
  authMiddleware,
  authorizeRole('student'),
  enrollmentController.getMyEnrollments
);

/**
 * @route   GET /api/student/enrollments/expiring
 * @desc    Get enrollments expiring soon (renewal reminders)
 * @access  Private (Student)
 */
studentRouter.get(
  '/enrollments/expiring',
  authMiddleware,
  authorizeRole('student'),
  enrollmentController.getExpiringEnrollments
);

/**
 * @route   GET /api/student/enrollments/:id/renewal-price
 * @desc    Get renewal price for an enrollment
 * @access  Private (Student)
 */
studentRouter.get(
  '/enrollments/:id/renewal-price',
  authMiddleware,
  authorizeRole('student'),
  enrollmentController.getRenewalPrice
);

/**
 * @route   POST /api/student/enrollments/:id/renew
 * @desc    Renew enrollment for a course
 * @access  Private (Student)
 */
studentRouter.post(
  '/enrollments/:id/renew',
  authMiddleware,
  authorizeRole('student'),
  enrollmentController.renewEnrollment
);

/**
 * @route   PUT /api/student/progress/:courseId
 * @desc    Update progress percent for a course (0-100)
 * @access  Private (Student)
 */
studentRouter.put(
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
studentRouter.put(
  '/lectures/:lectureId/progress',
  authMiddleware,
  authorizeRole('student'),
  updateLectureProgressValidation,
  progressController.updateLectureProgress
);

/**
 * @route   POST /api/student/lectures/:lectureId/progress
 * @desc    Update lecture progress (for sendBeacon on page close)
 * @access  Private (Student)
 */
studentRouter.post(
  '/lectures/:lectureId/progress',
  authMiddleware,
  authorizeRole('student'),
  updateLectureProgressValidation,
  progressController.updateLectureProgress
);


/**
 * @route   GET /api/student/dashboard
 * @desc    Get student dashboard summary (enrollments, progress, quizzes, next event, streak)
 * @access  Private (Student)
 */
studentRouter.get(
  '/dashboard',
  authMiddleware,
  authorizeRole('student'),
  progressController.getStudentDashboard
);

/**
 * @route   GET /api/student/courses/:courseId/continue
 * @desc    Get last accessed lecture for a course (Continue Learning)
 * @access  Private (Student)
 */
studentRouter.get(
  '/courses/:courseId/continue',
  authMiddleware,
  authorizeRole('student'),
  getLastAccessedLectureValidation,
  progressController.getLastAccessedLecture
);

/**
 * @route   GET /api/student/courses/:courseId/certificate
 * @desc    Get certificate eligibility for a course (100% completion required)
 * @access  Private (Student)
 */
studentRouter.get(
  '/courses/:courseId/certificate',
  authMiddleware,
  authorizeRole('student'),
  getCertificateEligibilityValidation,
  progressController.getCertificateEligibility
);

// ---------- Payment (Student & Admin) ----------

/**
 * @route   POST /api/student/courses/:courseId/payment
 * @desc    Create payment for a course
 * @access  Private (Student)
 */
studentRouter.post(
  '/courses/:courseId/payment',
  authMiddleware,
  authorizeRole('student'),
  createPaymentValidation,
  paymentController.createPayment
);

/**
 * @route   GET /api/student/payments
 * @desc    Get payment history (deprecated alias to /api/student/payments/history)
 * @access  Private (Student)
 */
studentRouter.get(
  '/payments',
  authMiddleware,
  authorizeRole('student'),
  getPaymentHistoryValidation,
  paymentController.getPaymentHistory
);

// ==========================================
// TRACKING ANALYTICS (Real Implementation)
// ==========================================
adminRouter.get(
  '/tracking/analytics',
  authMiddleware,
  authorizeRole('admin'),
  (req, res, next) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', '</api/tracking/analytics>; rel="canonical"');
    return trackingController.getAnalytics(req, res, next);
  }
);

module.exports = {
  adminRouter,
  teacherRouter,
  studentRouter,
};
