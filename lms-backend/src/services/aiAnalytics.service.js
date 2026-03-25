const db = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const {
  LearningAnalytics,
  UserLearningProfile,
  Course,
  Chapter,
  Lecture,
  Quiz,
  Attempt,
  User,
  Enrollment,
  AiAuditLog,
} = db.models;

class AiAnalyticsService {
  /**
   * Track learning event
   */
  async trackLearningEvent(userId, courseId, eventData) {
    try {
      const {
        eventType,
        lectureId,
        chapterId,
        duration,
        score,
        maxScore,
        attempts = 1,
        difficulty,
        metadata = {},
        deviceType,
        sessionId,
      } = eventData;

      const event = await LearningAnalytics.create({
        userId,
        courseId,
        lectureId,
        chapterId,
        eventType,
        duration,
        score,
        maxScore,
        attempts,
        difficulty,
        metadata,
        deviceType,
        sessionId,
      });

      // Update user profile asynchronously
      this.updateUserProfileFromEvent(userId, courseId, event).catch(err => {
        logger.error('ASYNC_PROFILE_UPDATE_FAILED', {
          userId,
          courseId,
          error: err.message,
        });
      });

      return { event };
    } catch (error) {
      logger.error('LEARNING_EVENT_TRACKING_FAILED', {
        userId,
        courseId,
        eventData,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể track learning event',
        code: 'LEARNING_EVENT_TRACKING_FAILED',
      };
    }
  }

  /**
   * Get user learning analytics
   */
  async getUserLearningAnalytics(userId, courseId, options = {}) {
    try {
      const {
        startDate,
        endDate,
        eventType,
        page = 1,
        limit = 50,
      } = options;

      const where = { userId, courseId };
      if (startDate) {
        where.createdAt = {
          ...where.createdAt,
          [Op.gte]: new Date(startDate),
        };
      }
      if (endDate) {
        where.createdAt = {
          ...where.createdAt,
          [Op.lte]: new Date(endDate),
        };
      }
      if (eventType) where.eventType = eventType;

      const { count, rows } = await LearningAnalytics.findAndCountAll({
        where,
        include: [
          {
            model: Lecture,
            as: 'lecture',
            attributes: ['id', 'title'],
            required: false,
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      // Calculate summary statistics
      const summary = await this.calculateUserSummary(userId, courseId, where);

      return {
        analytics: rows,
        summary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit)),
        },
      };
    } catch (error) {
      logger.error('GET_USER_LEARNING_ANALYTICS_FAILED', {
        userId,
        courseId,
        options,
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw {
        status: 500,
        message: 'Không thể lấy user learning analytics: ' + error.message,
        code: 'GET_USER_LEARNING_ANALYTICS_FAILED',
      };
    }
  }

  /**
   * Get course analytics for teachers/admins
   */
  async getCourseAnalytics(courseId, options = {}) {
    try {
      const {
        startDate,
        endDate,
        groupBy = 'day',
        page = 1,
        limit = 100,
      } = options;

      const where = { courseId };
      if (startDate) {
        where.createdAt = {
          ...where.createdAt,
          [Op.gte]: new Date(startDate),
        };
      }
      if (endDate) {
        where.createdAt = {
          ...where.createdAt,
          [Op.lte]: new Date(endDate),
        };
      }

      // Get enrollment stats
      const enrollmentStats = await this.getCourseEnrollmentStats(courseId);

      // Get engagement metrics
      const engagementMetrics = await this.getCourseEngagementMetrics(courseId, where, groupBy);

      // Get performance metrics
      const performanceMetrics = await this.getCoursePerformanceMetrics(courseId, where);

      // Get at-risk students
      const atRiskStudents = await this.getAtRiskStudents(courseId);

      return {
        enrollmentStats,
        engagementMetrics,
        performanceMetrics,
        atRiskStudents,
      };
    } catch (error) {
      logger.error('GET_COURSE_ANALYTICS_FAILED', {
        courseId,
        options,
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw {
        status: 500,
        message: 'Không thể lấy course analytics: ' + error.message,
        code: 'GET_COURSE_ANALYTICS_FAILED',
      };
    }
  }

  /**
   * Get platform analytics for admins
   */
  async getPlatformAnalytics(options = {}) {
    try {
      const {
        startDate,
        endDate,
        groupBy = 'day',
      } = options;

      const dateFilter = {};
      if (startDate) {
        dateFilter.createdAt = {
          ...dateFilter.createdAt,
          [Op.gte]: new Date(startDate),
        };
      }
      if (endDate) {
        dateFilter.createdAt = {
          ...dateFilter.createdAt,
          [Op.lte]: new Date(endDate),
        };
      }

      // Get user metrics
      const userMetrics = await this.getPlatformUserMetrics(dateFilter);

      // Get course metrics
      const courseMetrics = await this.getPlatformCourseMetrics(dateFilter);

      // Get engagement metrics
      const engagementMetrics = await this.getPlatformEngagementMetrics(dateFilter, groupBy);

      // Get AI usage metrics
      const aiUsageMetrics = await this.getAiUsageMetrics(dateFilter);

      // Get cost metrics
      const costMetrics = await this.getCostMetrics(dateFilter);

      return {
        userMetrics,
        courseMetrics,
        engagementMetrics,
        aiUsageMetrics,
        costMetrics,
      };
    } catch (error) {
      logger.error('GET_PLATFORM_ANALYTICS_FAILED', {
        options,
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw {
        status: 500,
        message: 'Không thể lấy platform analytics: ' + error.message,
        code: 'GET_PLATFORM_ANALYTICS_FAILED',
      };
    }
  }

  /**
   * Calculate user summary statistics
   */
  async calculateUserSummary(userId, courseId, where = {}) {
    try {
      const analytics = await LearningAnalytics.findAll({
        where: { userId, courseId, ...where },
        attributes: [
          'eventType',
          'duration',
          'score',
          'maxScore',
          'createdAt',
        ],
      });

      const summary = {
        totalEvents: analytics.length,
        studyTime: 0,
        averageScore: 0,
        completedLectures: 0,
        quizAttempts: 0,
        studyStreak: 0,
      };

      let totalScore = 0;
      let scoreCount = 0;
      const studyDates = new Set();

      analytics.forEach(event => {
        if (event.duration) summary.studyTime += event.duration;
        
        if (event.score !== null && event.maxScore !== null) {
          totalScore += (event.score / event.maxScore) * 100;
          scoreCount++;
        }

        if (event.eventType === 'lecture_complete') {
          summary.completedLectures++;
        }

        if (event.eventType === 'quiz_complete') {
          summary.quizAttempts++;
        }

        // Track study dates for streak calculation
        const dateStr = event.createdAt.toISOString().split('T')[0];
        studyDates.add(dateStr);
      });

      summary.averageScore = scoreCount > 0 ? totalScore / scoreCount : 0;
      summary.studyStreak = this.calculateStudyStreak(Array.from(studyDates));

      return summary;
    } catch (error) {
      logger.error('CALCULATE_USER_SUMMARY_FAILED', {
        userId,
        courseId,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể tính user summary',
        code: 'CALCULATE_USER_SUMMARY_FAILED',
      };
    }
  }

  /**
   * Calculate study streak
   */
  calculateStudyStreak(dates) {
    if (dates.length === 0) return 0;

    const sortedDates = dates.sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let streak = 0;
    let currentDate = sortedDates[0];

    // Check if studied today or yesterday
    if (currentDate !== today && currentDate !== yesterday) {
      return 0;
    }

    for (let i = 0; i < sortedDates.length; i++) {
      const expectedDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (sortedDates.includes(expectedDate)) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Get course enrollment stats
   */
  async getCourseEnrollmentStats(courseId) {
    try {
      const [totalEnrolled, activeStudents, completionRates] = await Promise.all([
        Enrollment.count({ where: { courseId, status: 'enrolled' } }),
        LearningAnalytics.count({
          where: {
            courseId,
            createdAt: {
              [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
          distinct: true,
          col: 'userId',
        }),
        this.getCourseCompletionRates(courseId),
      ]);

      return {
        totalEnrolled,
        activeStudents,
        completionRates,
      };
    } catch (error) {
      logger.error('GET_COURSE_ENROLLMENT_STATS_FAILED', {
        courseId,
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw {
        status: 500,
        message: 'Không thể lấy enrollment stats: ' + error.message,
        code: 'GET_COURSE_ENROLLMENT_STATS_FAILED',
      };
    }
  }

  /**
   * Get course completion rates
   */
  async getCourseCompletionRates(courseId) {
    try {
      const totalLectures = await Lecture.count({
        include: [
          {
            model: Chapter,
            where: { courseId },
          },
        ],
      });

      if (totalLectures === 0) return { average: 0, distribution: [] };

      const completionData = await LearningAnalytics.findAll({
        where: {
          courseId,
          eventType: 'lecture_complete',
        },
        attributes: [
          'userId',
          [db.sequelize.fn('COUNT', db.sequelize.col('lecture_id')), 'completedCount'],
        ],
        group: ['userId'],
        raw: true,
      });

      const completionRates = completionData.map(data => ({
        userId: data.userId,
        completionRate: (data.completedCount / totalLectures) * 100,
      }));

      const average = completionRates.length > 0
        ? completionRates.reduce((sum, r) => sum + r.completionRate, 0) / completionRates.length
        : 0;

      return { average, distribution: completionRates };
    } catch (error) {
      logger.error('GET_COURSE_COMPLETION_RATES_FAILED', {
        courseId,
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw {
        status: 500,
        message: 'Không thể tính completion rates: ' + error.message,
        code: 'GET_COURSE_COMPLETION_RATES_FAILED',
      };
    }
  }

  /**
   * Get course engagement metrics
   */
  async getCourseEngagementMetrics(courseId, where, groupBy) {
    try {
      // Fetch raw data without grouping - then group in JS for cross-database compatibility
      const rawData = await LearningAnalytics.findAll({
        where,
        attributes: ['createdAt', 'id', 'userId', 'duration'],
        raw: true,
      });

      // Group by period in JS
      const grouped = {};
      rawData.forEach(event => {
        const date = new Date(event.createdAt);
        let period;
        
        switch (groupBy) {
          case 'hour':
            period = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:00`;
            break;
          case 'week':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            period = `${weekStart.getFullYear()}-${String(weekStart.getMonth()+1).padStart(2,'0')}-${String(weekStart.getDate()).padStart(2,'0')}`;
            break;
          case 'month':
            period = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
            break;
          case 'day':
          default:
            period = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        }

        if (!grouped[period]) {
          grouped[period] = { totalEvents: 0, userIds: new Set(), totalDuration: 0, count: 0 };
        }
        grouped[period].totalEvents++;
        grouped[period].userIds.add(event.userId);
        if (event.duration) {
          grouped[period].totalDuration += event.duration;
          grouped[period].count++;
        }
      });

      const metrics = Object.keys(grouped).sort().map(period => ({
        period,
        totalEvents: grouped[period].totalEvents,
        activeUsers: grouped[period].userIds.size,
        averageDuration: grouped[period].count > 0 ? grouped[period].totalDuration / grouped[period].count : 0,
      }));

      return metrics;
    } catch (error) {
      logger.error('GET_COURSE_ENGAGEMENT_METRICS_FAILED', {
        courseId,
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw {
        status: 500,
        message: 'Không thể lấy engagement metrics: ' + error.message,
        code: 'GET_COURSE_ENGAGEMENT_METRICS_FAILED',
      };
    }
  }

  /**
   * Get course performance metrics
   */
  async getCoursePerformanceMetrics(courseId, where) {
    try {
      // Fetch raw data and calculate in JS for cross-database compatibility
      const quizData = await LearningAnalytics.findAll({
        where: {
          ...where,
          eventType: 'quiz_complete',
        },
        attributes: ['score', 'maxScore', 'userId'],
        raw: true,
      });

      const totalAttempts = quizData.length;
      const uniqueUsers = new Set(quizData.map(d => d.userId)).size;
      
      let averageScore = 0;
      if (totalAttempts > 0) {
        const validScores = quizData.filter(d => d.score !== null && d.maxScore !== null && d.maxScore > 0);
        if (validScores.length > 0) {
          const totalPercentage = validScores.reduce((sum, d) => sum + (d.score / d.maxScore) * 100, 0);
          averageScore = totalPercentage / validScores.length;
        }
      }

      return {
        averageScore,
        totalAttempts,
        uniqueUsers,
      };
    } catch (error) {
      logger.error('GET_COURSE_PERFORMANCE_METRICS_FAILED', {
        courseId,
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw {
        status: 500,
        message: 'Không thể lấy performance metrics: ' + error.message,
        code: 'GET_COURSE_PERFORMANCE_METRICS_FAILED',
      };
    }
  }

  /**
   * Get at-risk students for a course
   */
  async getAtRiskStudents(courseId) {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const atRiskStudents = await UserLearningProfile.findAll({
        where: {
          courseId,
          [Op.or]: [
            {
              lastActivityAt: {
                [Op.lt]: thirtyDaysAgo,
              },
            },
            {
              averageScore: {
                [Op.lt]: 60,
              },
            },
          ],
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'name', 'username'],
          },
        ],
        order: [['lastActivityAt', 'ASC']],
        limit: 20,
      });

      return atRiskStudents.map(profile => ({
        userId: profile.userId,
        user: profile.user,
        riskFactors: this.identifyRiskFactors(profile),
        lastActivity: profile.lastActivityAt,
        averageScore: profile.averageScore,
      }));
    } catch (error) {
      logger.error('GET_AT_RISK_STUDENTS_FAILED', {
        courseId,
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw {
        status: 500,
        message: 'Không thể lấy at-risk students: ' + error.message,
        code: 'GET_AT_RISK_STUDENTS_FAILED',
      };
    }
  }

  /**
   * Identify risk factors for a student
   */
  identifyRiskFactors(profile) {
    const factors = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (profile.lastActivityAt < thirtyDaysAgo) {
      factors.push('INACTIVE_LAST_30_DAYS');
    }

    if (profile.averageScore < 60) {
      factors.push('LOW_PERFORMANCE');
    }

    if (profile.averageScore < 40) {
      factors.push('VERY_LOW_PERFORMANCE');
    }

    const completionRate = profile.totalLectures > 0 
      ? (profile.completedLectures / profile.totalLectures) * 100 
      : 0;

    if (completionRate < 30) {
      factors.push('LOW_COMPLETION_RATE');
    }

    return factors;
  }

  /**
   * Get platform user metrics
   */
  async getPlatformUserMetrics(dateFilter) {
    try {
      const [totalUsers, newUsers, activeUsers] = await Promise.all([
        User.count(),
        User.count({
          where: {
            createdAt: dateFilter,
          },
        }),
        LearningAnalytics.count({
          where: dateFilter,
          distinct: true,
          col: 'userId',
        }),
      ]);

      return {
        totalUsers,
        newUsers,
        activeUsers,
      };
    } catch (error) {
      logger.error('GET_PLATFORM_USER_METRICS_FAILED', {
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể lấy platform user metrics',
        code: 'GET_PLATFORM_USER_METRICS_FAILED',
      };
    }
  }

  /**
   * Get platform course metrics
   */
  async getPlatformCourseMetrics(dateFilter) {
    try {
      const [totalCourses, newCourses] = await Promise.all([
        Course.count(),
        Course.count({
          where: {
            createdAt: dateFilter,
          },
        }),
      ]);

      return {
        totalCourses,
        newCourses,
      };
    } catch (error) {
      logger.error('GET_PLATFORM_COURSE_METRICS_FAILED', {
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể lấy platform course metrics',
        code: 'GET_PLATFORM_COURSE_METRICS_FAILED',
      };
    }
  }

  /**
   * Get platform engagement metrics
   */
  async getPlatformEngagementMetrics(dateFilter, groupBy) {
    try {
      // Fetch raw data without grouping - then group in JS for cross-database compatibility
      const rawData = await LearningAnalytics.findAll({
        where: dateFilter,
        attributes: ['createdAt', 'id', 'userId'],
        raw: true,
      });

      // Group by period in JS
      const grouped = {};
      rawData.forEach(event => {
        const date = new Date(event.createdAt);
        let period;
        
        switch (groupBy) {
          case 'hour':
            period = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:00`;
            break;
          case 'week':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            period = `${weekStart.getFullYear()}-${String(weekStart.getMonth()+1).padStart(2,'0')}-${String(weekStart.getDate()).padStart(2,'0')}`;
            break;
          case 'month':
            period = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
            break;
          case 'day':
          default:
            period = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        }

        if (!grouped[period]) {
          grouped[period] = { totalEvents: 0, userIds: new Set() };
        }
        grouped[period].totalEvents++;
        grouped[period].userIds.add(event.userId);
      });

      const metrics = Object.keys(grouped).sort().map(period => ({
        period,
        totalEvents: grouped[period].totalEvents,
        activeUsers: grouped[period].userIds.size,
      }));

      return metrics;
    } catch (error) {
      logger.error('GET_PLATFORM_ENGAGEMENT_METRICS_FAILED', {
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể lấy platform engagement metrics',
        code: 'GET_PLATFORM_ENGAGEMENT_METRICS_FAILED',
      };
    }
  }

  /**
   * Get AI usage metrics
   */
  async getAiUsageMetrics(dateFilter) {
    try {
      const metrics = await AiAuditLog.findAll({
        where: dateFilter,
        attributes: [
          'endpoint',
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'totalCalls'],
          [db.sequelize.fn('COUNT', db.sequelize.fn('DISTINCT', db.sequelize.col('user_id'))), 'uniqueUsers'],
          [db.sequelize.fn('SUM', db.sequelize.literal('COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)')), 'totalTokens'],
        ],
        group: ['endpoint'],
        order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']],
        raw: true,
      });

      return metrics.map(m => ({
        endpoint: m.endpoint,
        totalCalls: parseInt(m.totalCalls),
        uniqueUsers: parseInt(m.uniqueUsers),
        totalTokens: parseInt(m.totalTokens) || 0,
      }));
    } catch (error) {
      logger.error('GET_AI_USAGE_METRICS_FAILED', {
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw {
        status: 500,
        message: 'Không thể lấy AI usage metrics: ' + error.message,
        code: 'GET_AI_USAGE_METRICS_FAILED',
      };
    }
  }

  /**
   * Get cost metrics
   */
  async getCostMetrics(dateFilter) {
    try {
      // This would typically integrate with billing data
      // For now, we'll estimate based on token usage
      const tokenUsage = await AiAuditLog.findAll({
        where: dateFilter,
        attributes: [
          [db.sequelize.fn('SUM', db.sequelize.literal('COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)')), 'totalTokens'],
        ],
        raw: true,
      });

      const totalTokens = parseInt(tokenUsage[0]?.totalTokens) || 0;
      const estimatedCost = this.estimateCostFromTokens(totalTokens);

      return {
        totalTokens,
        estimatedCost,
        costPerToken: estimatedCost / totalTokens || 0,
      };
    } catch (error) {
      logger.error('GET_COST_METRICS_FAILED', {
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể lấy cost metrics',
        code: 'GET_COST_METRICS_FAILED',
      };
    }
  }

  /**
   * Estimate cost from tokens
   */
  estimateCostFromTokens(tokens) {
    // Rough estimation - adjust based on actual pricing
    const costPer1KTokens = 0.002; // $0.002 per 1K tokens
    return (tokens / 1000) * costPer1KTokens;
  }

  /**
   * Get date format for grouping
   */
  getDateFormat(groupBy) {
    switch (groupBy) {
      case 'hour':
        return 'hour';
      case 'day':
        return 'day';
      case 'week':
        return 'week';
      case 'month':
        return 'month';
      default:
        return 'day';
    }
  }

  /**
   * Update user profile from event
   */
  async updateUserProfileFromEvent(userId, courseId, event) {
    try {
      const profile = await UserLearningProfile.findOne({
        where: { userId, courseId },
      });

      if (!profile) return;

      let updateData = {};

      switch (event.eventType) {
        case 'study_session':
          if (event.duration) {
            updateData.totalStudyTime = profile.totalStudyTime + event.duration;
          }
          break;
        case 'lecture_complete':
          updateData.completedLectures = profile.completedLectures + 1;
          break;
        case 'quiz_complete':
          if (event.score && event.maxScore) {
            const scorePercentage = (event.score / event.maxScore) * 100;
            const currentAverage = profile.averageScore || 0;
            const newAverage = (currentAverage + scorePercentage) / 2;
            updateData.averageScore = newAverage;
          }
          break;
      }

      updateData.lastActivityAt = event.createdAt;

      if (Object.keys(updateData).length > 0) {
        await profile.update(updateData);
      }
    } catch (error) {
      logger.error('UPDATE_PROFILE_FROM_EVENT_FAILED', {
        userId,
        courseId,
        eventId: event.id,
        error: error.message,
      });
    }
  }
}

module.exports = new AiAnalyticsService();
