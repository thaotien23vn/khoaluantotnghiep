const db = require('../models/index');
const { models } = require('../models');
const aiGateway = require('./aiGateway.service');
const placementAiRecommendations = require('./placementAiRecommendations.service');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const { sequelize } = db;

logger.info('[DEBUG] Sequelize Op import check:', { Op: typeof Op, OpKeys: Op ? Object.keys(Op) : 'undefined' });

const {
  PlacementSession,
  PlacementQuestion,
  PlacementResponse,
  Course,
  PlacementQuestionBank,
} = db.models;

// CEFR levels in order
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// CEFR Level to difficulty score mapping (1-6)
const CEFR_SCORE_MAP = {
  'A1': 1,
  'A2': 2,
  'B1': 3,
  'B2': 4,
  'C1': 5,
  'C2': 6
};

// Score to CEFR level mapping
const SCORE_TO_CEFR = [
  { max: 1.5, level: 'A1' },
  { max: 2.5, level: 'A2' },
  { max: 3.5, level: 'B1' },
  { max: 4.5, level: 'B2' },
  { max: 5.5, level: 'C1' },
  { max: Infinity, level: 'C2' }
];

// Ability-based adaptive constants
const ABILITY_CORRECT_BONUS = 0.6;  // bonus multiplier for correct answer
const ABILITY_WRONG_PENALTY = 0.8;  // penalty multiplier for wrong answer (harsher)
const STARTING_ABILITY = 3.0;         // Start at B1 level

// Legacy streak-based constants (keeping for compatibility)
const LEVEL_UP_STREAK = 2;    // 2 correct -> level up
const LEVEL_DOWN_STREAK = 3;  // 3 wrong -> level down
const MAX_QUESTIONS = 20;     // Max questions per test
const QUICK_CHECK_QUESTIONS = 10;  // Quick check has max 10 questions
const MIN_QUESTIONS = 8;      // Min questions before early stop
const CONFIDENCE_THRESHOLD = 0.85; // Stop when confident enough
const RETAKE_COOLDOWN_DAYS = 1;   // Days before can retake

const MIN_TIME_PER_QUESTION = 5; // Minimum 5 seconds per question

class PlacementService {
  /**
   * Start a new placement test session
   */
  async startSession({ userId, targetCourseId, selfAssessedLevel, isQuickCheck = false, isRetake = false }) {
    // Check retake eligibility if userId provided
    if (userId && !isQuickCheck) {
      const eligibility = await this.checkRetakeEligibility(userId);
      if (!eligibility.canRetake && eligibility.lastTestDate) {
        throw {
          status: 403,
          message: `Bạn cần chờ thêm ${eligibility.daysRemaining} ngày nữa để làm lại placement test.`,
          code: 'RETAKE_NOT_ALLOWED',
          daysRemaining: eligibility.daysRemaining,
          nextRetakeDate: eligibility.nextRetakeDate,
        };
      }
    }

    // Get target course info if provided
    let startingLevel = 'B1'; // Default
    
    if (targetCourseId) {
      const course = await Course.findByPk(targetCourseId, {
        attributes: ['id', 'title', 'level'],
      });
      if (course?.level) {
        // Map course level to CEFR
        startingLevel = this.mapCourseLevelToCefr(course.level);
      }
    }

    // Use self-assessed level if provided and not unknown
    if (selfAssessedLevel && selfAssessedLevel !== 'unknown') {
      startingLevel = selfAssessedLevel;
    }

    // Get previous session info if retake
    let previousSessionId = null;
    let retakeCount = 0;
    
    if (isRetake && userId) {
      const lastSession = await PlacementSession.findOne({
        where: {
          userId,
          status: 'completed',
        },
        order: [['completedAt', 'DESC']],
      });
      
      if (lastSession) {
        previousSessionId = lastSession.id;
        retakeCount = (lastSession.retakeCount || 0) + 1;
      }
    }

    const session = await PlacementSession.create({
      userId,
      targetCourseId,
      selfAssessedLevel: selfAssessedLevel || 'unknown',
      currentCefrLevel: startingLevel,
      abilityScore: CEFR_SCORE_MAP[startingLevel] || STARTING_ABILITY, // Initialize ability score
      status: 'in_progress',
      isQuickCheck: isQuickCheck || false,
      isRetake: isRetake || false,
      previousSessionId,
      retakeCount,
    });

    logger.info('PLACEMENT_SESSION_STARTED', {
      sessionId: session.id,
      userId,
      targetCourseId,
      startingLevel,
    });

    return session;
  }

