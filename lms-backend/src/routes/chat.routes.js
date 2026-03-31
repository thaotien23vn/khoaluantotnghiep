const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const lessonChatController = require('../modules/chat/lessonChat.controller');
const courseChatController = require('../modules/chat/courseChat.controller');
const {
  getChatValidation,
  getCourseChatValidation,
  sendMessageValidation,
  replyMessageValidation,
} = require('../modules/chat/chat.validation');

// Generic Message Routes (works for both lesson and course chat messages)
// DELETE /api/chat/messages/:messageId - Delete message (Student own, Teacher/Admin all)
// PUT /api/chat/messages/:messageId - Edit message (Student own within 10min, Teacher/Admin any)
router.delete('/chat/messages/:messageId', authMiddleware, lessonChatController.deleteMessage);
router.put('/chat/messages/:messageId', authMiddleware, lessonChatController.editMessage);

// ==================== LESSON CHAT ====================

// Student routes - Lesson Chat
router.get('/lessons/:lessonId/chat', authMiddleware, getChatValidation, lessonChatController.getChat);
router.post('/chat/:chatId/messages', authMiddleware, sendMessageValidation, lessonChatController.sendMessage);

// Teacher Lesson Chat Permission Routes
// POST /api/teacher/chat/:chatId/pin/:messageId - Pin message
// DELETE /api/teacher/chat/:chatId/pin/:messageId - Unpin message
router.post('/teacher/chat/:chatId/pin/:messageId', authMiddleware, lessonChatController.pinMessage);
router.delete('/teacher/chat/:chatId/pin/:messageId', authMiddleware, lessonChatController.pinMessage);

// POST /api/teacher/chat/:chatId/mute - Mute chat
// DELETE /api/teacher/chat/:chatId/mute - Unmute chat
router.post('/teacher/chat/:chatId/mute', authMiddleware, lessonChatController.muteChat);
router.delete('/teacher/chat/:chatId/mute', authMiddleware, (req, res, next) => {
  req.body.durationMinutes = null;
  lessonChatController.muteChat(req, res, next);
});

router.get('/teacher/chat/:chatId/analytics', authMiddleware, lessonChatController.getAnalytics);

// Admin Lesson Chat Permission Routes
router.post('/admin/chat/:chatId/pin/:messageId', authMiddleware, lessonChatController.pinMessage);
router.delete('/admin/chat/:chatId/pin/:messageId', authMiddleware, lessonChatController.pinMessage);
router.post('/admin/chat/:chatId/mute', authMiddleware, lessonChatController.muteChat);
router.delete('/admin/chat/:chatId/mute', authMiddleware, (req, res, next) => {
  req.body.durationMinutes = null;
  lessonChatController.muteChat(req, res, next);
});

// POST /api/admin/chat/:chatId/ban/:userId - Ban user
// DELETE /api/admin/chat/:chatId/ban/:userId - Unban user
router.post('/admin/chat/:chatId/ban/:userId', authMiddleware, lessonChatController.banUser);
router.delete('/admin/chat/:chatId/ban/:userId', authMiddleware, lessonChatController.banUser);

router.post('/admin/chat/:chatId/toggle', authMiddleware, lessonChatController.toggleChat);
router.delete('/admin/chat/:chatId/history', authMiddleware, lessonChatController.clearHistory);
router.get('/admin/chat/:chatId/analytics', authMiddleware, lessonChatController.getAnalytics);

// ==================== COURSE CHAT ====================

// Student Course Chat Routes
// GET /api/student/courses/:courseId/chat - Get chat (enrolled students)
router.get('/student/courses/:courseId/chat', authMiddleware, getCourseChatValidation, courseChatController.getChat);

// POST /api/student/courses/:courseId/chat/messages - Send message
router.post('/student/courses/:courseId/chat/messages', authMiddleware, sendMessageValidation, courseChatController.sendMessage);

// PUT /api/student/courses/:courseId/chat/messages/:messageId - Edit message (Student own)
// DELETE /api/student/courses/:courseId/chat/messages/:messageId - Delete message (Student own, Teacher/Admin all)
router.put('/student/courses/:courseId/chat/messages/:messageId', authMiddleware, courseChatController.editMessage);
router.delete('/student/courses/:courseId/chat/messages/:messageId', authMiddleware, courseChatController.deleteMessage);

// Teacher Course Chat Routes
// GET /api/teacher/courses/:courseId/chat
router.get('/teacher/courses/:courseId/chat', authMiddleware, getCourseChatValidation, courseChatController.getChat);
router.get('/teacher/course-chat/escalations', authMiddleware, courseChatController.getEscalations);
router.post('/teacher/courses/:courseId/chat/reply', authMiddleware, replyMessageValidation, courseChatController.reply);

// POST /api/teacher/courses/:courseId/chat/pin/:messageId - Pin
// DELETE /api/teacher/courses/:courseId/chat/pin/:messageId - Unpin
router.post('/teacher/courses/:courseId/chat/pin/:messageId', authMiddleware, courseChatController.pinMessage);
router.delete('/teacher/courses/:courseId/chat/pin/:messageId', authMiddleware, courseChatController.pinMessage);

// POST /api/teacher/courses/:courseId/chat/mute - Mute
// DELETE /api/teacher/courses/:courseId/chat/mute - Unmute
router.post('/teacher/courses/:courseId/chat/mute', authMiddleware, courseChatController.muteChat);
router.delete('/teacher/courses/:courseId/chat/mute', authMiddleware, (req, res, next) => {
  req.body.durationMinutes = null;
  courseChatController.muteChat(req, res, next);
});

// GET /api/teacher/courses/:courseId/chat/analytics
router.get('/teacher/courses/:courseId/chat/analytics', authMiddleware, courseChatController.getAnalytics);

// Admin Course Chat Routes
router.get('/admin/courses/:courseId/chat', authMiddleware, getCourseChatValidation, courseChatController.getChat);
router.get('/admin/course-chat/escalations', authMiddleware, courseChatController.getEscalations);
router.post('/admin/courses/:courseId/chat/reply', authMiddleware, replyMessageValidation, courseChatController.reply);

// POST /api/admin/courses/:courseId/chat/pin/:messageId - Pin
// DELETE /api/admin/courses/:courseId/chat/pin/:messageId - Unpin
router.post('/admin/courses/:courseId/chat/pin/:messageId', authMiddleware, courseChatController.pinMessage);
router.delete('/admin/courses/:courseId/chat/pin/:messageId', authMiddleware, courseChatController.pinMessage);

// POST /api/admin/courses/:courseId/chat/mute - Mute
// DELETE /api/admin/courses/:courseId/chat/mute - Unmute
router.post('/admin/courses/:courseId/chat/mute', authMiddleware, courseChatController.muteChat);
router.delete('/admin/courses/:courseId/chat/mute', authMiddleware, (req, res, next) => {
  req.body.durationMinutes = null;
  courseChatController.muteChat(req, res, next);
});

// POST /api/admin/courses/:courseId/chat/ban/:userId - Ban
// DELETE /api/admin/courses/:courseId/chat/ban/:userId - Unban
router.post('/admin/courses/:courseId/chat/ban/:userId', authMiddleware, courseChatController.banUser);
router.delete('/admin/courses/:courseId/chat/ban/:userId', authMiddleware, courseChatController.banUser);

router.post('/admin/courses/:courseId/chat/toggle', authMiddleware, courseChatController.toggleChat);
router.delete('/admin/courses/:courseId/chat/history', authMiddleware, courseChatController.clearHistory);
router.get('/admin/courses/:courseId/chat/analytics', authMiddleware, courseChatController.getAnalytics);

module.exports = router;
