const db = require('../models');
const { ForumTopic, ForumPost, ForumReport, User } = db.models;
const { Op } = require('sequelize');
const { getIO } = require('../socket');

async function requireNotBanned(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return true;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'chatBannedUntil', 'chatBanReason'],
    });
    if (!user) return true;

    const until = user.chatBannedUntil;
    if (!until) return true;
    const d = new Date(until);
    if (Number.isNaN(d.getTime())) return true;
    if (d.getTime() <= Date.now()) return true;

    res.status(403).json({
      success: false,
      message: 'Bạn đang bị cấm sử dụng diễn đàn',
      data: {
        chatBannedUntil: until,
        chatBanReason: user.chatBanReason || null,
      },
    });
    return false;
  } catch (e) {
    // If ban check fails, do not block core forum features.
    return true;
  }
}

exports.listTopics = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, courseId, lectureId, q } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where = {};
    if (type) where.type = type;
    if (courseId) where.courseId = Number(courseId);
    if (lectureId) where.lectureId = Number(lectureId);
    if (q) {
      where[Op.or] = [
        { title: { [Op.like]: `%${q}%` } },
        { content: { [Op.like]: `%${q}%` } },
      ];
    }

    const { count, rows } = await ForumTopic.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'name', 'avatar', 'role'],
        },
      ],
      order: [
        ['isPinned', 'DESC'],
        [db.sequelize.col('ForumTopic.updated_at'), 'DESC'],
        ['id', 'DESC'],
      ],
      limit: Number(limit),
      offset,
    });

    res.json({
      success: true,
      data: {
        topics: rows,
        pagination: {
          total: count,
          page: Number(page),
          totalPages: Math.ceil(count / Number(limit) || 1),
        },
      },
    });
  } catch (error) {
    console.error('List forum topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

exports.getForumStats = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [topicCount, participantRows, postsToday] = await Promise.all([
      ForumTopic.count(),
      ForumPost.findAll({
        attributes: [[db.sequelize.fn('DISTINCT', db.sequelize.col('user_id')), 'userId']],
        raw: true,
      }),
      ForumPost.count({
        where: {
          [Op.and]: [
            db.sequelize.where(db.sequelize.col('ForumPost.created_at'), { [Op.gte]: startOfToday }),
          ],
        },
      }),
    ]);

    const participantCount = Array.isArray(participantRows) ? participantRows.length : 0;

    return res.json({
      success: true,
      data: {
        topicCount,
        participantCount,
        postsToday,
      },
    });
  } catch (error) {
    console.error('Get forum stats error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.getTopContributors = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 3) || 3, 20);

    const rows = await ForumPost.findAll({
      attributes: [
        'userId',
        [db.sequelize.fn('COUNT', db.sequelize.col('ForumPost.id')), 'postCount'],
      ],
      include: [
        { model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] },
      ],
      group: ['userId', 'author.id'],
      order: [[db.sequelize.literal('postCount'), 'DESC']],
      limit,
      subQuery: false,
    });

    const contributors = (rows || []).map((r) => ({
      userId: r.userId,
      postCount: Number(r.get('postCount') || 0),
      author: r.author,
    }));

    return res.json({
      success: true,
      data: { contributors },
    });
  } catch (error) {
    console.error('Get top contributors error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.createTopic = async (req, res) => {
  try {
    if (!(await requireNotBanned(req, res))) return;

    const { title, content, type, courseId, lectureId } = req.body;

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

    if (normalizedType === 'course' && !finalCourseId) {
      return res.status(400).json({ success: false, message: 'courseId không hợp lệ' });
    }
    if (normalizedType === 'lecture' && !finalLectureId) {
      return res.status(400).json({ success: false, message: 'lectureId không hợp lệ' });
    }

    const topic = await ForumTopic.create({
      title,
      content,
      type: normalizedType,
      courseId: finalCourseId,
      lectureId: finalLectureId,
      userId: req.user.id,
      views: 0,
      postCount: 0,
      isPinned: false,
      isLocked: false,
    });

    const full = await ForumTopic.findByPk(topic.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
    });

    res.status(201).json({ success: true, data: full });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.getTopicDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const topic = await ForumTopic.findByPk(id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
    });

    if (!topic) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chủ đề' });
    }

    await topic.increment('views');

    const posts = await ForumPost.findAll({
      where: { topicId: topic.id },
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
      order: [
        ['parentId', 'ASC'],
        [db.sequelize.col('ForumPost.created_at'), 'ASC'],
        ['id', 'ASC'],
      ],
    });

    res.json({
      success: true,
      data: {
        topic,
        posts,
      },
    });
  } catch (error) {
    console.error('Get topic details error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.createPost = async (req, res) => {
  try {
    if (!(await requireNotBanned(req, res))) return;

    const { topicId } = req.params;
    const { content, parentId } = req.body;

    const topic = await ForumTopic.findByPk(topicId);
    if (!topic) return res.status(404).json({ success: false, message: 'Không tìm thấy chủ đề' });
    if (topic.isLocked) return res.status(403).json({ success: false, message: 'Chủ đề đã bị khóa' });

    if (parentId) {
      const parent = await ForumPost.findOne({ where: { id: parentId, topicId: topic.id } });
      if (!parent) return res.status(400).json({ success: false, message: 'parentId không hợp lệ' });
    }

    const post = await ForumPost.create({
      topicId: topic.id,
      content,
      userId: req.user.id,
      parentId: parentId ? Number(parentId) : null,
      isSolution: false,
      likes: 0,
    });

    await topic.increment('postCount');

    const full = await ForumPost.findByPk(post.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
    });

    res.status(201).json({ success: true, data: full });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    if (!(await requireNotBanned(req, res))) return;

    const { postId } = req.params;
    const post = await ForumPost.findByPk(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận' });

    // Simplified: toggle based on client-side state is not persisted.
    // We only increment/decrement likes with bounds.
    const action = String(req.query.action || '').toLowerCase();
    if (action === 'unlike') {
      await post.decrement('likes');
      await post.reload();
      if (post.likes < 0) {
        await post.update({ likes: 0 });
      }
      return res.json({ success: true, data: { action: 'unliked', likes: post.likes } });
    }

    await post.increment('likes');
    await post.reload();
    return res.json({ success: true, data: { action: 'liked', likes: post.likes } });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.markAsSolution = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await ForumPost.findByPk(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận' });

    const topic = await ForumTopic.findByPk(post.topicId);
    if (!topic) return res.status(404).json({ success: false, message: 'Không tìm thấy chủ đề' });

    // only topic author or admin/teacher can mark
    if (String(topic.userId) !== String(req.user.id) && !['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    // reset other solutions
    await ForumPost.update({ isSolution: false }, { where: { topicId: topic.id } });
    await post.update({ isSolution: true });

    res.json({ success: true });
  } catch (error) {
    console.error('Mark solution error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.deleteTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const topic = await ForumTopic.findByPk(topicId);
    if (!topic) return res.status(404).json({ success: false, message: 'Không tìm thấy chủ đề' });

    if (String(topic.userId) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    await ForumPost.destroy({ where: { topicId: topic.id } });
    await ForumReport.destroy({ where: { topicId: topic.id } });
    await topic.destroy();

    res.json({ success: true });
  } catch (error) {
    console.error('Delete topic error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await ForumPost.findByPk(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận' });

    if (String(post.userId) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    await ForumReport.destroy({ where: { postId: post.id } });
    await post.destroy();

    // keep topic postCount in sync (best-effort)
    await ForumTopic.increment({ postCount: -1 }, { where: { id: post.topicId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.editTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const { title, content } = req.body;

    const topic = await ForumTopic.findByPk(topicId);
    if (!topic) return res.status(404).json({ success: false, message: 'Không tìm thấy chủ đề' });

    if (String(topic.userId) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    await topic.update({
      ...(title != null ? { title } : {}),
      ...(content != null ? { content } : {}),
    });

    const full = await ForumTopic.findByPk(topic.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
    });

    res.json({ success: true, data: full });
  } catch (error) {
    console.error('Edit topic error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.lockTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const { isLocked } = req.body;

    const topic = await ForumTopic.findByPk(topicId);
    if (!topic) return res.status(404).json({ success: false, message: 'Không tìm thấy chủ đề' });

    await topic.update({ isLocked });

    res.json({ success: true, data: { isLocked } });
  } catch (error) {
    console.error('Lock topic error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.editPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;

    const post = await ForumPost.findByPk(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận' });

    if (String(post.userId) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    await post.update({ content });

    const full = await ForumPost.findByPk(post.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'avatar', 'role'] }],
    });

    res.json({ success: true, data: full });
  } catch (error) {
    console.error('Edit post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.reportPost = async (req, res) => {
  try {
    if (!(await requireNotBanned(req, res))) return;

    const { postId } = req.params;
    const { reason, category } = req.body;

    const post = await ForumPost.findByPk(postId);
    if (!post) return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận' });

    const report = await ForumReport.create({
      postId: post.id,
      topicId: null,
      reporterId: req.user.id,
      reason,
      status: 'pending',
    });

    // Realtime notify admins (skip if reporter is admin)
    if (req.user.role?.toUpperCase() !== 'ADMIN') {
      try {
        const io = getIO();
        io.emit('new_report', { type: 'post', postId: post.id, reason, category });
      } catch {
        // ignore if socket not initialized
      }
    }

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    console.error('Report post error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.reportTopic = async (req, res) => {
  try {
    if (!(await requireNotBanned(req, res))) return;

    const { topicId } = req.params;
    const { reason, category } = req.body;

    const topic = await ForumTopic.findByPk(topicId);
    if (!topic) return res.status(404).json({ success: false, message: 'Không tìm thấy chủ đề' });

    const report = await ForumReport.create({
      topicId: topic.id,
      postId: null,
      reporterId: req.user.id,
      reason,
      status: 'pending',
    });

    // Realtime notify admins (skip if reporter is admin)
    if (req.user.role?.toUpperCase() !== 'ADMIN') {
      try {
        const io = getIO();
        io.emit('new_report', { type: 'topic', topicId: topic.id, reason, category });
      } catch {
        // ignore
      }
    }

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    console.error('Report topic error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const { status } = req.query;
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

    res.json({
      success: true,
      data: {
        reports,
        pagination: { total: reports.length, page: 1, totalPages: 1 },
      },
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;

    const report = await ForumReport.findByPk(reportId);
    if (!report) return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo' });

    await report.update({ status });
    res.json({ success: true });
  } catch (error) {
    console.error('Update report status error:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.banUserForum = async (req, res) => {
  try {
    const { userId } = req.params;
    const { chatBannedUntil, chatBanReason } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }

    // These fields may not exist in schema; update only if present.
    const updateData = {};
    if (Object.prototype.hasOwnProperty.call(user.toJSON(), 'chatBannedUntil')) {
      updateData.chatBannedUntil = chatBannedUntil || null;
    }
    if (Object.prototype.hasOwnProperty.call(user.toJSON(), 'chatBanReason')) {
      updateData.chatBanReason = chatBanReason || null;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Schema user chưa có field chatBannedUntil/chatBanReason',
      });
    }

    await user.update(updateData);

    return res.json({
      success: true,
      data: {
        id: user.id,
        chatBannedUntil: user.chatBannedUntil,
        chatBanReason: user.chatBanReason,
      },
    });
  } catch (error) {
    console.error('Ban user forum error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};