  /**
   * Get next question (hybrid: DB cache first, AI generate if not exists)
   */
  async getNextQuestion(sessionId) {
    const session = await PlacementSession.findByPk(sessionId, {
      include: [
        { model: PlacementQuestion, as: 'questions' },
        { model: PlacementResponse, as: 'responses' },
      ],
    });

    if (!session || session.status !== 'in_progress') {
      throw { status: 404, message: 'Session not found or not in progress' };
    }

    // Check if test should stop
    if (this.shouldStopTest(session)) {
      const result = await this.completeSession(sessionId);
      return { completed: true, result };
    }

    // CRITICAL FIX: Check if there's a current question that hasn't been answered yet
    // This happens when user refreshes or re-enters the test
    const existingQuestions = session.questions || [];
    const existingResponses = session.responses || [];
    
    // Find the most recent question that doesn't have a response
    const answeredQuestionIds = new Set(existingResponses.map(r => r.questionId));
    const unansweredQuestion = existingQuestions
      .sort((a, b) => b.questionIndex - a.questionIndex) // Sort by newest first
      .find(q => !answeredQuestionIds.has(q.id));
    
    if (unansweredQuestion) {
      logger.info('PLACEMENT_RETURNING_EXISTING_QUESTION', {
        sessionId,
        questionId: unansweredQuestion.id,
        questionIndex: unansweredQuestion.questionIndex,
      });
      
      // Return the existing unanswered question WITHOUT creating new one or advancing counter
      return {
        questionId: unansweredQuestion.id,
        questionIndex: unansweredQuestion.questionIndex,
        cefrLevel: unansweredQuestion.cefrLevel,
        skillType: unansweredQuestion.skillType,
        questionType: unansweredQuestion.questionType,
        content: unansweredQuestion.content,
        options: unansweredQuestion.options,
        segments: unansweredQuestion.segments,
        audioText: unansweredQuestion.audioText,
        hint: unansweredQuestion.hint,
        timeLimitSeconds: unansweredQuestion.timeLimitSeconds || 60,
        totalQuestions: MAX_QUESTIONS,
        currentQuestion: session.questionCount, // Don't +1 since we're not advancing
      };
    }

    // Get IDs of questions already asked in this session (from both PlacementQuestion and bank)
    const askedBankQuestionIdsSet = new Set(
      existingQuestions
        .filter(q => q.aiGenerated === false || q.bankQuestionId)
        .map(q => q.bankQuestionId)
        .filter(id => id)
    );
    
    // Get content of all questions already asked (for duplicate check)
    const askedContents = existingQuestions.map(q => this.normalizeContent(q.content));

    // Ability-based adaptive: Calculate current level from ability score
    const currentAbility = session.abilityScore || STARTING_ABILITY;
    const targetLevel = this.getLevelFromAbility(currentAbility);
    const skillType = this.selectSkillType(session.questionCount);
    
    // All question types to try in order
    const questionTypes = ['multiple_choice', 'fill_blank', 'listening', 'sentence_ordering'];
    
    let question = null;
    let selectedType = null;
    const SIMILARITY_THRESHOLD = 0.6;
    
    // Try each question type until we find one from bank at the target level
    for (const qType of questionTypes) {
      if (question) break;
      
      const bankQuestions = await this.getFromQuestionBank(
        currentAbility, 
        skillType, 
        qType, 
        Array.from(askedBankQuestionIdsSet),
        20
      );
      
      if (bankQuestions.length === 0) {
        logger.info('PLACEMENT_BANK_EMPTY_FOR_TYPE', {
          sessionId: session.id,
          cefrLevel: targetLevel,
          skillType,
          questionType: qType,
        });
        continue;
      }
      
      // Take top 10 closest questions and randomly pick one for variety
      const topK = bankQuestions.slice(0, 10);
      const shuffledTopK = this.shuffleArray(topK);
      
      // Find first non-duplicate from shuffled top-k
      for (const bankQuestion of shuffledTopK) {
        const normalizedBankContent = this.normalizeContent(bankQuestion.content);
        const isBankDuplicate = askedContents.some(askedContent => 
          askedContent === normalizedBankContent || 
          this.contentSimilarity(askedContent, normalizedBankContent) > SIMILARITY_THRESHOLD
        );
        
        if (!isBankDuplicate) {
          question = bankQuestion;
          selectedType = qType;
          break;
        } else {
          askedBankQuestionIdsSet.add(bankQuestion.id);
          logger.warn('PLACEMENT_BANK_DUPLICATE_DETECTED', {
            sessionId: session.id,
            bankQuestionId: bankQuestion.id,
            content: bankQuestion.content?.substring(0, 100),
          });
        }
      }
    }
    
    // If still no question found
    if (!question) {
      logger.error('PLACEMENT_BANK_EXHAUSTED_ALL_TYPES', {
        sessionId: session.id,
        cefrLevel: targetLevel,
        skillType,
        askedCount: askedBankQuestionIdsSet.size,
      });
      throw {
        status: 500,
        message: 'Không còn câu hỏi phù hợp trong ngân hàng câu hỏi. Vui lòng liên hệ admin để bổ sung thêm câu hỏi.',
        code: 'BANK_EMPTY',
      };
    }

    // Anti-gaming: Strip old prefixes, shuffle, then add new clean prefixes
    const cleanOptions = (question.options || []).map(opt => this.stripOptionPrefix(opt));
    const shuffledCleanOptions = this.shuffleArray(cleanOptions);
    const formattedOptions = this.formatOptionsWithPrefixes(shuffledCleanOptions);
    
    // Convert correctAnswer from letter (A/B/C/D) to actual text (stripping prefix)
    let correctAnswerText = question.correctAnswer;
    if (question.correctAnswer && question.correctAnswer.length === 1 && question.options) {
      // It's a letter, convert to text from original options (with prefix stripped)
      const letterIndex = question.correctAnswer.charCodeAt(0) - 'A'.charCodeAt(0);
      if (letterIndex >= 0 && letterIndex < question.options.length) {
        correctAnswerText = this.stripOptionPrefix(question.options[letterIndex]);
      }
    } else if (question.correctAnswer) {
      // Already text, just strip prefix if any
      correctAnswerText = this.stripOptionPrefix(question.correctAnswer);
    }
    
    // Create placement question for this session
    // Mark as from bank (aiGenerated: false) and save bankQuestionId
    const placementQuestion = await PlacementQuestion.create({
      sessionId: session.id,
      questionIndex: session.questionCount,
      cefrLevel: targetLevel,
      skillType,
      questionType: selectedType,
      content: question.content,
      options: formattedOptions, // Store with new prefixes A., B., C., D.
      correctAnswer: correctAnswerText, // Store clean text without prefix
      explanation: question.explanation,
      aiGenerated: false, // From question bank
      bankQuestionId: question.id, // Track which bank question this came from
      difficultyScore: question.difficultyScore, // Store difficulty for adaptive scoring
      timeLimitSeconds: 60,
    });

    // Update session question count
    await session.update({ 
      questionCount: session.questionCount + 1,
      lastActivityAt: new Date(),
    });

    // Return question without correct answer
    return {
      questionId: placementQuestion.id,
      questionIndex: placementQuestion.questionIndex,
      cefrLevel: targetLevel,
      abilityScore: session.abilityScore || STARTING_ABILITY,
      difficultyScore: question.difficultyScore,
      skillType,
      questionType: selectedType,
      content: question.content,
      options: formattedOptions, // Return with clean prefixes A., B., C., D.
      segments: question.segments,
      audioText: question.audioText,
      hint: question.hint,
      timeLimitSeconds: 60,
      totalQuestions: MAX_QUESTIONS,
      currentQuestion: session.questionCount + 1,
    };
  }

