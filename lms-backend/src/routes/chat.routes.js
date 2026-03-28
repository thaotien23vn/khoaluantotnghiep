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

// Admin routes
router.get('/admin/lessons/:lessonId/chat', authMiddleware, getChatValidation, lessonChatController.getChat);
router.get('/admin/chat/escalations', authMiddleware, lessonChatController.getEscalations);
router.post('/admin/chat/:chatId/reply', authMiddleware, replyMessageValidation, lessonChatController.reply);

module.exports = router;
