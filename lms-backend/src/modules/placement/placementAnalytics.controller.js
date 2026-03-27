const placementAnalyticsService = require('../../services/placementAnalytics.service');
const logger = require('../../utils/logger');

/**
 * Placement Analytics Controller
 * Handles analytics and reporting API endpoints
 */
class PlacementAnalyticsController {
  /**
   * GET /admin/placement/analytics/dashboard
   * Get comprehensive dashboard report
   */
  async getDashboard(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      
      const report = await placementAnalyticsService.getDashboardReport({
        startDate,
        endDate,
      });

      res.json({
        success: true,
        data: report,
      });
    } catch (err) {
      logger.error('PLACEMENT_ANALYTICS_DASHBOARD_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * GET /admin/placement/analytics/stats
   * Get overall statistics
   */
  async getOverallStats(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      
      const stats = await placementAnalyticsService.getOverallStats(startDate, endDate);

      res.json({
        success: true,
        data: stats,
      });
    } catch (err) {
      logger.error('PLACEMENT_ANALYTICS_STATS_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * GET /admin/placement/analytics/levels
   * Get level distribution
   */
  async getLevelDistribution(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      
      const distribution = await placementAnalyticsService.getLevelDistribution(startDate, endDate);

      res.json({
        success: true,
        data: distribution,
      });
    } catch (err) {
      logger.error('PLACEMENT_ANALYTICS_LEVELS_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * GET /admin/placement/analytics/skill-performance
   * Get skill performance breakdown
   */
  async getSkillPerformance(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      
      const performance = await placementAnalyticsService.getSkillPerformance(startDate, endDate);

      res.json({
        success: true,
        data: performance,
      });
    } catch (err) {
      logger.error('PLACEMENT_ANALYTICS_SKILL_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * GET /admin/placement/analytics/difficult-questions
   * Get most commonly wrong answers
   */
  async getDifficultQuestions(req, res, next) {
    try {
      const { limit = 10, startDate, endDate } = req.query;
      
      const questions = await placementAnalyticsService.getCommonWrongAnswers(
        parseInt(limit, 10),
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: questions,
      });
    } catch (err) {
      logger.error('PLACEMENT_ANALYTICS_DIFFICULT_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * GET /admin/placement/analytics/question-bank
   * Get question bank usage stats
   */
  async getQuestionBankStats(req, res, next) {
    try {
      const stats = await placementAnalyticsService.getQuestionBankStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (err) {
      logger.error('PLACEMENT_ANALYTICS_BANK_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * GET /admin/placement/analytics/trends
   * Get completion trends over time
   */
  async getTrends(req, res, next) {
    try {
      const { days = 30 } = req.query;
      
      const trends = await placementAnalyticsService.getTrends(parseInt(days, 10));

      res.json({
        success: true,
        data: trends,
      });
    } catch (err) {
      logger.error('PLACEMENT_ANALYTICS_TRENDS_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * GET /student/placement/history
   * Get user's own placement test history
   */
  async getUserHistory(req, res, next) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      const history = await placementAnalyticsService.getUserPlacementHistory(userId);

      res.json({
        success: true,
        data: history,
      });
    } catch (err) {
      logger.error('PLACEMENT_USER_HISTORY_ERROR', { error: err.message, userId: req.user?.id });
      next(err);
    }
  }
}

module.exports = new PlacementAnalyticsController();