  /**
   * Submit answer and get next question or result
   */
  async submitAnswer(sessionId, questionId, answer, timeSpentSeconds) {
    const session = await PlacementSession.findByPk(sessionId);
    const question = await PlacementQuestion.findByPk(questionId);

    if (!session || !question) {
      throw { status: 404, message: 'Session or question not found' };
    }

    if (session.status !== 'in_progress') {
      throw { status: 400, message: 'Session is not in progress' };
    }

    // Check if already answered
    const existingResponse = await PlacementResponse.findOne({
      where: { sessionId, questionId },
    });

    if (existingResponse) {
      throw { status: 400, message: 'Question already answered' };
    }

    // Anti-gaming: Check minimum time per question
    if (timeSpentSeconds < MIN_TIME_PER_QUESTION) {
      logger.warn('PLACEMENT_TOO_FAST', {
        sessionId,
        questionId,
        timeSpentSeconds,
        minRequired: MIN_TIME_PER_QUESTION,
      });
      throw {
        status: 400,
        message: `Vui lòng dành ít nhất ${MIN_TIME_PER_QUESTION} giây để đọc và trả lời câu hỏi.`,
        code: 'TOO_FAST',
      };
    }

    // Convert user answer from letter (A/B/C/D) to text if needed
    let userAnswerText = answer;
    if (answer && answer.length === 1 && question.options) {
      // It's a letter, convert to text using shuffled options (strip prefix for comparison)
      const letterIndex = answer.charCodeAt(0) - 'A'.charCodeAt(0);
      if (letterIndex >= 0 && letterIndex < question.options.length) {
        userAnswerText = this.stripOptionPrefix(question.options[letterIndex]);
      }
    } else if (answer) {
      // Already text, strip prefix if any
      userAnswerText = this.stripOptionPrefix(answer);
    }

    // Evaluate answer
    const isCorrect = this.evaluateAnswer(userAnswerText, question.correctAnswer, question.questionType);

    // Save response
    await PlacementResponse.create({
      sessionId,
      questionId,
      answer,
      isCorrect,
      timeSpentSeconds,
    });

    // Ability-based adaptive logic
    // Get current ability score (default to B1 = 3.0 if not set)
    const currentAbility = session.abilityScore || STARTING_ABILITY;
    
    // Update ability based on answer result and question difficulty
    const newAbility = this.updateAbility(currentAbility, question.difficultyScore || 3.0, isCorrect);
    
    // Get new level from ability score
    const newLevel = this.getLevelFromAbility(newAbility);
    
    // Update streak for backward compatibility
    const newStreakCorrect = isCorrect ? (session.streakCorrect || 0) + 1 : 0;
    const newStreakWrong = isCorrect ? 0 : (session.streakWrong || 0) + 1;

    await session.update({
      correctCount: isCorrect ? session.correctCount + 1 : session.correctCount,
      streakCorrect: newStreakCorrect,
      streakWrong: newStreakWrong,
      currentCefrLevel: newLevel,
      abilityScore: newAbility, // Store continuous ability score
      lastActivityAt: new Date(),
    });
    // session.update() returns the updated instance, no need to reload

    logger.info('PLACEMENT_ANSWER_SUBMITTED', {
      sessionId,
      questionId,
      isCorrect,
      currentLevel: newLevel,
      abilityScore: newAbility,
      streakCorrect: newStreakCorrect,
      streakWrong: newStreakWrong,
    });

    // Check if test should auto-complete after this answer
    // Pass false for userChoseToStop - only auto-complete at MAX_QUESTIONS
    const shouldComplete = this.shouldStopTest({
      ...session.toJSON(),
      correctCount: isCorrect ? session.correctCount + 1 : session.correctCount,
      streakCorrect: newStreakCorrect,
      streakWrong: newStreakWrong,
      currentCefrLevel: newLevel,
      abilityScore: newAbility,
    }, false);
    if (shouldComplete) {
      logger.info('PLACEMENT_AUTO_COMPLETING', {
        sessionId,
        questionCount: session.questionCount,
        isQuickCheck: session.isQuickCheck,
      });
      const result = await this.completeSession(sessionId);
      return {
        isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        currentLevel: newLevel,
        streakCorrect: newStreakCorrect,
        streakWrong: newStreakWrong,
        completed: true,
        result,
      };
    }

    // Check if student can choose to stop early (min questions + confident enough)
    const updatedSession = {
      ...session.toJSON(),
      correctCount: isCorrect ? session.correctCount + 1 : session.correctCount,
      streakCorrect: newStreakCorrect,
      streakWrong: newStreakWrong,
      currentCefrLevel: newLevel,
      abilityScore: newAbility,
    };
    const canStopEarly = updatedSession.questionCount >= MIN_QUESTIONS && 
                         this.calculateConfidence(updatedSession) >= CONFIDENCE_THRESHOLD;

    // Return immediate feedback for ongoing test
    return {
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      currentLevel: newLevel,
      abilityScore: newAbility,
      streakCorrect: newStreakCorrect,
      streakWrong: newStreakWrong,
      canStopEarly,
      questionCount: updatedSession.questionCount,
      minQuestions: MIN_QUESTIONS,
      maxQuestions: MAX_QUESTIONS,
    };
  }

