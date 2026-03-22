const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const { body } = require('express-validator');
const aiController = require('../modules/ai/ai.controller');
const {
  createStudentConversationValidation,
  sendStudentMessageValidation,
  updateTeacherLectureAiNotesValidation,
  ingestTeacherLectureValidation,
  upsertAdminAiSettingsValidation,
  createAdminAiPolicyValidation,
  createAdminPromptTemplateValidation,
} = require('../modules/ai/ai.validation');

const router = express.Router();

// Student AI tutor
router.post(
  '/student/ai/conversations',
  authMiddleware,
  authorizeRole('student', 'admin'),
  createStudentConversationValidation,
  aiController.createStudentConversation
);

router.post(
  '/student/ai/conversations/:id/messages',
  authMiddleware,
  authorizeRole('student', 'admin'),
  sendStudentMessageValidation,
  aiController.sendStudentMessage
);

// Teacher endpoints
router.put(
  '/teacher/lectures/:id/ai-notes',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  updateTeacherLectureAiNotesValidation,
  aiController.updateTeacherLectureAiNotes
);

router.post(
  '/teacher/ai/ingest/lecture/:lectureId',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  ingestTeacherLectureValidation,
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
  upsertAdminAiSettingsValidation,
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
  createAdminAiPolicyValidation,
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
  createAdminPromptTemplateValidation,
  aiController.createAdminPromptTemplate
);

router.get(
  '/admin/ai/audit-logs',
  authMiddleware,
  authorizeRole('admin'),
  aiController.getAdminAiAuditLogs
);

module.exports = router;
