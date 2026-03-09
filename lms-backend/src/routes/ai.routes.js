const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const { body } = require('express-validator');
const aiController = require('../controllers/ai.controller');

const router = express.Router();

// Student AI tutor
router.post(
  '/student/ai/conversations',
  authMiddleware,
  authorizeRole('student', 'admin'),
  [body('courseId').isInt().withMessage('courseId phải là số nguyên')],
  aiController.createStudentConversation
);

router.post(
  '/student/ai/conversations/:id/messages',
  authMiddleware,
  authorizeRole('student', 'admin'),
  [body('message').notEmpty().withMessage('message không được trống')],
  aiController.sendStudentMessage
);

// Teacher endpoints
router.put(
  '/teacher/lectures/:id/ai-notes',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  [body('aiNotes').optional().isString()],
  aiController.updateTeacherLectureAiNotes
);

router.post(
  '/teacher/ai/ingest/lecture/:lectureId',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  aiController.ingestTeacherLecture
);

// Admin governance
router.get(
  '/admin/ai/settings',
  authMiddleware,
  authorizeRole('admin'),
  aiController.getAdminAiSettings
);

router.put(
  '/admin/ai/settings',
  authMiddleware,
  authorizeRole('admin'),
  aiController.upsertAdminAiSettings
);

router.get(
  '/admin/ai/policies',
  authMiddleware,
  authorizeRole('admin'),
  aiController.getAdminAiPolicies
);

router.post(
  '/admin/ai/policies',
  authMiddleware,
  authorizeRole('admin'),
  [body('role').notEmpty().withMessage('role không được trống')],
  aiController.createAdminAiPolicy
);

router.get(
  '/admin/ai/prompt-templates',
  authMiddleware,
  authorizeRole('admin'),
  aiController.getAdminPromptTemplates
);

router.post(
  '/admin/ai/prompt-templates',
  authMiddleware,
  authorizeRole('admin'),
  [body('key').notEmpty(), body('template').notEmpty()],
  aiController.createAdminPromptTemplate
);

router.get(
  '/admin/ai/audit-logs',
  authMiddleware,
  authorizeRole('admin'),
  aiController.getAdminAiAuditLogs
);

module.exports = router;