  /**
   * Complete session and calculate final result
   */
  async completeSession(sessionId) {
    const session = await PlacementSession.findByPk(sessionId, {
      include: [
        { model: PlacementQuestion, as: 'questions' },
        { model: PlacementResponse, as: 'responses' },
      ],
    });

    if (!session) {
      throw { status: 404, message: 'Session not found' };
    }

    // Calculate final CEFR level using IRT (no AI API call)
    const finalLevel = this.calculateFinalLevel(session);
    const confidenceScore = this.calculateConfidence(session);

    await session.update({
      status: 'completed',
      finalCefrLevel: finalLevel,
      confidenceScore,
      completedAt: new Date(),
    });

    // Rule-based recommendations only (no AI API)
    const skillBreakdown = this.calculateSkillBreakdown(session);

    // Combine both rule-based and skill-based recommendations
    const recommendations = await this.generateRecommendations(session, finalLevel, skillBreakdown);

    logger.info('PLACEMENT_SESSION_COMPLETED', {
      sessionId,
      finalLevel,
      confidenceScore,
      questionCount: session.questionCount,
      correctCount: session.correctCount,
    });

    return {
      sessionId: session.id,
      status: session.status,
      finalLevel: session.finalCefrLevel,
      confidenceScore: session.confidenceScore,
      totalQuestions: session.questionCount,
      correctAnswers: session.correctCount,
      accuracy: session.questionCount > 0 ? (session.correctCount / session.questionCount) : 0,
      skillBreakdown,
      recommendations: await this.generateRecommendations(session, session.finalCefrLevel),
      completedAt: session.completedAt,
    };
  }

  /**
   * Get session result (for retrieving results after completion)
   */
  async getSessionResult(sessionId) {
    const session = await PlacementSession.findByPk(sessionId, {
      include: [
        { model: PlacementQuestion, as: 'questions' },
        { model: PlacementResponse, as: 'responses' },
      ],
    });

    if (!session) {
      throw { status: 404, message: 'Session not found' };
    }

    if (session.status !== 'completed') {
      throw { status: 400, message: 'Session is not completed' };
    }

    const skillBreakdown = this.calculateSkillBreakdown(session);
    const recommendations = await this.generateRecommendations(session, session.finalCefrLevel, skillBreakdown);

    return {
      sessionId: session.id,
      status: session.status,
      finalLevel: session.finalCefrLevel,
      confidenceScore: session.confidenceScore,
      totalQuestions: session.questionCount,
      correctAnswers: session.correctCount,
      accuracy: session.questionCount > 0 ? (session.correctCount / session.questionCount) : 0,
      skillBreakdown,
      recommendations,
      completedAt: session.completedAt,
    };
  }

  /**
   * Get session review with questions and user responses
   * @param {number} sessionId 
   * @param {number} userId 
   */
  async getSessionReview(sessionId, userId) {
    const { PlacementSession, PlacementQuestion, PlacementResponse } = models;

    const session = await PlacementSession.findOne({
      where: { id: sessionId, userId },
      include: [
        { 
          model: PlacementQuestion, 
          as: 'questions',
          through: { attributes: [] }
        },
        { 
          model: PlacementResponse, 
          as: 'responses' 
        }
      ]
    });

    if (!session) {
      throw { status: 404, message: 'Không tìm thấy session' };
    }

    // Map questions with user answers
    const questions = (session.questions || []).map(q => {
      const response = (session.responses || []).find(r => r.questionId === q.id);
      return {
        questionId: q.id,
        type: q.type,
        content: q.content,
        options: q.options,
        correctAnswer: q.correctAnswer,
        userAnswer: response ? response.userAnswer : null,
        isCorrect: response ? response.isCorrect : null,
        cefrLevel: q.cefrLevel,
        skill: q.skill,
        explanation: q.explanation || null
      };
    });

    return {
      sessionId: session.id,
      finalLevel: session.finalCefrLevel,
      accuracy: session.accuracy,
      confidenceScore: session.confidenceScore,
      completedAt: session.completedAt,
      totalQuestions: questions.length,
      questions
    };
  }

  // ====================
  // HELPER METHODS
  // ====================

  mapCourseLevelToCefr(courseLevel) {
    const mapping = {
      'beginner': 'A1',
      'elementary': 'A2',
      'intermediate': 'B1',
      'upper-intermediate': 'B2',
      'advanced': 'C1',
      'proficiency': 'C2',
    };
    return mapping[courseLevel?.toLowerCase()] || 'B1';
  }

  selectSkillType(questionCount) {
    const skills = ['grammar', 'vocabulary', 'reading'];
    return skills[questionCount % skills.length];
  }

  /**
   * Get CEFR level from ability score (1-6 scale)
   * Maps continuous ability to discrete CEFR level
   */
  getLevelFromAbility(abilityScore) {
    if (abilityScore < 1.5) return 'A1';
    if (abilityScore < 2.5) return 'A2';
    if (abilityScore < 3.5) return 'B1';
    if (abilityScore < 4.5) return 'B2';
    if (abilityScore < 5.5) return 'C1';
    return 'C2';
  }

  /**
   * Update ability score based on answer result
   */
  calculateFinalLevelFromAbility(abilityScore) {
    return this.getLevelFromAbility(abilityScore);
  }

  /**
   * Update ability using IRT-based formula with smoothing and clamping
   * @param {number} theta - current ability (1-6)
   * @param {number} b - question difficulty score (1-6)
   * @param {boolean} correct - whether answer was correct
   * @returns {number} new ability score (clamped 1-6)
   */
  updateAbility(theta, b, correct) {
    const LEARNING_RATE = 0.8; // More responsive than 0.5
    
    // IRT: probability of correct answer
    const p = 1 / (1 + Math.exp(-(theta - b)));
    // Error term (observed - expected)
    const error = (correct ? 1 : 0) - p;
    // Update with higher learning rate
    let newAbility = theta + LEARNING_RATE * error;
    
    // Lighter smoothing (50/50 instead of 70/30)
    newAbility = theta * 0.5 + newAbility * 0.5;
    
    // Clamp to valid range 1-6
    return Math.max(1, Math.min(6, newAbility));
  }

