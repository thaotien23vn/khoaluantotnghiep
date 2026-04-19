const { Op, literal } = require('sequelize');
const db = require('../../models');
const notificationService = require('../notification/notification.service');
const EnrollmentAccess = require('../enrollment/enrollment.access');

const { ForumTopic, ForumPost, ForumReport, User, Lecture } = db.models;

// Helpers
const getIO = () => {
  try {
    return require('../../socket').getIO();
  } catch {
    return null;
  }
};

/**
 * Forum Service - Business logic for forum operations
 */
class ForumService {
  async listTopics(query) {
    const { type, courseId, lectureId, sort = 'newest', page = 1, limit = 20 } = query;
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const where = {};
    if (type) where.type = type;
    if (courseId) where.courseId = Number(courseId);
    if (lectureId) where.lectureId = Number(lectureId);

    // Access check for course-bound topics
    if (query.userId && query.userRole !== 'admin') {
      const targetCourseId = courseId || (lectureId ? (await Lecture.findByPk(lectureId))?.chapter?.courseId : null);
      if (targetCourseId) {
        const access = await EnrollmentAccess.checkAccess(query.userId, targetCourseId);
        if (!access.hasAccess) {
          return { topics: [], meta: { total: 0, page, limit, totalPages: 0 }, message: access.message };
        }
      }
    }

    const order = (() => {
      switch (sort) {
        case 'oldest': return [['id', 'ASC']];
        case 'most_viewed': return [['views', 'DESC'], ['id', 'DESC']];
        case 'most_posts': return [['postCount', 'DESC'], ['id', 'DESC']];
        case 'newest':
        default: return [[db.sequelize.col('ForumTopic.created_at'), 'DESC'], ['id', 'DESC']];
      }
    })();

    const total = await ForumTopic.count({ where });
    const topics = await ForumTopic.findAll({
      where,
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
      order,
      limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
      offset,
    });

    return { topics, meta: { total, page, limit, totalPages: Math.ceil(total / (Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100))) } };
  }

  async getForumStats() {
    const topicCount = await ForumTopic.count();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [participantRows, postsToday] = await Promise.all([
      ForumPost.findAll({
        attributes: [[db.sequelize.fn('DISTINCT', db.sequelize.col('user_id')), 'userId']],
        raw: true,
      }),
      ForumPost.count({
        where: { [Op.and]: [db.sequelize.where(db.sequelize.col('ForumPost.created_at'), { [Op.gte]: startOfToday })] },
      }),
    ]);

    return { topicCount, participantCount: Array.isArray(participantRows) ? participantRows.length : 0, postsToday };
  }

  async getTopContributors(limit = 3) {
    const limitNum = Math.min(Number(limit) || 3, 20);

    const rows = await ForumPost.findAll({
      attributes: ['userId', [db.sequelize.fn('COUNT', db.sequelize.col('ForumPost.id')), 'postCount']],
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
      group: ['userId', 'author.id'],
      order: [[db.sequelize.literal('"postCount"'), 'DESC']],
      limit: limitNum,
      subQuery: false,
    });

    const contributors = (rows || []).map((r) => ({
      userId: r.userId,
      postCount: Number(r.get('postCount') || 0),
      author: r.author,
    }));

    return { contributors };
  }

  async createTopic(userId, topicData) {
    const { title, content, type, courseId, lectureId } = topicData;
    const normalizedType = type || 'global';

    const toIntOrNull = (v) => {
      if (v === '' || v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const parsedCourseId = toIntOrNull(courseId);
    const parsedLectureId = toIntOrNull(lectureId);

    const finalCourseId = normalizedType === 'course' ? parsedCourseId : null;
    const finalLectureId = normalizedType === 'lecture' ? parsedLectureId : null;

    if (normalizedType === 'course' && !finalCourseId) throw { status: 400, message: 'courseId không hợp lệ' };
    if (normalizedType === 'lecture' && !finalLectureId) throw { status: 400, message: 'lectureId không hợp lệ' };

    // Enrollment access check
    let accessCourseId = finalCourseId;
    if (normalizedType === 'lecture' && finalLectureId) {
      const lecture = await Lecture.findByPk(finalLectureId, {
        include: [{ model: db.models.Chapter, as: 'chapter', attributes: ['courseId'] }]
      });
      accessCourseId = lecture?.chapter?.courseId || null;
    }

    if (accessCourseId) {
      const access = await EnrollmentAccess.checkAccess(userId, accessCourseId);
      if (!access.hasAccess) {
        throw { status: 403, message: access.message || 'Bạn không có quyền tham gia diễn đàn này' };
      }
    }

    const topic = await ForumTopic.create({
      title,
      content,
      type: normalizedType,
      courseId: finalCourseId,
      lectureId: finalLectureId,
      userId,
      views: 0,
      postCount: 0,
      isPinned: false,
      isLocked: false,
    });

    const full = await ForumTopic.findByPk(topic.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
    });

    return { topic: full };
  }

  async getTopicDetails(id, userId, userRole) {
    const topic = await ForumTopic.findByPk(id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
    });

    if (!topic) throw { status: 404, message: 'Không tìm thấy chủ đề' };

    // Access check for course-bound topics
    if (userRole !== 'admin' && topic.type !== 'global' && topic.courseId) {
      const access = await EnrollmentAccess.checkAccess(userId, topic.courseId);
      if (!access.hasAccess) {
        throw { status: 403, message: access.message || 'Bạn không có quyền xem chủ đề này' };
      }
    }

    await topic.increment('views');

    const posts = await ForumPost.findAll({
      where: { topicId: topic.id },
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
      order: [['parentId', 'ASC'], [db.sequelize.col('ForumPost.created_at'), 'ASC'], ['id', 'ASC']],
    });

    return { topic, posts };
  }

  async createPost(userId, topicId, postData) {
    const { content, parentId } = postData;

    const topic = await ForumTopic.findByPk(topicId);
    if (!topic) throw { status: 404, message: 'Không tìm thấy chủ đề' };
    if (topic.isLocked) throw { status: 403, message: 'Chủ đề đã bị khóa' };

    // Access check
    if (topic.type !== 'global' && topic.courseId) {
      const access = await EnrollmentAccess.checkAccess(userId, topic.courseId);
      if (!access.hasAccess) {
        throw { status: 403, message: access.message || 'Bạn đã hết hạn quyền tham gia diễn đàn của khóa học này' };
      }
    }

    if (parentId) {
      const parent = await ForumPost.findOne({ where: { id: parentId, topicId: topic.id } });
      if (!parent) throw { status: 400, message: 'parentId không hợp lệ' };
    }

    const post = await ForumPost.create({
      topicId: topic.id,
      content,
      userId,
      parentId: parentId ? Number(parentId) : null,
      isSolution: false,
      likes: 0,
    });

    await topic.increment('postCount');

    const full = await ForumPost.findByPk(post.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
    });

    // If it's a reply (has parentId), notify the parent post author
    if (parentId) {
      const parentPost = await ForumPost.findByPk(parentId);
      if (parentPost && parentPost.userId !== userId) {
        await notificationService.createNotification({
          userId: parentPost.userId,
          title: 'Có người phản hồi bình luận của bạn',
          message: `Có người đã phản hồi bình luận của bạn trong chủ đề "${topic.title}"`,
          type: 'forum_reply',
          payload: { 
            topicId: topic.id, 
            topicTitle: topic.title,
            postId: post.id,
            parentId: parentId
          },
        });
      }
    }

    return { post: full };
  }

  async toggleLike(postId, action) {
    const post = await ForumPost.findByPk(postId);
    if (!post) throw { status: 404, message: 'Không tìm thấy bình luận' };

    const actionStr = String(action || '').toLowerCase();
    if (actionStr === 'unlike') {
      await post.decrement('likes');
      await post.reload();
      if (post.likes < 0) await post.update({ likes: 0 });
      return { action: 'unliked', likes: post.likes };
    }

    await post.increment('likes');
    await post.reload();
    return { action: 'liked', likes: post.likes };
  }

  async markAsSolution(userId, userRole, postId) {
    const post = await ForumPost.findByPk(postId);
    if (!post) throw { status: 404, message: 'Không tìm thấy bình luận' };

    const topic = await ForumTopic.findByPk(post.topicId);
    if (!topic) throw { status: 404, message: 'Không tìm thấy chủ đề' };

    if (String(topic.userId) !== String(userId) && !['admin', 'teacher'].includes(userRole)) {
      throw { status: 403, message: 'Không có quyền' };
    }

    await ForumPost.update({ isSolution: false }, { where: { topicId: topic.id } });
    await post.update({ isSolution: true });

    return { success: true };
  }

  async deleteTopic(userId, userRole, topicId) {
    const topic = await ForumTopic.findByPk(topicId);
    if (!topic) throw { status: 404, message: 'Không tìm thấy chủ đề' };

    if (String(topic.userId) !== String(userId) && userRole !== 'admin') {
      throw { status: 403, message: 'Không có quyền' };
    }

    await ForumPost.destroy({ where: { topicId: topic.id } });
    await ForumReport.destroy({ where: { topicId: topic.id } });
    await topic.destroy();

    return { success: true };
  }

  async deletePost(userId, userRole, postId) {
    const post = await ForumPost.findByPk(postId);
    if (!post) throw { status: 404, message: 'Không tìm thấy bình luận' };

    if (String(post.userId) !== String(userId) && userRole !== 'admin') {
      throw { status: 403, message: 'Không có quyền' };
    }

    await ForumReport.destroy({ where: { postId: post.id } });
    await post.destroy();
    await ForumTopic.increment({ postCount: -1 }, { where: { id: post.topicId } });

    return { success: true };
  }

  async editTopic(userId, userRole, topicId, updateData) {
    const { title, content } = updateData;
    const topic = await ForumTopic.findByPk(topicId);
    if (!topic) throw { status: 404, message: 'Không tìm thấy chủ đề' };

    if (String(topic.userId) !== String(userId) && userRole !== 'admin') {
      throw { status: 403, message: 'Không có quyền' };
    }

    await topic.update({
      ...(title != null ? { title } : {}),
      ...(content != null ? { content } : {}),
    });

    const full = await ForumTopic.findByPk(topic.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
    });

    return { topic: full };
  }

  async lockTopic(topicId, isLocked) {
    const topic = await ForumTopic.findByPk(topicId);
    if (!topic) throw { status: 404, message: 'Không tìm thấy chủ đề' };

    await topic.update({ isLocked });
    return { isLocked };
  }

  async editPost(userId, userRole, postId, content) {
    const post = await ForumPost.findByPk(postId);
    if (!post) throw { status: 404, message: 'Không tìm thấy bình luận' };

    if (String(post.userId) !== String(userId) && userRole !== 'admin') {
      throw { status: 403, message: 'Không có quyền' };
    }

    await post.update({ content });

    const full = await ForumPost.findByPk(post.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
    });

    return { post: full };
  }

  async reportPost(userId, userRole, postId, reason, category) {
    const post = await ForumPost.findByPk(postId);
    if (!post) throw { status: 404, message: 'Không tìm thấy bình luận' };

    const report = await ForumReport.create({
      postId: post.id,
      topicId: null,
      reporterId: userId,
      reason,
      status: 'pending',
    });

    if (userRole?.toUpperCase() !== 'ADMIN') {
      const io = getIO();
      if (io) io.emit('new_report', { type: 'post', postId: post.id, reason, category });
    }

    return { report };
  }

  async reportTopic(userId, userRole, topicId, reason, category) {
    const topic = await ForumTopic.findByPk(topicId);
    if (!topic) throw { status: 404, message: 'Không tìm thấy chủ đề' };

    const report = await ForumReport.create({
      topicId: topic.id,
      postId: null,
      reporterId: userId,
      reason,
      status: 'pending',
    });

    if (userRole?.toUpperCase() !== 'ADMIN') {
      const io = getIO();
      if (io) io.emit('new_report', { type: 'topic', topicId: topic.id, reason, category });
    }

    return { report };
  }

  async getReports(status) {
    const where = {};
    if (status) where.status = status;

    const reports = await ForumReport.findAll({
      where,
      include: [
        { model: User, as: 'reporter', attributes: ['id', 'name', 'avatar', 'email'] },
        { model: ForumTopic, as: 'topic' },
        { model: ForumPost, as: 'post' },
      ],
      order: [[db.sequelize.col('ForumReport.created_at'), 'DESC'], ['id', 'DESC']],
    });

    return { reports, pagination: { total: reports.length, page: 1, totalPages: 1 } };
  }

  async updateReportStatus(reportId, status) {
    const report = await ForumReport.findByPk(reportId);
    if (!report) throw { status: 404, message: 'Không tìm thấy báo cáo' };

    await report.update({ status });
    return { success: true };
  }

  async banUserForum(userId, banData) {
    const { chatBannedUntil, chatBanReason } = banData;
    const user = await User.findByPk(userId);
    if (!user) throw { status: 404, message: 'Không tìm thấy user' };

    const updateData = {};
    if (Object.prototype.hasOwnProperty.call(user.toJSON(), 'chatBannedUntil')) {
      updateData.chatBannedUntil = chatBannedUntil || null;
    }
    if (Object.prototype.hasOwnProperty.call(user.toJSON(), 'chatBanReason')) {
      updateData.chatBanReason = chatBanReason || null;
    }

    if (Object.keys(updateData).length === 0) {
      throw { status: 500, message: 'Schema user chưa có field chatBannedUntil/chatBanReason' };
    }

    await user.update(updateData);

    return {
      id: user.id,
      chatBannedUntil: user.chatBannedUntil,
      chatBanReason: user.chatBanReason,
    };
  }
}

module.exports = new ForumService();
