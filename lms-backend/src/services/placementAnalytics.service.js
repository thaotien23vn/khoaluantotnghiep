const db = require('../models');
const logger = require('../utils/logger');

const { PlacementSession, PlacementQuestion, PlacementResponse, PlacementQuestionBank } = db.models;
const { Op, Sequelize } = require('sequelize');

/**
 * Placement Analytics Service
 * Provides statistics on completion rates, level distribution, and question performance
 */
class PlacementAnalyticsService {
  /**
   * Get overall placement test statistics
   */
  async getOverallStats(startDate, endDate) {
    const where = {};
    if (startDate && endDate) {
      where.startedAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const [total, completed, abandoned, inProgress] = await Promise.all([
      PlacementSession.count({ where }),
      PlacementSession.count({ where: { ...where, status: 'completed' } }),
      PlacementSession.count({ where: { ...where, status: 'abandoned' } }),
      PlacementSession.count({ where: { ...where, status: 'in_progress' } }),
    ]);

    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    const abandonmentRate = total > 0 ? (abandoned / total) * 100 : 0;

    return {
      totalSessions: total,
      completed,
      abandoned,
      inProgress,
      completionRate: Math.round(completionRate * 100) / 100,
      abandonmentRate: Math.round(abandonmentRate * 100) / 100,
    };
  }

  /**
   * Get CEFR level distribution
   */
  async getLevelDistribution(startDate, endDate) {
    const where = { status: 'completed' };
    if (startDate && endDate) {
      where.completedAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const distribution = await PlacementSession.findAll({
      where,
      attributes: [
        'finalCefrLevel',
        [Sequelize.fn('COUNT', Sequelize.col('final_cefr_level')), 'count'],
      ],
      group: ['finalCefrLevel'],
      raw: true,
    });

    const result = {
      A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, unknown: 0,
    };

    distribution.forEach((item) => {
      const level = item.finalCefrLevel || 'unknown';
      result[level] = parseInt(item.count, 10);
    });

    return result;
  }

  /**
   * Get common wrong answers / difficult questions
   */
  async getCommonWrongAnswers(limit = 10, startDate, endDate) {
    const where = {};
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const wrongAnswers = await PlacementResponse.findAll({
      where: { ...where, isCorrect: false },
      include: [{
        model: PlacementQuestion,
        as: 'question',
        attributes: ['content', 'correct_answer', 'explanation', 'cefr_level', 'skill_type'],
      }],
      attributes: [
        'questionId',
        [Sequelize.fn('COUNT', Sequelize.col('PlacementResponse.id')), 'wrongCount'],
      ],
      group: ['questionId', 'question.id', 'question.content', 'question.correct_answer', 'question.explanation', 'question.cefr_level', 'question.skill_type'],
      order: [[Sequelize.fn('COUNT', Sequelize.col('PlacementResponse.id')), 'DESC']],
      limit,
      raw: true,
    });

    return wrongAnswers.map((item) => ({
      questionId: item.questionId,
      content: item['question.content'],
      correctAnswer: item['question.correct_answer'],
      explanation: item['question.explanation'],
      cefrLevel: item['question.cefr_level'],
      skillType: item['question.skill_type'],
      wrongCount: parseInt(item.wrongCount, 10),
    }));
  }

  /**
   * Get skill performance breakdown
   */
  async getSkillPerformance(startDate, endDate) {
    const where = {};
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const skillStats = await PlacementResponse.findAll({
      where,
      include: [{
        model: PlacementQuestion,
        as: 'question',
        attributes: ['skill_type'],
      }],
      attributes: [
        [Sequelize.col('question.skill_type'), 'skillType'],
        [Sequelize.fn('COUNT', Sequelize.col('PlacementResponse.id')), 'total'],
        [Sequelize.fn('SUM', Sequelize.literal('CASE WHEN "PlacementResponse"."is_correct" = true THEN 1 ELSE 0 END')), 'correct'],
      ],
      group: ['question.skill_type'],
      raw: true,
    });

    return skillStats.map((item) => ({
      skill: item.skillType,
      total: parseInt(item.total, 10),
      correct: parseInt(item.correct, 10) || 0,
      accuracy: item.total > 0 
        ? Math.round(((parseInt(item.correct, 10) || 0) / parseInt(item.total, 10)) * 100) / 100 
        : 0,
    }));
  }

  /**
   * Get question bank usage statistics
   */
  async getQuestionBankStats() {
    const stats = await PlacementQuestionBank.findAll({
      attributes: [
        'cefrLevel',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
        [Sequelize.fn('SUM', Sequelize.col('usage_count')), 'totalUsage'],
      ],
      group: ['cefrLevel'],
      raw: true,
    });

    const result = {};
    stats.forEach((item) => {
      result[item.cefrLevel] = {
        totalQuestions: parseInt(item.total, 10),
        totalUsage: parseInt(item.totalUsage, 10) || 0,
      };
    });

    return result;
  }

  /**
   * Get user-specific placement history
   */
  async getUserPlacementHistory(userId) {
    const history = await PlacementSession.findAll({
      where: { userId },
      order: [['startedAt', 'DESC']],
      include: [{
        model: PlacementQuestion,
        as: 'questions',
        include: [{
          model: PlacementResponse,
          as: 'responses',
        }],
      }],
    });

    return history.map((session) => ({
      sessionId: session.id,
      status: session.status,
      finalLevel: session.finalCefrLevel,
      confidenceScore: session.confidenceScore,
      questionCount: session.questionCount,
      correctCount: session.correctCount,
      accuracy: session.questionCount > 0 
        ? Math.round((session.correctCount / session.questionCount) * 100) / 100 
        : 0,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    }));
  }

  /**
   * Get time-based trends
   */
  async getTrends(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const sessions = await PlacementSession.findAll({
      where: {
        startedAt: { [Op.gte]: startDate },
        status: 'completed',
      },
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('started_at')), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      ],
      group: [Sequelize.fn('DATE', Sequelize.col('started_at'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('started_at')), 'ASC']],
      raw: true,
    });

    return sessions.map((item) => ({
      date: item.date,
      completedCount: parseInt(item.count, 10),
    }));
  }

  /**
   * Get full dashboard report for admin
   */
  async getDashboardReport(dateRange) {
    const { startDate, endDate } = dateRange || {};

    const [
      overallStats,
      levelDistribution,
      skillPerformance,
      questionBankStats,
      commonWrongAnswers,
    ] = await Promise.all([
      this.getOverallStats(startDate, endDate),
      this.getLevelDistribution(startDate, endDate),
      this.getSkillPerformance(startDate, endDate),
      this.getQuestionBankStats(),
      this.getCommonWrongAnswers(5, startDate, endDate),
    ]);

    return {
      overall: overallStats,
      levelDistribution,
      skillPerformance,
      questionBank: questionBankStats,
      topDifficultQuestions: commonWrongAnswers,
    };
  }
}

module.exports = new PlacementAnalyticsService();