  shouldStopTest(session, userChoseToStop = false) {
    // Quick check: always stop at exactly QUICK_CHECK_QUESTIONS (7)
    if (session.isQuickCheck) {
      if (session.questionCount >= QUICK_CHECK_QUESTIONS) return true;
      return false; // Never early stop quick check
    }

    // Stop conditions for full test:
    // 1. Max questions reached - ALWAYS STOP
    if (session.questionCount >= MAX_QUESTIONS) return true;
    
    // 2. Early stop - ONLY if student explicitly chose to stop
    // AND has enough questions + confidence
    if (userChoseToStop && session.questionCount >= MIN_QUESTIONS) {
      const confidence = this.calculateConfidence(session);
      if (confidence >= CONFIDENCE_THRESHOLD) return true;
    }
    
    return false;
  }

  calculateConfidence(session) {
    // Simple adaptive confidence: more questions = more confident
    // This is IRT-lite approach - no accuracy-based calculation
    if (session.questionCount < 5) return 0.3;
    
    const factor = Math.min(session.questionCount / 15, 1);
    return Math.min(0.5 + factor * 0.5, 0.95);
  }

  calculateFinalLevel(session) {
    // Ability-based final level calculation
    // Use the stored ability score if available, otherwise calculate from current level
    if (session.abilityScore && session.abilityScore > 0) {
      return this.getLevelFromAbility(session.abilityScore);
    }
    
    // Fallback to legacy method if ability score not available
    const levelPerformance = {};
    
    for (const question of session.questions || []) {
      const response = session.responses?.find(r => r.questionId === question.id);
      if (!levelPerformance[question.cefrLevel]) {
        levelPerformance[question.cefrLevel] = { correct: 0, total: 0 };
      }
      levelPerformance[question.cefrLevel].total++;
      if (response?.isCorrect) {
        levelPerformance[question.cefrLevel].correct++;
      }
    }

    // Find highest level with > 60% accuracy
    for (let i = CEFR_LEVELS.length - 1; i >= 0; i--) {
      const level = CEFR_LEVELS[i];
      const perf = levelPerformance[level];
      if (perf && (perf.correct / perf.total) > 0.6) {
        return level;
      }
    }
    
    return session.currentCefrLevel;
  }

