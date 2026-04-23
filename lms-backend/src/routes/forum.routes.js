const express = require('express');
const authMiddleware = require('../middlewares/auth');
const { authorizeRole } = require('../middlewares/authorize');
const forumController = require('../modules/forum/forum.controller');
const {
  listTopicsValidation,
  createTopicValidation,
  getTopicValidation,
  createPostValidation,
  toggleLikeValidation,
  markAsSolutionValidation,
  deleteTopicValidation,
  deletePostValidation,
  editTopicValidation,
  lockTopicValidation,
  editPostValidation,
  reportPostValidation,
  reportTopicValidation,
  updateReportStatusValidation,
  banUserForumValidation,
} = require('../modules/forum/forum.validation');

const router = express.Router();

// Public read routes
router.get('/topics', listTopicsValidation, forumController.listTopics);
router.get('/stats', forumController.getForumStats);
router.get('/top-contributors', forumController.getTopContributors);
router.post('/topics', authMiddleware, createTopicValidation, forumController.createTopic);
router.get('/topics/:id', getTopicValidation, forumController.getTopicDetails);
router.put('/topics/:topicId', authMiddleware, editTopicValidation, forumController.editTopic);
router.put('/topics/:topicId/lock', authMiddleware, authorizeRole('admin'), lockTopicValidation, forumController.lockTopic);
router.delete('/topics/:topicId', authMiddleware, deleteTopicValidation, forumController.deleteTopic);

router.post('/topics/:topicId/posts', authMiddleware, forumController.createPost);

router.put('/posts/:postId/solution', authMiddleware, markAsSolutionValidation, forumController.markAsSolution);

// FE expects POST /forum/posts/:id/like
router.post('/posts/:postId/like', authMiddleware, toggleLikeValidation, forumController.toggleLike);

router.put('/posts/:postId', authMiddleware, editPostValidation, forumController.editPost);
router.delete('/posts/:postId', authMiddleware, deletePostValidation, forumController.deletePost);

router.post('/posts/:postId/report', authMiddleware, reportPostValidation, forumController.reportPost);
router.post('/topics/:topicId/report', authMiddleware, reportTopicValidation, forumController.reportTopic);

// Admin/Teacher moderation
router.get('/reports', authMiddleware, authorizeRole('admin', 'teacher'), forumController.getReports);
router.put('/reports/:reportId/status', authMiddleware, authorizeRole('admin', 'teacher'), updateReportStatusValidation, forumController.updateReportStatus);

// Admin: ban/unban a user from forum
router.put(
  '/admin/users/:userId/ban-forum',
  authMiddleware,
  authorizeRole('admin'),
  banUserForumValidation,
  forumController.banUserForum
);

module.exports = router;
