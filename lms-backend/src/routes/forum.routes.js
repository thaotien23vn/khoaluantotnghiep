const express = require('express');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');
const forumController = require('../controllers/forum.controller');

const router = express.Router();

// Public read routes
router.get('/topics', forumController.listTopics);
router.get('/stats', forumController.getForumStats);
router.get('/top-contributors', forumController.getTopContributors);
router.post('/topics', authMiddleware, forumController.createTopic);
router.get('/topics/:id', forumController.getTopicDetails);
router.put('/topics/:topicId', authMiddleware, forumController.editTopic);
router.put('/topics/:topicId/lock', authMiddleware, authorizeRole('admin'), forumController.lockTopic);
router.delete('/topics/:topicId', authMiddleware, forumController.deleteTopic);

router.post('/topics/:topicId/posts', authMiddleware, forumController.createPost);

router.put('/posts/:postId/solution', authMiddleware, forumController.markAsSolution);

// FE expects POST /forum/posts/:id/like
router.post('/posts/:postId/like', authMiddleware, forumController.toggleLike);

router.put('/posts/:postId', authMiddleware, forumController.editPost);
router.delete('/posts/:postId', authMiddleware, forumController.deletePost);

router.post('/posts/:postId/report', authMiddleware, forumController.reportPost);
router.post('/topics/:topicId/report', authMiddleware, forumController.reportTopic);

// Admin/Teacher moderation
router.get('/reports', authMiddleware, authorizeRole('admin', 'teacher'), forumController.getReports);
router.put('/reports/:reportId/status', authMiddleware, authorizeRole('admin', 'teacher'), forumController.updateReportStatus);

// Admin: ban/unban a user from forum
router.put(
  '/admin/users/:userId/ban-forum',
  authMiddleware,
  authorizeRole('admin'),
  forumController.banUserForum
);

module.exports = router;
