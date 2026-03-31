const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const { body } = require('express-validator');
const aiController = require('../modules/ai/ai.controller');
const aiSupportController = require('../modules/ai/aiSupport.controller');
const aiTeachingAssistantController = require('../modules/ai/aiTeachingAssistant.controller');
const {
  createStudentConversationValidation,
  sendStudentMessageValidation,
  updateTeacherLectureAiNotesValidation,
  ingestTeacherLectureValidation,
  upsertAdminAiSettingsValidation,
  createAdminAiPolicyValidation,
  createAdminPromptTemplateValidation,
  // Student enhancements
  getStudentLearningPathValidation,
  getStudentRecommendationsValidation,
  updateRecommendationStatusValidation,
  getStudentKnowledgeGapsValidation,
  getStudentLearningAnalyticsValidation,
  trackLearningEventValidation,
  getStudentStudyScheduleValidation,
  // Teacher enhancements
  generateTeacherContentValidation,
  generateTeacherQuizValidation,
  generateTeacherExercisesValidation,
  analyzeTeacherContentQualityValidation,
  getTeacherCourseAnalyticsValidation,
  getTeacherQualityReportValidation,
  publishQuizValidation,
  generateCourseOutlineValidation,
  triggerCourseContentGenerationValidation,
  saveCourseOutlineValidation,
  // Admin enhancements
  getAdminPlatformAnalyticsValidation,
  getAdminContentQualityReportValidation,
  triggerAdminRecommendationsValidation,
  // AI Teaching Assistant
  generateTeachingGuideValidation,
  generateStudentFeedbackValidation,
  generateTeacherExamValidation,
  generateTeachingMaterialsValidation,
  // AI Support 24/7
  sendSupportMessageValidation,
  getSupportChatHistoryValidation,
  handleQuickActionValidation,
  supportConversationIdValidation,
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

// ==========================================
// STUDENT AI ENHANCEMENT ROUTES
// ==========================================

// Learning Path
router.get(
  '/student/ai/learning-path',
  authMiddleware,
  authorizeRole('student', 'admin'),
  getStudentLearningPathValidation,
  aiController.getStudentLearningPath
);

// AI Recommendations
router.get(
  '/student/ai/recommendations',
  authMiddleware,
  authorizeRole('student', 'admin'),
  getStudentRecommendationsValidation,
  aiController.getStudentRecommendations
);

router.put(
  '/student/ai/recommendations/:id/status',
  authMiddleware,
  authorizeRole('student', 'admin'),
  updateRecommendationStatusValidation,
  aiController.updateStudentRecommendationStatus
);

// Knowledge Gaps
router.get(
  '/student/ai/knowledge-gaps',
  authMiddleware,
  authorizeRole('student', 'admin'),
  getStudentKnowledgeGapsValidation,
  aiController.getStudentKnowledgeGaps
);

// Learning Analytics
router.get(
  '/student/ai/analytics',
  authMiddleware,
  authorizeRole('student', 'admin'),
  getStudentLearningAnalyticsValidation,
  aiController.getStudentLearningAnalytics
);

// Track Learning Event
router.post(
  '/student/ai/track-event',
  authMiddleware,
  authorizeRole('student', 'admin'),
  trackLearningEventValidation,
  aiController.trackStudentLearningEvent
);

// Study Schedule
router.get(
  '/student/ai/study-schedule',
  authMiddleware,
  authorizeRole('student', 'admin'),
  getStudentStudyScheduleValidation,
  aiController.getStudentStudySchedule
);

// ==========================================
// TEACHER AI ENHANCEMENT ROUTES
// ==========================================

// Content Generation
router.post(
  '/teacher/ai/generate-content',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  generateTeacherContentValidation,
  aiController.generateTeacherLectureContent
);

// Quiz Generation
router.post(
  '/teacher/ai/generate-quiz',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  generateTeacherQuizValidation,
  aiController.generateTeacherQuizQuestions
);

// Generate and Save Quiz as Draft
router.post(
  '/teacher/ai/generate-and-save-quiz',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  generateTeacherQuizValidation,
  aiController.generateAndSaveTeacherQuiz
);

// Publish Draft Quiz
router.post(
  '/teacher/ai/quizzes/:quizId/publish',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  publishQuizValidation,
  aiController.publishTeacherQuiz
);

// Practice Exercises Generation
router.post(
  '/teacher/ai/generate-exercises',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  generateTeacherExercisesValidation,
  aiController.generateTeacherPracticeExercises
);

// Content Quality Analysis
router.get(
  '/teacher/ai/content-quality',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  analyzeTeacherContentQualityValidation,
  aiController.analyzeTeacherContentQuality
);

// Course Analytics
router.get(
  '/teacher/ai/course-analytics',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  getTeacherCourseAnalyticsValidation,
  aiController.getTeacherCourseAnalytics
);

// Content Quality Report
router.get(
  '/teacher/ai/quality-report',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  getTeacherQualityReportValidation,
  aiController.getTeacherContentQualityReport
);

// ==========================================
// AI TEACHING ASSISTANT ROUTES
// ==========================================

// Generate Teaching Guide (Lesson Plan)
router.post(
  '/teacher/ai/teaching-guide',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  generateTeachingGuideValidation,
  aiTeachingAssistantController.generateTeachingGuide
);

// Generate Student Feedback Suggestions
router.post(
  '/teacher/ai/student-feedback',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  generateStudentFeedbackValidation,
  aiTeachingAssistantController.generateStudentFeedback
);

// Generate Exam/Quiz with Answer Key
router.post(
  '/teacher/ai/generate-exam',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  generateTeacherExamValidation,
  aiTeachingAssistantController.generateTeacherQuiz
);

// Generate Teaching Materials (slides, handouts, worksheets)
router.post(
  '/teacher/ai/teaching-materials',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  generateTeachingMaterialsValidation,
  aiTeachingAssistantController.generateTeachingMaterials
);

// Analyze Course Difficulty
router.get(
  '/teacher/ai/course-difficulty/:courseId',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  aiTeachingAssistantController.analyzeCourseDifficulty
);

// ==========================================
// COURSE GENERATION ROUTES (Phase 1)
// ==========================================

// Generate and Save Course Outline (Gộp Step 1 + 2)
router.post(
  '/teacher/ai/generate-and-save-course-outline',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  generateCourseOutlineValidation,
  aiController.generateAndSaveTeacherCourseOutline
);

// Generate Course Outline (chỉ generate, chưa save)
router.post(
  '/teacher/ai/generate-course-outline',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  generateCourseOutlineValidation,
  aiController.generateTeacherCourseOutline
);

// Save Course Outline to Database (nếu đã có outline)
router.post(
  '/teacher/ai/save-course-outline',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  saveCourseOutlineValidation,
  aiController.saveTeacherCourseOutline
);

// Trigger Course Content Generation (Queue)
router.post(
  '/teacher/ai/generate-course-content',
  authMiddleware,
  authorizeRole('teacher', 'admin'),
  triggerCourseContentGenerationValidation,
  aiController.triggerTeacherCourseContentGeneration
);

// ==========================================
// ADMIN AI ENHANCEMENT ROUTES
// ==========================================

// Platform Analytics
router.get(
  '/admin/ai/platform-analytics',
  authMiddleware,
  authorizeRole('admin'),
  getAdminPlatformAnalyticsValidation,
  aiController.getAdminPlatformAnalytics
);

// Content Quality Report (Admin - all courses)
router.get(
  '/admin/ai/content-quality-report',
  authMiddleware,
  authorizeRole('admin'),
  getAdminContentQualityReportValidation,
  aiController.getAdminContentQualityReport
);

// Trigger Recommendations Generation
router.post(
  '/admin/ai/generate-recommendations',
  authMiddleware,
  authorizeRole('admin'),
  triggerAdminRecommendationsValidation,
  aiController.triggerAdminRecommendationsGeneration
);

// System Health
router.get(
  '/admin/ai/system-health',
  authMiddleware,
  authorizeRole('admin'),
  aiController.getAdminSystemHealth
);

// ==========================================
// ADMIN CHAT PERMISSION ROUTES
// ==========================================

// Get Chat Permissions
router.get(
  '/admin/ai/chat-permissions',
  authMiddleware,
  authorizeRole('admin'),
  aiController.getAdminChatPermissions
);

// Mute User
router.post(
  '/admin/ai/chat-permissions/mute',
  authMiddleware,
  authorizeRole('admin'),
  aiController.muteUser
);

// Unmute User
router.post(
  '/admin/ai/chat-permissions/unmute',
  authMiddleware,
  authorizeRole('admin'),
  aiController.unmuteUser
);

// Set Chat Permission (role/course/lecture level)
router.put(
  '/admin/ai/chat-permissions',
  authMiddleware,
  authorizeRole('admin'),
  aiController.setChatPermission
);

// Delete Chat Permission (soft delete)
router.delete(
  '/admin/ai/chat-permissions/:id',
  authMiddleware,
  authorizeRole('admin'),
  aiController.deleteChatPermission
);

// ==========================================
// AI SUPPORT 24/7 ROUTES - Global AI Assistant
// ==========================================

// Get or create support chat
router.post(
  '/support/chat',
  authMiddleware,
  authorizeRole('student', 'teacher', 'admin'),
  aiSupportController.getOrCreateChat
);

// Get chat history
router.get(
  '/support/chat/:conversationId/history',
  authMiddleware,
  authorizeRole('student', 'teacher', 'admin'),
  getSupportChatHistoryValidation,
  aiSupportController.getChatHistory
);

// Send message
router.post(
  '/support/chat/message',
  authMiddleware,
  authorizeRole('student', 'teacher', 'admin'),
  sendSupportMessageValidation,
  aiSupportController.sendMessage
);

// Get user's conversations
router.get(
  '/support/conversations',
  authMiddleware,
  authorizeRole('student', 'teacher', 'admin'),
  aiSupportController.getConversations
);

// Clear conversation
router.post(
  '/support/chat/:conversationId/clear',
  authMiddleware,
  authorizeRole('student', 'teacher', 'admin'),
  supportConversationIdValidation,
  aiSupportController.clearConversation
);

// Delete conversation
router.delete(
  '/support/chat/:conversationId',
  authMiddleware,
  authorizeRole('student', 'teacher', 'admin'),
  supportConversationIdValidation,
  aiSupportController.deleteConversation
);

// Get quick suggestions
router.get(
  '/support/suggestions',
  authMiddleware,
  authorizeRole('student', 'teacher', 'admin'),
  aiSupportController.getQuickSuggestions
);

// Handle quick action
router.post(
  '/support/action',
  authMiddleware,
  authorizeRole('student', 'teacher', 'admin'),
  handleQuickActionValidation,
  aiSupportController.handleQuickAction
);

// Get system stats (admin only)
router.get(
  '/admin/support/stats',
  authMiddleware,
  authorizeRole('admin'),
  aiSupportController.getSystemStats
);

module.exports = router;
