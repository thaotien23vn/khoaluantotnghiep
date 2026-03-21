const { validationResult } = require('express-validator');
const forumService = require('./forum.service');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array(),
    });
  }
  return null;
};

/**
 * Handle service errors
 */
const handleServiceError = (error, res) => {
  if (error.status && error.message) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }
  console.error('Lỗi:', error);
  return res.status(500).json({
    success: false,
    message: 'Lỗi máy chủ',
    error: error.message,
  });
};

/**
 * Check if user is banned
 */
const requireNotBanned = async (req, res) => {
  const db = require('../../models');
  const { User } = db.models;
  const user = await User.findByPk(req.user.id, { attributes: ['id', 'chatBannedUntil', 'chatBanReason'] });
  const now = new Date();
  if (user?.chatBannedUntil && new Date(user.chatBannedUntil) > now) {
    res.status(403).json({
      success: false,
      message: 'Tài khoản đã bị cấm chat',
      data: { bannedUntil: user.chatBannedUntil, reason: user.chatBanReason },
    });
    return false;
  }
  return true;
};

/**
 * Forum Controller - HTTP request handling
 */
class ForumController {
  async listTopics(req, res) {
    try {
      const result = await forumService.listTopics(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getForumStats(req, res) {
    try {
      const result = await forumService.getForumStats();
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getTopContributors(req, res) {
    try {
      const result = await forumService.getTopContributors(req.query.limit);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async createTopic(req, res) {
    try {
      if (!(await requireNotBanned(req, res))) return;

      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await forumService.createTopic(req.user.id, req.body);
      res.status(201).json({ success: true, data: result.topic });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getTopicDetails(req, res) {
    try {
      const result = await forumService.getTopicDetails(req.params.id);
      res.json({ success: true, data: { topic: result.topic, posts: result.posts } });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async createPost(req, res) {
    try {
      if (!(await requireNotBanned(req, res))) return;

      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const topicId = parseInt(req.params.topicId, 10);
      const result = await forumService.createPost(req.user.id, topicId, req.body);
      res.status(201).json({ success: true, data: result.post });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async toggleLike(req, res) {
    try {
      if (!(await requireNotBanned(req, res))) return;

      const result = await forumService.toggleLike(req.params.postId, req.query.action);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async markAsSolution(req, res) {
    try {
      const result = await forumService.markAsSolution(req.user.id, req.user.role, req.params.postId);
      res.json(result);
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async deleteTopic(req, res) {
    try {
      const result = await forumService.deleteTopic(req.user.id, req.user.role, req.params.topicId);
      res.json(result);
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async deletePost(req, res) {
    try {
      const result = await forumService.deletePost(req.user.id, req.user.role, req.params.postId);
      res.json(result);
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async editTopic(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await forumService.editTopic(req.user.id, req.user.role, req.params.topicId, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async lockTopic(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await forumService.lockTopic(req.params.topicId, req.body.isLocked);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async editPost(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await forumService.editPost(req.user.id, req.user.role, req.params.postId, req.body.content);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async reportPost(req, res) {
    try {
      if (!(await requireNotBanned(req, res))) return;

      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await forumService.reportPost(req.user.id, req.user.role, req.params.postId, req.body.reason, req.body.category);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async reportTopic(req, res) {
    try {
      if (!(await requireNotBanned(req, res))) return;

      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await forumService.reportTopic(req.user.id, req.user.role, req.params.topicId, req.body.reason, req.body.category);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async getReports(req, res) {
    try {
      const result = await forumService.getReports(req.query.status);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async updateReportStatus(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await forumService.updateReportStatus(req.params.reportId, req.body.status);
      res.json(result);
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  async banUserForum(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await forumService.banUserForum(req.params.userId, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new ForumController();
