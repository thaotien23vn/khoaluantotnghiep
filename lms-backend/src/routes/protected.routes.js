/**
 * Example protected routes demonstrating role-based authorization
 * These routes show how to control access based on user roles
 */

const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');

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
  (req, res) => {
    res.json({
      success: true,
      message: 'Danh sách khóa học của bạn',
      data: {
        courses: [
          { id: 1, name: 'JavaScript Basics', students: 45 },
          { id: 2, name: 'React Advanced', students: 32 },
        ],
      },
    });
  }
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
  (req, res) => {
    res.json({
      success: true,
      message: 'Tạo khóa học thành công',
      data: {
        courseId: 3,
        name: 'Node.js Backend',
      },
    });
  }
);

/**
 * @route   GET /api/student/enrollments
 * @desc    Get student's enrollments
 * @access  Private (Student & Admin)
 */
router.get(
  '/enrollments',
  authMiddleware,
  authorizeRole('student', 'admin'),
  (req, res) => {
    res.json({
      success: true,
      message: 'Danh sách khóa học của bạn',
      data: {
        enrollments: [
          { id: 1, courseName: 'JavaScript Basics', progress: 75 },
          { id: 2, courseName: 'React Advanced', progress: 50 },
        ],
      },
    });
  }
);

/**
 * @route   GET /api/student/progress/:courseId
 * @desc    Get progress for a specific course
 * @access  Private (Student & Admin)
 */
router.get(
  '/progress/:courseId',
  authMiddleware,
  authorizeRole('student', 'admin'),
  (req, res) => {
    const { courseId } = req.params;
    res.json({
      success: true,
      message: `Tiến trình khóa học ${courseId}`,
      data: {
        courseId,
        completed: 12,
        total: 20,
        percentage: 60,
      },
    });
  }
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
