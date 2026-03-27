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

      // Create a temporary quick check session
      const session = await placementService.startSession({
        userId,
        targetCourseId,
        selfAssessedLevel: 'unknown',
      });

      // Get first question immediately
      const question = await placementService.getNextQuestion(session.id);

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          isQuickCheck: true,
          question: question.completed ? null : question,
          message: 'Quick check: 2-3 câu để ước tính trình độ',
        },
      });
    } catch (err) {
      logger.error('PLACEMENT_QUICK_CHECK_ERROR', { error: err.message });
      next(err);
    }
  }
}

module.exports = new PlacementController();
