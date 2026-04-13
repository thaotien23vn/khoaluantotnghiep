const { models, sequelize } = require('../../models');
const { Tracking, User } = models;
const { Op } = require('sequelize');

class TrackingService {
  // Log a new tracking activity
  async logActivity(data) {
    const {
      userId,
      action,
      page,
      url,
      ipAddress,
      userAgent,
      referrer,
      sessionId,
      metadata,
    } = data;

    const activity = await Tracking.create({
      userId: userId || null,
      action,
      page: page || null,
      url: url || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      referrer: referrer || null,
      sessionId: sessionId || null,
      metadata: metadata || {},
    });

    return activity;
  }

  // Get analytics data
  async getAnalytics({ page = 1, limit = 10, search = '' }) {
    const offset = (page - 1) * limit;

    // Build search condition
    const searchCondition = search
      ? {
          [Op.or]: [
            { action: { [Op.iLike]: `%${search}%` } },
            { page: { [Op.iLike]: `%${search}%` } },
            { ipAddress: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {};

    // Get stats
    const totalViews = await Tracking.count({
      where: { action: 'page_view' },
    });

    const uniqueUsers = await Tracking.count({
      distinct: true,
      col: 'userId',
      where: {
        userId: { [Op.not]: null },
      },
    });

    const uniqueSessions = await Tracking.count({
      distinct: true,
      col: 'sessionId',
      where: {
        sessionId: { [Op.not]: null },
      },
    });

    // Get activities with pagination
    const { count, rows: items } = await Tracking.findAndCountAll({
      where: searchCondition,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'username', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Get page stats
    const pageStatsRaw = await Tracking.findAll({
      attributes: ['page', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: {
        page: { [Op.not]: null },
      },
      group: ['page'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 10,
    });

    const pageStats = pageStatsRaw.map((p) => ({
      page: p.page,
      count: parseInt(p.get('count')),
    }));

    // Get cookie consent stats
    const cookieGranted = await Tracking.count({
      where: { action: 'cookie_consent_granted' },
    });

    const cookieDenied = await Tracking.count({
      where: { action: 'cookie_consent_denied' },
    });

    return {
      stats: {
        totalViews,
        uniqueUsers,
        uniqueSessions,
        cookieConsent: {
          granted: cookieGranted,
          denied: cookieDenied,
        },
      },
      activities: {
        items,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit),
      },
      pageStats,
    };
  }

  // Get recent activities for a specific user
  async getUserActivities(userId, limit = 50) {
    return await Tracking.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
    });
  }

  // Clean old tracking data (for GDPR compliance)
  async cleanOldData(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deleted = await Tracking.destroy({
      where: {
        createdAt: {
          [Op.lt]: cutoffDate,
        },
      },
    });

    return { deletedCount: deleted };
  }
}

module.exports = new TrackingService();
