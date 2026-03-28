const placementService = require('../../services/placement.service');
const logger = require('../../utils/logger');

class PlacementController {
  /**
   * POST /student/placement/start
   * Start a new placement test session
   */
  async startSession(req, res, next) {
    try {
      const { targetCourseId, selfAssessedLevel } = req.body;
      const userId = req.user?.id || null; // Can be guest

      const session = await placementService.startSession({
        userId,
        targetCourseId,
        selfAssessedLevel,
      });

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          status: session.status,
          startingLevel: session.currentCefrLevel,
          selfAssessedLevel: session.selfAssessedLevel,
        },
      });
    } catch (err) {
      logger.error('PLACEMENT_START_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * GET /student/placement/:sessionId/question
   * Get next question for the session
   */
  async getNextQuestion(req, res, next) {
    try {
      const { sessionId } = req.params;

      const result = await placementService.getNextQuestion(sessionId);

      if (result.completed) {
        return res.json({
          success: true,
          data: {
            completed: true,
            result: result.result,
          },
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('PLACEMENT_GET_QUESTION_ERROR', { 
        sessionId: req.params.sessionId,
        error: err.message 
      });
      next(err);
    }
  }

  /**
   * POST /student/placement/:sessionId/answer
   * Submit answer for a question
   */
  async submitAnswer(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { questionId, answer, timeSpentSeconds } = req.body;

      const result = await placementService.submitAnswer(
        sessionId,
        questionId,
        answer,
        timeSpentSeconds
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('PLACEMENT_SUBMIT_ANSWER_ERROR', {
        sessionId: req.params.sessionId,
        error: err.message,
      });
      next(err);
    }
  }

  /**
   * POST /student/placement/:sessionId/complete
   * Force complete a session
   */
  async completeSession(req, res, next) {
    try {
      const { sessionId } = req.params;

      const result = await placementService.completeSession(sessionId);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('PLACEMENT_COMPLETE_ERROR', {
        sessionId: req.params.sessionId,
        error: err.message,
      });
      next(err);
    }
  }

  /**
   * GET /student/placement/:sessionId/result
   * Get session result
   */
  async getResult(req, res, next) {
    try {
      const { sessionId } = req.params;

      const result = await placementService.getSessionResult(sessionId);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('PLACEMENT_GET_RESULT_ERROR', {
        sessionId: req.params.sessionId,
        error: err.message,
      });
      next(err);
    }
  }

  /**
   * POST /student/placement/quick-check
   * Quick 2-3 question check before full test
   */
  async quickCheck(req, res, next) {
    try {
      const { targetCourseId } = req.body;
      const userId = req.user?.id || null;

      // Create a quick check session with 7 questions max
      const session = await placementService.startSession({
        userId,
        targetCourseId,
        selfAssessedLevel: 'unknown',
        isQuickCheck: true,
      });

      // Get first question immediately
      const question = await placementService.getNextQuestion(session.id);

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          isQuickCheck: true,
          totalQuestions: 7,
          currentQuestion: 1,
          question: question.completed ? null : question,
          message: 'Quick check: 7 câu để ước tính trình độ',
        },
      });
    } catch (err) {
      logger.error('PLACEMENT_QUICK_CHECK_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * Skip a question
   */
  async skipQuestion(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { questionId, timeSpentSeconds } = req.body;

      const result = await placementService.submitAnswer(sessionId, {
        questionId,
        answer: null, // Skipped
        isSkipped: true,
        timeSpentSeconds: timeSpentSeconds || 0,
      });

      res.json({
        success: true,
        data: {
          sessionId: result.sessionId,
          question: result.question,
          completed: result.completed,
          progress: result.progress,
          message: 'Đã bỏ qua câu hỏi',
        },
      });
    } catch (err) {
      logger.error('PLACEMENT_SKIP_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * Get test progress
   */
  async getProgress(req, res, next) {
    try {
      const { sessionId } = req.params;
      const progress = await placementService.getProgress(sessionId);

      res.json({
        success: true,
        data: progress,
      });
    } catch (err) {
      logger.error('PLACEMENT_PROGRESS_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * Check if user is eligible to retake placement test
   */
  async checkRetakeEligibility(req, res, next) {
    try {
      const userId = req.user?.id;
      const eligibility = await placementService.checkRetakeEligibility(userId);
      
      res.json({
        success: true,
        data: eligibility,
      });
    } catch (err) {
      logger.error('PLACEMENT_RETAKE_CHECK_ERROR', { error: err.message });
      next(err);
    }
  }

  /**
   * Get user's placement test history
   */
  async getUserPlacementHistory(req, res, next) {
    try {
      const userId = req.user?.id;
      const { limit = 10, includeDetails = false } = req.query;
      
      const history = await placementService.getUserPlacementHistory(userId, {
        limit: parseInt(limit),
        includeDetails: includeDetails === 'true',
      });
      
      res.json({
        success: true,
        data: {
          history,
          count: history.length,
        },
      });
    } catch (err) {
      logger.error('PLACEMENT_HISTORY_ERROR', { error: err.message });
      next(err);
    }
  }

  // ================= ADMIN APIs =================

  /**
   * Admin: Get user placement history
   */
  async adminGetUserHistory(req, res, next) {
    try {
      const { userId } = req.params;
      const { includeDetails = false } = req.query;
      
      const history = await placementService.getUserHistoryForAdmin(
        parseInt(userId),
        includeDetails === 'true'
      );
      
      res.json({
        success: true,
        data: {
          userId: parseInt(userId),
          history,
          count: history.length,
        },
      });
    } catch (err) {
      logger.error('ADMIN_PLACEMENT_HISTORY_ERROR', { error: err.message, userId: req.params.userId });
      next(err);
    }
  }

  /**
   * Admin: Reset cooldown for user
   */
  async adminResetCooldown(req, res, next) {
    try {
      const { userId } = req.params;
      
      const result = await placementService.resetCooldown(parseInt(userId));
      
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('ADMIN_RESET_COOLDOWN_ERROR', { error: err.message, userId: req.params.userId });
      next(err);
    }
  }

  /**
   * Admin: Delete a placement session
   */
  async adminDeleteSession(req, res, next) {
    try {
      const { sessionId } = req.params;
      
      const result = await placementService.deleteSession(parseInt(sessionId));
      
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      logger.error('ADMIN_DELETE_SESSION_ERROR', { error: err.message, sessionId: req.params.sessionId });
      next(err);
    }
  }
}

module.exports = new PlacementController();