  calculateSkillBreakdown(session) {
    const breakdown = {};
    
    for (const question of session.questions || []) {
      const response = session.responses?.find(r => r.questionId === question.id);
      if (!breakdown[question.skillType]) {
        breakdown[question.skillType] = { correct: 0, total: 0 };
      }
      breakdown[question.skillType].total++;
      if (response?.isCorrect) {
        breakdown[question.skillType].correct++;
      }
    }

    return Object.entries(breakdown).map(([skill, stats]) => ({
      skill,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) : 0,
      total: stats.total,
      correct: stats.correct,
    }));
  }

  async generateRecommendations(session, finalLevel, skillBreakdown = null) {
    // If target course specified, check compatibility with detailed info
    if (session.targetCourseId) {
      const course = await Course.findByPk(session.targetCourseId, {
        attributes: ['id', 'title', 'level', 'willLearn', 'requirements', 'tags'],
      });
      
      if (course) {
        const courseLevel = this.mapCourseLevelToCefr(course.level);
        const comparison = this.compareLevels(finalLevel, courseLevel);
        
        // Check if course covers weak areas
        let coversWeakAreas = false;
        let weakAreasCovered = [];
        if (skillBreakdown) {
          const weakSkills = skillBreakdown
            .filter(s => s.accuracy < 0.6)
            .map(s => s.skill);
          
          const courseContent = [
            ...(course.willLearn || []),
            ...(course.tags || [])
          ].join(' ').toLowerCase();
          
          weakAreasCovered = weakSkills.filter(skill => 
            courseContent.includes(skill.toLowerCase())
          );
          coversWeakAreas = weakAreasCovered.length > 0;
        }
        
        return {
          targetCourse: {
            id: course.id,
            title: course.title,
            requiredLevel: courseLevel,
            willLearn: course.willLearn || [],
            requirements: course.requirements || [],
            tags: course.tags || [],
          },
          yourLevel: finalLevel,
          match: comparison,
          coversWeakAreas,
          weakAreasCovered,
          message: this.getRecommendationMessage(comparison, finalLevel, courseLevel, coversWeakAreas),
        };
      }
    }

    // General recommendation with skill-based course matching
    const weakAreas = skillBreakdown 
      ? skillBreakdown.filter(s => s.accuracy < 0.6).map(s => s.skill)
      : [];
    
    return {
      yourLevel: finalLevel,
      weakAreas,
      suggestedCourses: await this.getSuggestedCourses(finalLevel, weakAreas, skillBreakdown),
      message: weakAreas.length > 0 
        ? `Bạn đang ở trình độ ${finalLevel}. Dựa trên kết quả test, bạn cần cải thiện: ${weakAreas.join(', ')}. Đây là các khóa học phù hợp:`
        : `Bạn đang ở trình độ ${finalLevel}. Đây là các khóa học phù hợp:`,
    };
  }

  compareLevels(userLevel, courseLevel) {
    const userIdx = CEFR_LEVELS.indexOf(userLevel);
    const courseIdx = CEFR_LEVELS.indexOf(courseLevel);
    
    if (userIdx >= courseIdx) return 'ready'; // User is ready
    if (courseIdx - userIdx === 1) return 'challenging'; // One level above
    return 'not_ready'; // Too advanced
  }

  getRecommendationMessage(match, userLevel, courseLevel, coversWeakAreas = false) {
    switch (match) {
      case 'ready':
        return coversWeakAreas 
          ? `Bạn đã sẵn sàng cho khóa học này! Khóa học còn giúp cải thiện điểm yếu của bạn.`
          : `Bạn đã sẵn sàng cho khóa học này! Trình độ ${userLevel} phù hợp yêu cầu ${courseLevel}.`;
      case 'challenging':
        return `Khóa học có thể hơi thử thách. Bạn nên ôn tập thêm trước khi bắt đầu.`;
      case 'not_ready': {
        // Get next level suggestion
        const idx = CEFR_LEVELS.indexOf(userLevel);
        const nextLevel = idx < CEFR_LEVELS.length - 1 ? CEFR_LEVELS[idx + 1] : userLevel;
        return `Khóa học quá nâng cao. Bạn cần học khóa ${nextLevel} trước.`;
      }
    }
  }

  async getSuggestedCourses(level, weakAreas = [], skillBreakdown = null) {
    const courseLevel = this.cefrToCourseLevel(level);
    
    // Base query: same level, published
    const baseWhere = {
      level: courseLevel,
      published: true,
    };
    
    // If we have weak areas, try to find courses that cover them
    if (weakAreas.length > 0) {
      // For JSON arrays: use json_array_elements_text
      const searchPatterns = weakAreas.map(area => area.toLowerCase());
      
      // Find courses that mention weak areas in willLearn or tags
      const coursesWithWeakAreas = await Course.findAll({
        where: {
          ...baseWhere,
          [Op.or]: [
            // For JSON type columns
            sequelize.literal(`EXISTS (SELECT 1 FROM json_array_elements_text("willLearn") AS elem WHERE LOWER(elem) LIKE ANY(ARRAY[${searchPatterns.map(p => `'%${p}%'`).join(',')}]))`),
            sequelize.literal(`EXISTS (SELECT 1 FROM json_array_elements_text("tags") AS elem WHERE LOWER(elem) LIKE ANY(ARRAY[${searchPatterns.map(p => `'%${p}%'`).join(',')}]))`),
          ],
        },
        attributes: ['id', 'title', 'description', 'imageUrl', 'level', 'willLearn', 'requirements', 'tags'],
        limit: 5,
      });
      
      // If found courses covering weak areas, return them with match score
      if (coursesWithWeakAreas.length > 0) {
        return coursesWithWeakAreas.map(course => {
          const courseContent = [
            ...(course.willLearn || []),
            ...(course.tags || [])
          ].join(' ').toLowerCase();
          
          const matchedWeakAreas = weakAreas.filter(area => 
            courseContent.includes(area.toLowerCase())
          );
          
          return {
            ...course.toJSON(),
            matchScore: matchedWeakAreas.length,
            matchedWeakAreas,
            matchReason: `Khóa học giúp cải thiện: ${matchedWeakAreas.join(', ')}`,
          };
        }).sort((a, b) => b.matchScore - a.matchScore);
      }
    }
    
    // Fallback: return all courses at this level
    const courses = await Course.findAll({
      where: baseWhere,
      attributes: ['id', 'title', 'description', 'imageUrl', 'level', 'willLearn', 'requirements', 'tags'],
      limit: 5,
    });
    
    return courses.map(course => ({
      ...course.toJSON(),
      matchScore: 0,
      matchedWeakAreas: [],
      matchReason: 'Khóa học phù hợp trình độ của bạn',
    }));
  }

  cefrToCourseLevel(cefr) {
    const mapping = {
      'A1': 'beginner',
      'A2': 'elementary',
      'B1': 'intermediate',
      'B2': 'upper-intermediate',
      'C1': 'advanced',
      'C2': 'proficiency',
    };
    return mapping[cefr];
  }

  // ====================
  // HYBRID APPROACH: DB CACHE
  // ====================

  /**
   * Strip letter prefix (A. B. C. D.) from option text
   * Handles formats: "A. option", "A.option", "A) option"
   */
  stripOptionPrefix(option) {
    if (!option) return '';
    // Remove letter prefix patterns: "A. ", "A)", "A) ", etc.
    return option.toString().replace(/^[A-D][.):]\s*/i, '').trim();
  }

  /**
   * Normalize content for duplicate checking
   * Remove extra spaces, lowercase, trim
   */
  normalizeContent(content) {
    if (!content) return '';
    return content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  }

  /**
   * Format options with clean letter prefixes (A, B, C, D)
   * Removes old prefixes and adds new sequential ones
   */
  formatOptionsWithPrefixes(options) {
    if (!options || !Array.isArray(options)) return [];
    return options.map((opt, idx) => {
      const cleanText = this.stripOptionPrefix(opt);
      const letter = String.fromCharCode(65 + idx); // A, B, C, D
      return `${letter}. ${cleanText}`;
    });
  }

  /**
   * Calculate similarity between two strings (0-1)
   * Check if one string contains the other for better duplicate detection
   */
  contentSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // Check if one contains the other (better than character-by-character)
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    
    // Fallback to simple word-based similarity
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  async getFromQuestionBank(ability, skillType, questionType = 'multiple_choice', excludeIds = [], limit = 10) {
    // Continuous adaptive: order by difficulty proximity, no range filter
    logger.info('[DEBUG] getFromQuestionBank - START:', { ability, skillType, questionType, excludeIdsCount: excludeIds.length, limit });
    logger.info('[DEBUG] getFromQuestionBank - Op check:', { Op: typeof Op, hasBetween: Op ? !!Op.between : false });
    
    const whereClause = {
      skillType,
      questionType,
      isActive: true,
    };
    
    // Add range filter for performance - only get questions within 1.5 difficulty points
    const minDifficulty = ability - 1.5;
    const maxDifficulty = ability + 1.5;
    whereClause.difficultyScore = {
      [Op.between]: [minDifficulty, maxDifficulty]
    };
    
    logger.info('[DEBUG] getFromQuestionBank - whereClause:', { 
      skillType, 
      questionType, 
      isActive: true, 
      difficultyRange: `[${minDifficulty}, ${maxDifficulty}]`,
      excludeIds: excludeIds.length > 0 ? excludeIds : 'none'
    });
    
    if (excludeIds.length > 0) {
      whereClause.id = { [Op.notIn]: excludeIds };
    }
    
    // First, count total available questions without filters
    const totalCount = await PlacementQuestionBank.count({
      where: { skillType, questionType, isActive: true }
    });
    logger.info('[DEBUG] getFromQuestionBank - total available (no difficulty filter):', { totalCount });
    
    // Count with difficulty filter
    const filteredCount = await PlacementQuestionBank.count({
      where: whereClause
    });
    logger.info('[DEBUG] getFromQuestionBank - filtered count (with difficulty):', { filteredCount });
    
    // If no questions with difficulty filter, try without filter
    let questions;
    if (filteredCount === 0 && totalCount > 0) {
      logger.info('[DEBUG] getFromQuestionBank - no results with difficulty filter, trying without filter');
      const whereClauseNoDifficulty = {
        skillType,
        questionType,
        isActive: true,
      };
      if (excludeIds.length > 0) {
        whereClauseNoDifficulty.id = { [Op.notIn]: excludeIds };
      }
      questions = await PlacementQuestionBank.findAll({
        where: whereClauseNoDifficulty,
        order: db.sequelize.literal(`ABS(difficulty_score - ${ability})`),
        limit,
      });
      logger.info('[DEBUG] getFromQuestionBank - fallback query result:', { foundCount: questions?.length || 0 });
    } else {
      questions = await PlacementQuestionBank.findAll({
        where: whereClause,
        order: db.sequelize.literal(`ABS(difficulty_score - ${ability})`),
        limit,
      });
    }

    logger.info('[DEBUG] getFromQuestionBank - final result:', { foundCount: questions?.length || 0 });
    
    if (questions && questions.length > 0) {
      return questions.map(q => ({
        id: q.id,
        type: q.questionType,
        content: q.content,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        aiGenerated: q.aiGenerated,
        difficultyScore: q.difficultyScore,
      }));
    }

    return [];
  }

  evaluateAnswer(userAnswer, correctAnswer, questionType) {
    if (!userAnswer) return false;
    
    const normalizedUser = userAnswer.toString().trim().toUpperCase();
    const normalizedCorrect = correctAnswer.toString().trim().toUpperCase();
    
    switch (questionType) {
      case 'multiple_choice':
      case 'listening':
        // correctAnswer is now stored as text (not letter), so compare text-to-text
        // User might send letter (A/B/C/D) or the actual text - try both
        if (normalizedUser === normalizedCorrect) {
          return true;
        }
        // If user sends a letter, we can't validate it without options array
        // The frontend should send the actual text answer, not the letter
        return false;
        
      case 'fill_blank':
        // For fill blank, exact match or accept variations
        return normalizedUser === normalizedCorrect;
        
      case 'sentence_ordering':
        // For sentence ordering, check if order matches (e.g., "A-B-C-D")
        return normalizedUser.replace(/\s/g, '') === normalizedCorrect.replace(/\s/g, '');
        
      default:
        return normalizedUser === normalizedCorrect;
    }
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   * @param {Array} array 
   * @returns {Array} shuffled array
   */
  shuffleArray(array) {
    const shuffled = [...array]; // Create copy to avoid mutating original
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async getProgress(sessionId) {
    const session = await PlacementSession.findByPk(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    const totalQuestions = session.isQuickCheck ? QUICK_CHECK_QUESTIONS : MAX_QUESTIONS;
    return {
      sessionId: session.id,
      status: session.status,
      currentQuestion: session.questionCount,
      totalQuestions,
      currentLevel: session.currentCefrLevel,
      correctCount: session.correctCount,
      accuracy: session.questionCount > 0 ? (session.correctCount / session.questionCount) : 0,
      startedAt: session.created_at,
    };
  }

  /**
   * Get session by ID (for ownership verification)
   * @param {number} sessionId
   * @returns {Object} session
   */
  async getSession(sessionId) {
    return await PlacementSession.findByPk(sessionId);
  }

  /**
   * Cancel a session (user cancels their own test)
   * Same as deleteSession but with user permission check
   * @param {number} sessionId
   */
  async cancelSession(sessionId) {
    // Reuse deleteSession logic
    return await this.deleteSession(sessionId);
  }

  /**
   * Get current in-progress session for user (for resume test)
   */
  async getCurrentInProgressSession(userId) {
    if (!userId) return null;
    
    const session = await PlacementSession.findOne({
      where: {
        userId,
        status: 'in_progress',
      },
      order: [['created_at', 'DESC']], // Get most recent
    });
    
    return session;
  }

  // ==================== RETAKE & HISTORY ====================

  /**
   * Check if user is eligible to retake placement test
   * @param {number} userId 
   * @returns {Object} eligibility info
   */
  async checkRetakeEligibility(userId) {
    logger.info('RETAKE_ELIGIBILITY_START', { userId });
    
    // Find any session (in_progress or completed)
    const lastSession = await PlacementSession.findOne({
      where: {
        userId,
      },
      order: [['created_at', 'DESC']],
    });

    logger.info('RETAKE_ELIGIBILITY_QUERY_DONE', { userId, hasSession: !!lastSession, status: lastSession?.status });

    // No session at all
    if (!lastSession) {
      return {
        canRetake: true,
        message: 'Bạn chưa từng làm placement test.',
        lastTestDate: null,
        daysRemaining: 0,
        nextRetakeDate: null,
      };
    }

    // Has in-progress session - should continue, not retake
    if (lastSession.status === 'in_progress') {
      return {
        canRetake: false,
        message: 'Bạn đang có một bài test chưa hoàn thành. Hãy tiếp tục làm bài đó.',
        lastTestDate: lastSession.createdAt,
        daysRemaining: 0,
        nextRetakeDate: null,
        hasInProgressSession: true,
        inProgressSessionId: lastSession.id,
      };
    }

    // Calculate cooldown for completed session
    const lastTestDate = new Date(lastSession.completedAt);
    const now = new Date();
    const daysSinceLastTest = Math.floor((now - lastTestDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, RETAKE_COOLDOWN_DAYS - daysSinceLastTest);
    const canRetake = daysRemaining === 0;

    const nextRetakeDate = canRetake 
      ? null 
      : new Date(lastTestDate.getTime() + RETAKE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

    logger.info('RETAKE_ELIGIBILITY_RESULT', { userId, canRetake, daysRemaining });
    
    return {
      canRetake,
      message: canRetake 
        ? 'Bạn có thể làm lại placement test.'
        : `Bạn cần chờ thêm ${daysRemaining} ngày nữa để làm lại test.`,
      lastTestDate,
      daysRemaining,
      nextRetakeDate,
      hasInProgressSession: false,
      lastResult: {
        level: lastSession.finalCefrLevel,
        accuracy: lastSession.questionCount > 0 
          ? (lastSession.correctCount / lastSession.questionCount) 
          : 0,
        isQuickCheck: lastSession.isQuickCheck,
      },
    };
  }

  /**
   * Get user's placement test history
   * @param {number} userId 
   * @param {Object} options 
   * @returns {Array} placement history
   */
  async getUserPlacementHistory(userId, options = {}) {
    const { limit = 10, includeDetails = false } = options;

    const sessions = await PlacementSession.findAll({
      where: {
        userId,
        status: 'completed',
      },
      include: includeDetails ? [
        {
          model: PlacementResponse,
          as: 'responses',
          include: [{
            model: PlacementQuestion,
            as: 'question',
            attributes: ['skillType', 'cefrLevel', 'questionText'],
          }],
        },
      ] : [],
      order: [['completedAt', 'DESC']],
      limit,
    });

    return sessions.map(session => ({
      id: session.id,
      finalLevel: session.finalCefrLevel,
      confidence: session.confidenceScore,
      accuracy: session.questionCount > 0 
        ? (session.correctCount / session.questionCount) 
        : 0,
      questionCount: session.questionCount,
      isQuickCheck: session.isQuickCheck,
      isRetake: session.isRetake,
      retakeCount: session.retakeCount,
      completedAt: session.completedAt,
      createdAt: session.createdAt,
      responses: includeDetails ? session.responses?.map(r => ({
        skillType: r.question?.skillType,
        cefrLevel: r.question?.cefrLevel,
        isCorrect: r.isCorrect,
        timeSpent: r.timeSpentSeconds,
      })) : undefined,
    }));
  }

  /**
   * Get retake count for user
   * @param {number} userId 
   * @returns {number} retake count
   */
  async getRetakeCount(userId) {
    const count = await PlacementSession.count({
      where: {
        userId,
        status: 'completed',
        isRetake: true,
      },
    });
    return count;
  }

  /**
   * Admin: Get detailed user placement history
   * @param {number} userId 
   * @param {boolean} includeDetails 
   */
  async getUserHistoryForAdmin(userId, includeDetails = false) {
    const sessions = await PlacementSession.findAll({
      where: { userId },
      include: includeDetails ? [
        {
          model: PlacementResponse,
          as: 'responses',
          include: [{ model: PlacementQuestion, as: 'question' }],
        },
      ] : [],
      order: [['created_at', 'DESC']],
    });

    return sessions.map(session => ({
      id: session.id,
      status: session.status,
      finalCefrLevel: session.finalCefrLevel,
      questionCount: session.questionCount,
      correctCount: session.correctCount,
      accuracy: session.questionCount > 0 ? (session.correctCount / session.questionCount) : 0,
      confidence: session.confidence,
      isQuickCheck: session.isQuickCheck,
      isRetake: session.isRetake,
      retakeCount: session.retakeCount,
      completedAt: session.completedAt,
      createdAt: session.createdAt,
      responses: includeDetails ? session.responses?.map(r => ({
        id: r.id,
        questionId: r.questionId,
        cefrLevel: r.question?.cefrLevel,
        skillType: r.question?.skillType,
        questionType: r.question?.questionType,
        isCorrect: r.isCorrect,
        isSkipped: r.isSkipped,
        timeSpentSeconds: r.timeSpentSeconds,
      })) : undefined,
    }));
  }

  /**
   * Admin: Reset cooldown for user (allow immediate retake)
   * @param {number} userId 
   */
  async resetCooldown(userId) {
    // Find the most recent completed session
    const lastSession = await PlacementSession.findOne({
      where: {
        userId,
        status: 'completed',
      },
      order: [['completedAt', 'DESC']],
    });

    if (!lastSession) {
      throw { status: 404, message: 'Không tìm thấy bài test đã hoàn thành cho user này' };
    }

    // Mark as not requiring cooldown (set completedAt to very old date)
    await lastSession.update({
      completedAt: new Date('2000-01-01'), // Reset to very old date
      isRetake: false,
    });

    logger.info('PLACEMENT_COOLDOWN_RESET', {
      userId,
      sessionId: lastSession.id,
      adminAction: true,
    });

    return {
      success: true,
      message: 'Đã reset cooldown cho user. User có thể làm lại placement test ngay lập tức.',
      previousSessionId: lastSession.id,
      previousLevel: lastSession.finalCefrLevel,
    };
  }

  /**
   * Admin: Delete a placement session
   * @param {number} sessionId 
   */
  async deleteSession(sessionId) {
    const session = await PlacementSession.findByPk(sessionId, {
      include: [{ model: PlacementResponse, as: 'responses' }],
    });

    if (!session) {
      throw { status: 404, message: 'Session không tồn tại' };
    }

    const userId = session.userId;

    // Delete related responses first
    if (session.responses?.length > 0) {
      await PlacementResponse.destroy({
        where: { sessionId },
      });
    }

    // Delete related questions
    await PlacementQuestion.destroy({
      where: { sessionId },
    });

    // Delete the session
    await session.destroy();

    logger.info('PLACEMENT_SESSION_DELETED', {
      sessionId,
      userId,
      adminAction: true,
    });

    return {
      success: true,
      message: 'Đã xóa session và tất cả dữ liệu liên quan',
      deletedSessionId: sessionId,
      userId,
    };
  }
}

module.exports = new PlacementService();
