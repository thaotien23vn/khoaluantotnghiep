const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const lessonChatController = require('../modules/chat/lessonChat.controller');
const {
  getChatValidation,
  sendMessageValidation,
  replyMessageValidation,
} = require('../modules/chat/chat.validation');

// Student routes
router.get('/lessons/:lessonId/chat', authMiddleware, getChatValidation, lessonChatController.getChat);
router.post('/chat/:chatId/messages', authMiddleware, sendMessageValidation, lessonChatController.sendMessage);

// Teacher routes
router.get('/teacher/lessons/:lessonId/chat', authMiddleware, getChatValidation, lessonChatController.getChat);
router.get('/teacher/chat/escalations', authMiddleware, lessonChatController.getEscalations);
router.post('/teacher/chat/:chatId/reply', authMiddleware, replyMessageValidation, lessonChatController.reply);

// Teacher Permission routes
router.post('/teacher/chat/:messageId/pin', authMiddleware, lessonChatController.pinMessage);
router.delete('/teacher/chat/:messageId', authMiddleware, lessonChatController.deleteMessage);
router.post('/teacher/chat/:chatId/mute', authMiddleware, lessonChatController.muteChat);
router.get('/teacher/chat/:chatId/analytics', authMiddleware, lessonChatController.getAnalytics);

// Admin routes
router.get('/admin/lessons/:lessonId/chat', authMiddleware, getChatValidation, lessonChatController.getChat);
router.get('/admin/chat/escalations', authMiddleware, lessonChatController.getEscalations);
router.post('/admin/chat/:chatId/reply', authMiddleware, replyMessageValidation, lessonChatController.reply);

// Admin Permission routes
router.post('/admin/chat/:messageId/pin', authMiddleware, lessonChatController.pinMessage);
router.delete('/admin/chat/:messageId', authMiddleware, lessonChatController.deleteMessage);
router.post('/admin/chat/:chatId/mute', authMiddleware, lessonChatController.muteChat);
router.post('/admin/chat/:chatId/ban/:userId', authMiddleware, lessonChatController.banUser);
router.post('/admin/chat/:chatId/toggle', authMiddleware, lessonChatController.toggleChat);
router.delete('/admin/chat/:chatId/history', authMiddleware, lessonChatController.clearHistory);
router.get('/admin/chat/:chatId/analytics', authMiddleware, lessonChatController.getAnalytics);

module.exports = router;
