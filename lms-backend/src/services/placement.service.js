const db = require('../models');
const aiGateway = require('./aiGateway.service');
const placementAiRecommendations = require('./placementAiRecommendations.service');
const logger = require('../utils/logger');

const {
  PlacementSession,
  PlacementQuestion,
  PlacementResponse,
  Course,
  PlacementQuestionBank,
} = db.models;

// CEFR levels in order
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Adaptive logic constants
const LEVEL_UP_STREAK = 2;    // 2 correct -> level up
const LEVEL_DOWN_STREAK = 3;  // 3 wrong -> level down
const MAX_QUESTIONS = 20;     // Max questions per test
const QUICK_CHECK_QUESTIONS = 7;  // Quick check has max 7 questions
const MIN_QUESTIONS = 8;      // Min questions before early stop
const CONFIDENCE_THRESHOLD = 0.85; // Stop when confident enough
const RETAKE_COOLDOWN_DAYS = 30;   // Days before can retake

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

    const currentLevel = session.currentCefrLevel;
    const skillType = this.selectSkillType(session.questionCount);
    
    // Randomly select question type for variety
    const questionTypes = ['multiple_choice', 'fill_blank', 'listening', 'sentence_ordering'];
    const selectedType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    
    // Try to get from question bank first (hybrid approach)
    let question = await this.getFromQuestionBank(currentLevel, skillType, selectedType);
    
    // If not in bank or we want fresh AI questions, generate with AI
    if (!question) {
      question = await this.generateAiQuestion(session, currentLevel, skillType, selectedType);
      
      // Save to question bank for future reuse
      await this.saveToQuestionBank(question, currentLevel, skillType);
    }

    // Anti-gaming: Shuffle options so correct answer position varies
    const shuffledOptions = this.shuffleArray(question.options || []);
    
    // Create placement question for this session
    const placementQuestion = await PlacementQuestion.create({
      sessionId: session.id,
      questionIndex: session.questionCount,
      cefrLevel: currentLevel,
      skillType,
      questionType: question.type,
      content: question.content,
      options: shuffledOptions,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      aiGenerated: question.aiGenerated || true,
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
      cefrLevel: currentLevel,
      skillType,
      questionType: question.type,
      content: question.content,
      options: question.options,
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

    // Evaluate answer
    const isCorrect = this.evaluateAnswer(answer, question.correctAnswer, question.questionType);

    // Save response
    await PlacementResponse.create({
      sessionId,
      questionId,
      answer,
      isCorrect,
      timeSpentSeconds,
    });

    // Update session stats and streak
    const newStreakCorrect = isCorrect ? session.streakCorrect + 1 : 0;
    const newStreakWrong = isCorrect ? 0 : session.streakWrong + 1;
    
    let newLevel = session.currentCefrLevel;
    
    // Adaptive logic: Level up/down based on streak
    if (newStreakCorrect >= LEVEL_UP_STREAK) {
      newLevel = this.levelUp(session.currentCefrLevel);
    } else if (newStreakWrong >= LEVEL_DOWN_STREAK) {
      newLevel = this.levelDown(session.currentCefrLevel);
    }

    await session.update({
      correctCount: isCorrect ? session.correctCount + 1 : session.correctCount,
      streakCorrect: newStreakCorrect,
      streakWrong: newStreakWrong,
      currentCefrLevel: newLevel,
      lastActivityAt: new Date(),
    });

    logger.info('PLACEMENT_ANSWER_SUBMITTED', {
      sessionId,
      questionId,
      isCorrect,
      currentLevel: newLevel,
      streakCorrect: newStreakCorrect,
      streakWrong: newStreakWrong,
    });

    // Return immediate feedback
    return {
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      currentLevel: newLevel,
      streakCorrect: newStreakCorrect,
      streakWrong: newStreakWrong,
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

    // Calculate final CEFR level
    const finalLevel = this.calculateFinalLevel(session);
    const confidenceScore = this.calculateConfidence(session);

    await session.update({
      status: 'completed',
      finalCefrLevel: finalLevel,
      confidenceScore,
      completedAt: new Date(),
    });

    // Generate AI-powered recommendations
    const aiRecommendations = await placementAiRecommendations.generatePlacementRecommendations(
      session,
      skillBreakdown,
      finalLevel
    );

    // Combine both rule-based and AI recommendations
    const recommendations = await this.generateRecommendations(session, finalLevel);
    recommendations.aiInsights = aiRecommendations;

    logger.info('PLACEMENT_SESSION_COMPLETED', {
      sessionId,
      finalLevel,
      confidenceScore,
      questionCount: session.questionCount,
      correctCount: session.correctCount,
    });

    return {
      sessionId: session.id,
      finalLevel,
      confidenceScore,
      totalQuestions: session.questionCount,
      correctAnswers: session.correctCount,
      recommendations,
    };
  }

  /**
   * Get session result
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
      return { status: session.status, progress: this.getProgress(session) };
    }

    const skillBreakdown = this.calculateSkillBreakdown(session);

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
      aiRecommendations: result.aiInsights,
      completedAt: session.completedAt,
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

  levelUp(currentLevel) {
    const idx = CEFR_LEVELS.indexOf(currentLevel);
    return idx < CEFR_LEVELS.length - 1 ? CEFR_LEVELS[idx + 1] : currentLevel;
  }

  levelDown(currentLevel) {
    const idx = CEFR_LEVELS.indexOf(currentLevel);
    return idx > 0 ? CEFR_LEVELS[idx - 1] : currentLevel;
  }

  shouldStopTest(session) {
    // Quick check: always stop at exactly QUICK_CHECK_QUESTIONS (7)
    if (session.isQuickCheck) {
      if (session.questionCount >= QUICK_CHECK_QUESTIONS) return true;
      return false; // Never early stop quick check
    }

    // Stop conditions for full test:
    // 1. Max questions reached
    if (session.questionCount >= MAX_QUESTIONS) return true;
    
    // 2. Min questions and confident enough
    if (session.questionCount >= MIN_QUESTIONS) {
      const confidence = this.calculateConfidence(session);
      if (confidence >= CONFIDENCE_THRESHOLD) return true;
    }
    
    // 3. No change in level for last 5 questions (stabilized)
    // This would require tracking level history
    
    return false;
  }

  calculateConfidence(session) {
    // Simple confidence based on consistency
    if (session.questionCount < 5) return 0.5;
    
    const correctRate = session.correctCount / session.questionCount;
    const consistency = 1 - Math.abs(correctRate - 0.5) * 2; // Higher when around 50%
    
    // More questions = more confident
    const questionFactor = Math.min(session.questionCount / 15, 1);
    
    return Math.min(consistency * questionFactor + 0.5, 0.95);
  }

  calculateFinalLevel(session) {
    // Weighted by performance at each level
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

  async generateRecommendations(session, finalLevel) {
    // If target course specified, check compatibility
    if (session.targetCourseId) {
      const course = await Course.findByPk(session.targetCourseId, {
        attributes: ['id', 'title', 'level'],
      });
      
      if (course) {
        const courseLevel = this.mapCourseLevelToCefr(course.level);
        const comparison = this.compareLevels(finalLevel, courseLevel);
        
        return {
          targetCourse: {
            id: course.id,
            title: course.title,
            requiredLevel: courseLevel,
          },
          yourLevel: finalLevel,
          match: comparison,
          message: this.getRecommendationMessage(comparison, finalLevel, courseLevel),
        };
      }
    }

    // General recommendation
    return {
      yourLevel: finalLevel,
      suggestedCourses: await this.getSuggestedCourses(finalLevel),
      message: `Bạn đang ở trình độ ${finalLevel}. Đây là các khóa học phù hợp:`,
    };
  }

  compareLevels(userLevel, courseLevel) {
    const userIdx = CEFR_LEVELS.indexOf(userLevel);
    const courseIdx = CEFR_LEVELS.indexOf(courseLevel);
    
    if (userIdx >= courseIdx) return 'ready'; // User is ready
    if (courseIdx - userIdx === 1) return 'challenging'; // One level above
    return 'not_ready'; // Too advanced
  }

  getRecommendationMessage(match, userLevel, courseLevel) {
    switch (match) {
      case 'ready':
        return `Bạn đã sẵn sàng cho khóa học này! Trình độ ${userLevel} phù hợp yêu cầu ${courseLevel}.`;
      case 'challenging':
        return `Khóa học có thể hơi thử thách. Bạn nên ôn tập thêm trước khi bắt đầu.`;
      case 'not_ready':
        return `Khóa học quá nâng cao. Bạn cần học khóa ${this.levelUp(userLevel)} trước.`;
    }
  }

  async getSuggestedCourses(level) {
    // Find courses matching the level
    const courses = await Course.findAll({
      where: { 
        level: this.cefrToCourseLevel(level),
        published: true,
      },
      attributes: ['id', 'title', 'description', 'imageUrl', 'level'],
      limit: 5,
    });
    
    return courses;
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

  async getFromQuestionBank(cefrLevel, skillType, questionType = 'multiple_choice') {
    // Get random question from bank matching criteria
    const question = await PlacementQuestionBank.findOne({
      where: {
        cefrLevel,
        skillType,
        questionType,
        isActive: true,
      },
      order: db.sequelize.random(),
    });

    if (question) {
      // Increment usage count
      await question.increment('usageCount');
      
      return {
        type: question.questionType,
        content: question.content,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        aiGenerated: question.aiGenerated,
      };
    }

    return null;
  }

  async saveToQuestionBank(question, cefrLevel, skillType) {
    try {
      await PlacementQuestionBank.create({
        cefrLevel,
        skillType,
        questionType: question.type,
        content: question.content,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        aiGenerated: true,
        isActive: true,
      });
      
      logger.info('PLACEMENT_QUESTION_SAVED_TO_BANK', { cefrLevel, skillType });
    } catch (err) {
      // Non-critical error
      logger.warn('PLACEMENT_BANK_SAVE_FAILED', { error: err.message });
    }
  }

  // ====================
  // AI GENERATION
  // ====================

  async generateAiQuestion(session, cefrLevel, skillType, questionType = 'multiple_choice') {
    const prompt = this.buildPrompt(cefrLevel, skillType, questionType);
    
    try {
      const aiResponse = await aiGateway.generateText({
        system: 'Bạn là chuyên gia đánh giá trình độ tiếng Anh. Tạo câu hỏi placement test chất lượng cao.',
        prompt,
        maxOutputTokens: 800,
        timeoutMs: 15000,
      });

      const question = this.parseAiResponse(aiResponse.text, questionType);
      
      logger.info('PLACEMENT_AI_QUESTION_GENERATED', {
        sessionId: session.id,
        cefrLevel,
        skillType,
        questionType,
      });

      return {
        ...question,
        aiGenerated: true,
        aiRawResponse: aiResponse.text,
        aiPrompt: prompt,
      };
    } catch (err) {
      logger.error('PLACEMENT_AI_GENERATION_FAILED', {
        sessionId: session.id,
        cefrLevel,
        skillType,
        questionType,
        error: err.message,
      });
      
      // Fallback to simple question
      return this.getFallbackQuestion(cefrLevel, skillType);
    }
  }

  buildPrompt(cefrLevel, skillType, questionType = 'multiple_choice') {
    const levelDescriptions = {
      'A1': 'người mới bắt đầu, từ vựng cơ bản, câu đơn giản',
      'A2': 'sơ cấp, giao tiếp hàng ngày đơn giản',
      'B1': 'trung cấp, miêu tả kinh nghiệm, ý kiến',
      'B2': 'trung cấp cao, tương tác phức tạp, văn bản chi tiết',
      'C1': 'cao cấp, ngôn ngữ linh hoạt, hiểu ngụ ý',
      'C2': 'thành thạo, chính xác cao, phân biệt tinh tế',
    };

    const skillPrompts = {
      'grammar': 'ngữ pháp (thì, cấu trúc câu, giới từ)',
      'vocabulary': 'từ vựng (nghĩa từ, collocation, phrasal verb)',
      'reading': 'đọc hiểu (đoạn văn ngắn + câu hỏi)',
      'listening': 'nghe hiểu',
    };

    // Different formats based on question type
    const typeFormats = {
      'multiple_choice': {
        format: `{
  "type": "multiple_choice",
  "content": "Câu hỏi...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correctAnswer": "A",
  "explanation": "Giải thích..."
}`,
        requirements: '- 4 options cho multiple choice\n- correctAnswer là A, B, C, hoặc D',
      },
      'fill_blank': {
        format: `{
  "type": "fill_blank",
  "content": "Câu có chỗ trống ____ để điền từ.",
  "correctAnswer": "từ điền vào",
  "explanation": "Giải thích...",
  "hint": "gợi ý (nếu cần)"
}`,
        requirements: '- Câu có dấu ____ hoặc ______\n- correctAnswer là từ điền vào chỗ trống',
      },
      'listening': {
        format: `{
  "type": "listening",
  "content": "Transcript hoặc mô tả audio...",
  "audioText": "Nội dung audio script",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correctAnswer": "A",
  "explanation": "Giải thích..."
}`,
        requirements: '- Tạo transcript ngắn (2-3 câu đối thoại hoặc 1 đoạn ngắn)\n- 4 options trả lời\n- correctAnswer là A, B, C, hoặc D',
      },
      'sentence_ordering': {
        format: `{
  "type": "sentence_ordering",
  "content": "Sắp xếp các phần thành câu hoàn chỉnh",
  "segments": ["phần 1", "phần 2", "phần 3", "phần 4"],
  "correctAnswer": "A-B-C-D",
  "explanation": "Giải thích thứ tự đúng..."
}`,
        requirements: '- 4 segments để học sinh sắp xếp\n- correctAnswer là thứ tự đúng ví dụ: "B-A-C-D"',
      },
    };

    const typeFormat = typeFormats[questionType] || typeFormats['multiple_choice'];

    return `Tạo 1 câu hỏi placement test ${skillPrompts[skillType]} cho trình độ ${cefrLevel} (${levelDescriptions[cefrLevel]}).

LOẠI CÂU HỎI: ${questionType}

Format JSON:
${typeFormat.format}

Yêu cầu:
- Độ khó phù hợp ${cefrLevel}
${typeFormat.requirements}
- Chỉ trả về JSON, không thêm text khác`;
  }

  parseAiResponse(text, questionType = 'multiple_choice') {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Base question structure
        const question = {
          type: parsed.type || questionType,
          content: parsed.content,
          correctAnswer: parsed.correctAnswer,
          explanation: parsed.explanation || '',
        };

        // Add type-specific fields
        switch (questionType) {
          case 'multiple_choice':
          case 'listening':
            question.options = parsed.options || [];
            if (questionType === 'listening') {
              question.audioText = parsed.audioText || '';
            }
            break;
          case 'fill_blank':
            question.hint = parsed.hint || '';
            break;
          case 'sentence_ordering':
            question.segments = parsed.segments || [];
            break;
          default:
            question.options = parsed.options || [];
        }

        return question;
      }
    } catch (err) {
      logger.warn('PLACEMENT_AI_PARSE_FAILED', { text: text?.substring(0, 100), questionType });
    }
    
    return this.getFallbackQuestion('B1', 'grammar');
  }

  getFallbackQuestion(cefrLevel, skillType) {
    const fallbacks = {
      'A1': {
        type: 'multiple_choice',
        content: 'Choose the correct sentence: "I ___ a student."',
        options: ['A. am', 'B. is', 'C. are', 'D. be'],
        correctAnswer: 'A',
        explanation: 'I goes with "am"',
      },
      'A2': {
        type: 'multiple_choice',
        content: 'Yesterday, I ___ to the cinema.',
        options: ['A. go', 'B. went', 'C. gone', 'D. going'],
        correctAnswer: 'B',
        explanation: 'Past tense of go is "went"',
      },
      'B1': {
        type: 'multiple_choice',
        content: 'If I ___ more time, I would learn French.',
        options: ['A. have', 'B. had', 'C. would have', 'D. will have'],
        correctAnswer: 'B',
        explanation: 'Second conditional uses past simple',
      },
      'B2': {
        type: 'multiple_choice',
        content: 'Despite ___ late, they managed to catch the train.',
        options: ['A. to be', 'B. being', 'C. been', 'D. be'],
        correctAnswer: 'B',
        explanation: 'After despite, use gerund (being)',
      },
      'C1': {
        type: 'multiple_choice',
        content: 'The company is expected to ___ significant losses this quarter.',
        options: ['A. post', 'B. publish', 'C. announce', 'D. declare'],
        correctAnswer: 'A',
        explanation: '"Post losses" is the correct business collocation',
      },
      'C2': {
        type: 'multiple_choice',
        content: 'The veracity of his claims was ___ by independent auditors.',
        options: ['A. substantiated', 'B. supported', 'C. confirmed', 'D. backed'],
        correctAnswer: 'A',
        explanation: '"Substantiated" implies formal verification with evidence',
      },
    };

    return fallbacks[cefrLevel] || fallbacks['B1'];
  }

  evaluateAnswer(userAnswer, correctAnswer, questionType) {
    if (!userAnswer) return false;
    
    const normalizedUser = userAnswer.toString().trim().toUpperCase();
    const normalizedCorrect = correctAnswer.toString().trim().toUpperCase();
    
    switch (questionType) {
      case 'multiple_choice':
      case 'listening':
        // For multiple choice, check letter (A, B, C, D) or full option
        if (normalizedUser.length === 1) {
          return normalizedUser === normalizedCorrect.charAt(0);
        }
        return normalizedUser === normalizedCorrect;
        
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
