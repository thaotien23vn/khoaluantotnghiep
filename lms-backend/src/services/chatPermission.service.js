const db = require('../models');
const { Op } = require('sequelize');

const { ChatPermission, User } = db.models;

class ChatPermissionService {
  /**
   * Check if user has permission to chat
   * Priority: user-specific > lecture > course > role > global
   */
  async canChat(userId, courseId, lectureId, role) {
    try {
      // Check user-specific permission first
      const userSpecific = await ChatPermission.findOne({
        where: {
          userId,
          isDeleted: false,
          [Op.or]: [
            { lectureId: lectureId || null },
            { courseId: courseId || null },
          ],
        },
        order: [['createdAt', 'DESC']],
      });

      if (userSpecific) {
        if (!userSpecific.canChat) return { allowed: false, reason: 'Bạn bị cấm chat' };
        if (userSpecific.mutedUntil && new Date() < new Date(userSpecific.mutedUntil)) {
          return {
            allowed: false,
            reason: `Bạn bị mute đến ${userSpecific.mutedUntil}`,
            mutedUntil: userSpecific.mutedUntil,
          };
        }
        return { allowed: true };
      }

      // Check lecture-level permission
      if (lectureId) {
        const lecturePerm = await ChatPermission.findOne({
          where: {
            lectureId,
            userId: null,
            isDeleted: false,
          },
        });
        if (lecturePerm) {
          if (!lecturePerm.canChat) return { allowed: false, reason: 'Chat bị tắt ở bài học này' };
          return { allowed: true };
        }
      }

      // Check course-level permission
      if (courseId) {
        const coursePerm = await ChatPermission.findOne({
          where: {
            courseId,
            lectureId: null,
            userId: null,
            isDeleted: false,
          },
        });
        if (coursePerm) {
          if (!coursePerm.canChat) return { allowed: false, reason: 'Chat bị tắt ở khóa học này' };
          return { allowed: true };
        }
      }

      // Check role-level permission
      if (role) {
        const rolePerm = await ChatPermission.findOne({
          where: {
            role,
            courseId: null,
            lectureId: null,
            userId: null,
            isDeleted: false,
          },
        });
        if (rolePerm) {
          if (!rolePerm.canChat) return { allowed: false, reason: `Role ${role} bị cấm chat` };
          return { allowed: true };
        }
      }

      // Default: allow chat
      return { allowed: true };
    } catch (error) {
      console.error('canChat error:', error);
      return { allowed: false, reason: 'Lỗi kiểm tra quyền chat' };
    }
  }

  /**
   * Mute a user
   */
  async muteUser(adminId, { userId, courseId, lectureId, durationMinutes, reason }) {
    try {
      const mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

      const [permission, created] = await ChatPermission.findOrCreate({
        where: {
          userId,
          courseId: courseId || null,
          lectureId: lectureId || null,
          isDeleted: false,
        },
        defaults: {
          canChat: true,
          mutedUntil,
          mutedBy: adminId,
          muteReason: reason,
        },
      });

      if (!created) {
        await permission.update({
          mutedUntil,
          mutedBy: adminId,
          muteReason: reason,
        });
      }

      return {
        success: true,
        userId,
        mutedUntil,
        reason,
        message: `User ${userId} bị mute đến ${mutedUntil.toISOString()}`,
      };
    } catch (error) {
      console.error('muteUser error:', error);
      throw error;
    }
  }

  /**
   * Unmute a user
   */
  async unmuteUser(adminId, { userId, courseId, lectureId }) {
    try {
      const permission = await ChatPermission.findOne({
        where: {
          userId,
          courseId: courseId || null,
          lectureId: lectureId || null,
          isDeleted: false,
        },
      });

      if (!permission) {
        return { success: false, message: 'Không tìm thấy quyền chat' };
      }

      await permission.update({
        mutedUntil: null,
        mutedBy: null,
        muteReason: null,
      });

      return {
        success: true,
        userId,
        message: `Đã bỏ mute cho user ${userId}`,
      };
    } catch (error) {
      console.error('unmuteUser error:', error);
      throw error;
    }
  }

  /**
   * Ban/Unban chat for role/course/lecture
   */
  async setChatPermission(adminId, { role, courseId, lectureId, canChat, reason }) {
    try {
      const whereClause = {
        isDeleted: false,
      };
      if (role) whereClause.role = role;
      if (courseId) whereClause.courseId = courseId;
      if (lectureId) whereClause.lectureId = lectureId;

      // If all null, it's a global setting
      if (!role && !courseId && !lectureId) {
        return { success: false, message: 'Phải chỉ định ít nhất role, courseId hoặc lectureId' };
      }

      const [permission, created] = await ChatPermission.findOrCreate({
        where: whereClause,
        defaults: {
          canChat,
          mutedBy: adminId,
          muteReason: reason,
        },
      });

      if (!created) {
        await permission.update({
          canChat,
          mutedBy: canChat ? null : adminId,
          muteReason: canChat ? null : reason,
        });
      }

      return {
        success: true,
        role,
        courseId,
        lectureId,
        canChat,
        message: canChat ? 'Đã bật chat' : 'Đã tắt chat',
      };
    } catch (error) {
      console.error('setChatPermission error:', error);
      throw error;
    }
  }

  /**
   * Get chat permissions list
   */
  async getChatPermissions({ userId, courseId, lectureId, role, page = 1, limit = 20 }) {
    try {
      const whereClause = { isDeleted: false };
      if (userId) whereClause.userId = userId;
      if (courseId) whereClause.courseId = courseId;
      if (lectureId) whereClause.lectureId = lectureId;
      if (role) whereClause.role = role;

      const { count, rows } = await ChatPermission.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email'],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset: (page - 1) * limit,
      });

      return {
        permissions: rows,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      console.error('getChatPermissions error:', error);
      throw error;
    }
  }

  /**
   * Soft delete a permission (admin only)
   */
  async deletePermission(adminId, permissionId) {
    try {
      const permission = await ChatPermission.findByPk(permissionId);
      if (!permission) {
        return { success: false, message: 'Không tìm thấy permission' };
      }

      await permission.update({
        isDeleted: true,
        deletedBy: adminId,
        deletedAt: new Date(),
      });

      return { success: true, message: 'Đã xóa permission' };
    } catch (error) {
      console.error('deletePermission error:', error);
      throw error;
    }
  }
}

module.exports = new ChatPermissionService();
