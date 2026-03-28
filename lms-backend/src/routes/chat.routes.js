const express = require('express');
const router = express.Router();
const lessonChatController = require('../modules/chat/lessonChat.controller');
const {
  getChatValidation,
  sendMessageValidation,
  replyMessageValidation,
} = require('../modules/chat/chat.validation');

// Student routes
router.get('/lessons/:lessonId/chat', getChatValidation, lessonChatController.getChat);
router.post('/chat/:chatId/messages', sendMessageValidation, lessonChatController.sendMessage);

// Teacher routes
router.get('/teacher/lessons/:lessonId/chat', getChatValidation, lessonChatController.getChat);
router.get('/teacher/chat/escalations', lessonChatController.getEscalations);
router.post('/teacher/chat/:chatId/reply', replyMessageValidation, lessonChatController.reply);

// Admin routes
router.get('/admin/lessons/:lessonId/chat', getChatValidation, lessonChatController.getChat);
router.get('/admin/chat/escalations', lessonChatController.getEscalations);
router.post('/admin/chat/:chatId/reply', replyMessageValidation, lessonChatController.reply);

module.exports = router;
