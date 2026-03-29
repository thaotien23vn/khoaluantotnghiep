const db = require('../models');
const { Op } = require('sequelize');
const aiGateway = require('./aiGateway.service');
const logger = require('../utils/logger');

const {
  UserLearningProfile,
  AiRecommendation,
  LearningAnalytics,
  Course,
  Chapter,
  Lecture,
  Quiz,
  Attempt,
} = db.models;

class AiPersonalizationService {
  /**
   * Create or update user learning profile
   */
  async upsertUserLearningProfile(userId, courseId, data) {
    try {
      const [profile, created] = await UserLearningProfile.findOrCreate({
        where: { userId, courseId },
        defaults: {
          userId,
          courseId,
          learningStyle: data.learningStyle || null,
          difficultyPreference: data.difficultyPreference || 'adaptive',
          preferredStudyTime: data.preferredStudyTime || null,
          goals: data.goals || {},
          preferences: data.preferences || {},
        },
      });

      if (!created) {
        await profile.update({
          learningStyle: data.learningStyle || profile.learningStyle,
          difficultyPreference: data.difficultyPreference || profile.difficultyPreference,
          preferredStudyTime: data.preferredStudyTime || profile.preferredStudyTime,
          goals: data.goals || profile.goals,
          preferences: data.preferences || profile.preferences,
        });
      }

      return { profile };
    } catch (error) {
      logger.error('PROFILE_CREATION_FAILED', {
        userId,
        courseId,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể tạo/cập nhật learning profile',
        code: 'PROFILE_CREATION_FAILED',
      };
    }
  }

  /**
   * Generate personalized recommendations for user
   */
  async generateRecommendations(userId, courseId, options = {}) {
    try {
      const profile = await UserLearningProfile.findOne({
        where: { userId, courseId },
        include: [
          {
            model: Course,
            as: 'course',
            attributes: ['id', 'title'],
          },
        ],
      });

      if (!profile) {
        throw {
          status: 404,
          message: 'User learning profile not found',
          code: 'PROFILE_NOT_FOUND',
        };
      }

      const recommendations = [];

      // Analyze weak topics and suggest remediation
      if (profile.weakTopics && profile.weakTopics.length > 0) {
        for (const topic of profile.weakTopics) {
          const recommendation = await this.createRemediationRecommendation(
            userId,
            courseId,
            topic,
            profile
          );
          if (recommendation) recommendations.push(recommendation);
        }
      }

      // Suggest next lectures based on progress
      const nextLectureRecommendation = await this.getNextLectureRecommendation(
        userId,
        courseId,
        profile
      );
      if (nextLectureRecommendation) recommendations.push(nextLectureRecommendation);

      // Generate practice recommendations
      if (options.includePractice) {
        const practiceRecommendation = await this.getPracticeRecommendation(
          userId,
          courseId,
          profile
        );
        if (practiceRecommendation) recommendations.push(practiceRecommendation);
      }

      return { recommendations };
    } catch (error) {
      logger.error('RECOMMENDATION_GENERATION_FAILED', {
        userId,
        courseId,
        error: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
      });
      throw {
        status: 500,
        message: 'Không thể tạo recommendations: ' + error.message,
        code: 'RECOMMENDATION_GENERATION_FAILED',
      };
    }
  }

  /**
   * Create remediation recommendation for weak topics
   */
  async createRemediationRecommendation(userId, courseId, topic, profile) {
    try {
      // Find lectures covering this topic
      const lectures = await Lecture.findAll({
        include: [
          {
            model: Chapter,
            as: 'chapter',
            where: { courseId },
            attributes: ['id', 'title'],
          },
        ],
        where: {
          title: {
            [db.Sequelize.Op.like]: `%${topic}%`,
          },
        },
        limit: 3,
      });

      if (lectures.length === 0) return null;

      const recommendation = await AiRecommendation.create({
        userId,
        courseId,
        type: 'remediation',
        title: `Cần ôn tập: ${topic}`,
        description: `Dựa trên kết quả học tập, bạn cần củng cố kiến thức về ${topic}`,
        targetId: lectures[0].id,
        targetType: 'lecture',
        priority: 'high',
        score: 8.5,
        reason: `Topic ${topic} được xác định là điểm yếu cần cải thiện`,
        metadata: {
          topic,
          suggestedLectures: lectures.map(l => ({
            id: l.id,
            title: l.title,
            chapter: l.chapter?.title,
          })),
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      return recommendation;
    } catch (error) {
      logger.error('REMEDIATION_RECOMMENDATION_FAILED', {
        userId,
        courseId,
        topic,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get next lecture recommendation based on progress
   */
  async getNextLectureRecommendation(userId, courseId, profile) {
    try {
      const progress = await this.calculateCourseProgress(userId, courseId);
      
      if (progress.completedPercentage >= 100) return null;

      const nextLecture = await Lecture.findOne({
        include: [
          {
            model: Chapter,
            as: 'chapter',
            where: { courseId },
            attributes: ['id', 'title', 'order'],
            order: [['order', 'ASC']],
          },
        ],
        where: {
          id: {
            [Op.notIn]: progress.completedLectures,
          },
        },
        order: [['order', 'ASC']],
      });

      if (!nextLecture) return null;

      const recommendation = await AiRecommendation.create({
        userId,
        courseId,
        type: 'lecture',
        title: `Tiếp tục học: ${nextLecture.title}`,
        description: `Bài học tiếp theo trong lộ trình của bạn`,
        targetId: nextLecture.id,
        targetType: 'lecture',
        priority: 'medium',
        score: 7.0,
        reason: 'Tiếp theo trong lộ trình học tập',
        metadata: {
          chapter: nextLecture.chapter?.title,
          order: nextLecture.chapter?.order,
        },
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      });

      return recommendation;
    } catch (error) {
      logger.error('NEXT_LECTURE_RECOMMENDATION_FAILED', {
        userId,
        courseId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get practice recommendation
   */
  async getPracticeRecommendation(userId, courseId, profile) {
    try {
      // Find quizzes related to user's weak topics
      const quizzes = await Quiz.findAll({
        where: {
          courseId,
          isActive: true,
        },
        limit: 3,
      });

      if (quizzes.length === 0) return null;

      const recommendation = await AiRecommendation.create({
        userId,
        courseId,
        type: 'quiz',
        title: 'Luyện tập với bài quiz',
        description: 'Kiểm tra kiến thức và củng cố những gì đã học',
        targetId: quizzes[0].id,
        targetType: 'quiz',
        priority: 'medium',
        score: 6.5,
        reason: 'Luyện tập để củng cố kiến thức',
        metadata: {
          suggestedQuizzes: quizzes.map(q => ({
            id: q.id,
            title: q.title,
            questions: q.questionCount,
          })),
        },
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
      });

      return recommendation;
    } catch (error) {
      logger.error('PRACTICE_RECOMMENDATION_FAILED', {
        userId,
        courseId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Calculate course progress for user
   */
  async calculateCourseProgress(userId, courseId) {
    try {
      const [completedLectures, totalLectures] = await Promise.all([
        LearningAnalytics.findAll({
          where: {
            userId,
            courseId,
            eventType: 'lecture_complete',
          },
          attributes: ['lectureId'],
        }),
        Lecture.count({
          include: [
            {
              model: Chapter,
          as: 'chapter',
              as: 'chapter',
              where: { courseId },
            },
          ],
        }),
      ]);

      const completedLectureIds = completedLectures.map(l => l.lectureId);
      const completedPercentage = totalLectures > 0 ? (completedLectureIds.length / totalLectures) * 100 : 0;

      return {
        completedLectures: completedLectureIds,
        totalLectures,
        completedPercentage,
        completedCount: completedLectureIds.length,
      };
    } catch (error) {
      logger.error('PROGRESS_CALCULATION_FAILED', {
        userId,
        courseId,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể tính toán progress',
        code: 'PROGRESS_CALCULATION_FAILED',
      };
    }
  }

  /**
   * Update user profile based on learning analytics
   */
  async updateProfileFromAnalytics(userId, courseId) {
    try {
      const profile = await UserLearningProfile.findOne({
        where: { userId, courseId },
      });

      if (!profile) return null;

      // Get recent analytics data
      const recentAnalytics = await LearningAnalytics.findAll({
        where: {
          userId,
          courseId,
          createdAt: {
            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        order: [['createdAt', 'DESC']],
      });

      // Calculate average score from quizzes
      const quizAnalytics = recentAnalytics.filter(a => a.eventType === 'quiz_complete');
      if (quizAnalytics.length > 0) {
        const totalScore = quizAnalytics.reduce((sum, a) => sum + (a.score || 0), 0);
        const maxScore = quizAnalytics.reduce((sum, a) => sum + (a.maxScore || 1), 0);
        const averageScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
        
        await profile.update({ averageScore });
      }

      // Update total study time
      const studySessions = recentAnalytics.filter(a => a.eventType === 'study_session');
      const totalStudyTime = studySessions.reduce((sum, a) => sum + (a.duration || 0), 0);
      
      // Update last activity
      const lastActivity = recentAnalytics.length > 0 ? recentAnalytics[0].createdAt : new Date();

      await profile.update({
        totalStudyTime: profile.totalStudyTime + totalStudyTime,
        lastActivityAt: lastActivity,
      });

      return { profile };
    } catch (error) {
      logger.error('PROFILE_UPDATE_FROM_ANALYTICS_FAILED', {
        userId,
        courseId,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể cập nhật profile từ analytics',
        code: 'PROFILE_UPDATE_FROM_ANALYTICS_FAILED',
      };
    }
  }

  /**
   * Get user's recommendations with pagination
   */
  async getUserRecommendations(userId, options = {}) {
    try {
      const {
        courseId,
        type,
        status = 'pending',
        page = 1,
        limit = 20,
      } = options;

      const where = { userId };
      if (courseId) where.courseId = courseId;
      if (type) where.type = type;
      if (status) where.status = status;

      const { count, rows } = await AiRecommendation.findAndCountAll({
        where,
        include: [
          {
            model: Course,
            as: 'course',
            attributes: ['id', 'title'],
            required: false,
          },
        ],
        order: [['priority', 'DESC'], ['score', 'DESC'], ['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      return {
        recommendations: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit)),
        },
      };
    } catch (error) {
      logger.error('GET_USER_RECOMMENDATIONS_FAILED', {
        userId,
        options,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể lấy recommendations',
        code: 'GET_USER_RECOMMENDATIONS_FAILED',
      };
    }
  }

  /**
   * Update recommendation status
   */
  async updateRecommendationStatus(userId, recommendationId, status) {
    try {
      const recommendation = await AiRecommendation.findOne({
        where: {
          id: recommendationId,
          userId,
        },
      });

      if (!recommendation) {
        throw {
          status: 404,
          message: 'Recommendation not found',
          code: 'RECOMMENDATION_NOT_FOUND',
        };
      }

      await recommendation.update({ status });

      return { recommendation };
    } catch (error) {
      logger.error('UPDATE_RECOMMENDATION_STATUS_FAILED', {
        userId,
        recommendationId,
        status,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể cập nhật recommendation status',
        code: 'UPDATE_RECOMMENDATION_STATUS_FAILED',
      };
    }
  }
}

module.exports = new AiPersonalizationService();
