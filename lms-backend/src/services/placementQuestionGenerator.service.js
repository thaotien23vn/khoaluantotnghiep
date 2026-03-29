const db = require('../models');
const aiGateway = require('./aiGateway.service');
const logger = require('../utils/logger');

const { PlacementQuestionBank } = db.models;

// CEFR levels and skills to generate questions for
// 6 combos: A1-grammar, A1-vocab, A2-grammar, A2-vocab, B1-grammar, B1-vocab
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SKILL_TYPES = ['grammar', 'vocabulary', 'reading'];
const CEFR_PRIORITY = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
const SKILL_PRIORITY = { grammar: 0, vocabulary: 1, reading: 2 };

// Target: Total 20 questions per run, distributed to lowest count combos first
const TOTAL_QUESTIONS_PER_RUN = 20;
const MAX_QUESTIONS_PER_COMBO = 10; // Cap per combo to ensure distribution
const BATCH_SIZE = 3; // Generate 3 at a time to be safer with rate limits
const DELAY_BETWEEN_BATCHES_MS = 15000; // 15s delay between batches

const MAX_CONSECUTIVE_FAILURES = 2; // Stop after 2 consecutive failures

class PlacementQuestionGenerator {
  /**
   * Main entry point - run nightly to pre-generate questions
   */
  async generateAllMissingQuestions(signal) {
    logger.info('PLACEMENT_BATCH_GENERATION_START', { targetTotal: TOTAL_QUESTIONS_PER_RUN });
    const results = {
      generated: 0,
      failed: 0,
      errors: [],
      stoppedEarly: false,
      reason: null,
      distribution: {}, // Track how many per combo
    };
    let consecutiveFailures = 0;

    // Generate until we reach TOTAL_QUESTIONS_PER_RUN
    while (results.generated < TOTAL_QUESTIONS_PER_RUN) {
      // Check for abort signal
      if (signal?.aborted) {
        logger.info('PLACEMENT_GENERATION_ABORTED_BY_USER');
        results.stoppedEarly = true;
        results.reason = 'Cancelled by user';
        return results;
      }

      // Check if too many consecutive failures
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        logger.error('PLACEMENT_GENERATION_STOPPED_TOO_MANY_FAILURES', {
          consecutiveFailures,
          maxAllowed: MAX_CONSECUTIVE_FAILURES,
          generatedSoFar: results.generated,
        });
        results.stoppedEarly = true;
        results.reason = `Stopped after ${consecutiveFailures} consecutive failures`;
        return results;
      }

      // Get current counts for ALL combos and find the one with lowest count
      const allCombos = await this.getAllComboCounts();
      const sortedCombos = allCombos
        .filter(c => c.currentCount < MAX_QUESTIONS_PER_COMBO) // Don't exceed cap
        .sort((a, b) => {
          // First sort by count (ascending)
          if (a.currentCount !== b.currentCount) {
            return a.currentCount - b.currentCount;
          }
          // If counts equal, prioritize lower CEFR level
          if (CEFR_PRIORITY[a.cefrLevel] !== CEFR_PRIORITY[b.cefrLevel]) {
            return CEFR_PRIORITY[a.cefrLevel] - CEFR_PRIORITY[b.cefrLevel];
          }
          // If same level, prioritize grammar > vocabulary > reading
          return SKILL_PRIORITY[a.skillType] - SKILL_PRIORITY[b.skillType];
        });

      if (sortedCombos.length === 0) {
        logger.info('PLACEMENT_ALL_COMBOS_AT_CAP', { generated: results.generated });
        results.stoppedEarly = true;
        results.reason = 'All combos reached max questions per combo';
        break;
      }

      // Pick the combo with lowest count (first in sorted list)
      const targetCombo = sortedCombos[0];
      const { cefrLevel, skillType, currentCount } = targetCombo;

      logger.info('PLACEMENT_GENERATING_SINGLE', {
        cefrLevel,
        skillType,
        currentCount,
        totalGenerated: results.generated,
        targetTotal: TOTAL_QUESTIONS_PER_RUN,
        remaining: TOTAL_QUESTIONS_PER_RUN - results.generated,
      });

      try {
        // Generate 1 question at a time
        const batchResult = await this.generateBatch(cefrLevel, skillType, 1, signal);
        
        if (batchResult.generated > 0) {
          results.generated += batchResult.generated;
          consecutiveFailures = 0;
          
          // Track distribution
          const key = `${cefrLevel}-${skillType}`;
          results.distribution[key] = (results.distribution[key] || 0) + 1;
          
          logger.info('PLACEMENT_SINGLE_SUCCESS', {
            cefrLevel,
            skillType,
            newCount: currentCount + 1,
            totalGenerated: results.generated,
          });
        } else {
          consecutiveFailures++;
          logger.warn('PLACEMENT_SINGLE_FAILED', {
            cefrLevel,
            skillType,
            consecutiveFailures,
          });
          
          // Check stop condition immediately after failure
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            logger.error('PLACEMENT_GENERATION_STOPPED_TOO_MANY_FAILURES', {
              consecutiveFailures,
              maxAllowed: MAX_CONSECUTIVE_FAILURES,
              generatedSoFar: results.generated,
              lastCefrLevel: cefrLevel,
              lastSkillType: skillType,
            });
            results.stoppedEarly = true;
            results.reason = `Stopped after ${consecutiveFailures} consecutive failures at ${cefrLevel}-${skillType}`;
            return results;
          }
        }

        // Small delay between individual questions (4s to avoid rate limits)
        if (results.generated < TOTAL_QUESTIONS_PER_RUN) {
          await this.sleepWithAbortCheck(4000, signal); // 4s between questions
        }
      } catch (err) {
        logger.error('PLACEMENT_SINGLE_ERROR', {
          cefrLevel,
          skillType,
          error: err.message,
        });
        results.failed++;
        consecutiveFailures++;
        results.errors.push({ cefrLevel, skillType, error: err.message });
        
        // Extra backoff if rate limited (429)
        if (err.statusCode === 429 || err.code === 'ALL_KEYS_RATE_LIMITED' || 
            err.message?.includes('429')) {
          const backoffMs = Math.min(8000 * consecutiveFailures, 30000); // 8s, 16s, max 30s
          logger.warn('PLACEMENT_RATE_LIMIT_BACKOFF', {
            consecutiveFailures,
            backoffMs,
          });
          await this.sleepWithAbortCheck(backoffMs, signal);
        }
      }
    }

    logger.info('PLACEMENT_BATCH_GENERATION_COMPLETE', {
      ...results,
      distribution: results.distribution,
    });
    return results;
  }

  /**
   * Get counts for all combos
   */
  async getAllComboCounts() {
    const combos = [];
    for (const cefrLevel of CEFR_LEVELS) {
      for (const skillType of SKILL_TYPES) {
        const currentCount = await this.getQuestionCount(cefrLevel, skillType);
        combos.push({ cefrLevel, skillType, currentCount });
      }
    }
    return combos;
  }

  /**
   * Get current question count for a level-skill combination
   */
  async getQuestionCount(cefrLevel, skillType) {
    return PlacementQuestionBank.count({
      where: {
        cefrLevel,
        skillType,
        isActive: true,
      },
    });
  }

  /**
   * Generate a batch of questions
   */
  async generateBatch(cefrLevel, skillType, count, signal) {
    let generated = 0;
    let failedInBatch = 0;
    let hadSuccess = false;
    const batches = Math.ceil(count / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      // Check for abort signal
      if (signal?.aborted) {
        return { generated, failedInBatch, hadSuccess };
      }

      const batchSize = Math.min(BATCH_SIZE, count - generated);
      
      for (let j = 0; j < batchSize; j++) {
        // Check for abort signal
        if (signal?.aborted) {
          return { generated, failedInBatch, hadSuccess };
        }

        try {
          const question = await this.generateSingleQuestion(cefrLevel, skillType);
          if (question) {
            await this.saveQuestion(question, cefrLevel, skillType);
            generated++;
            hadSuccess = true;
          } else {
            failedInBatch++;
          }
        } catch (err) {
          logger.warn('PLACEMENT_SINGLE_GENERATE_FAILED', {
            cefrLevel,
            skillType,
            error: err.message,
          });
          failedInBatch++;
        }
        
        // Small delay between individual questions (5s to respect 15 RPM per key)
        if (j < batchSize - 1) {
          await this.sleepWithAbortCheck(5000, signal);
        }
      }

      // Delay between batches
      if (i < batches - 1) {
        await this.sleepWithAbortCheck(DELAY_BETWEEN_BATCHES_MS, signal);
      }
    }

    return { generated, failedInBatch, hadSuccess };
  }

  /**
   * Generate a single question using AI
   */
  async generateSingleQuestion(cefrLevel, skillType) {
    const prompt = this.buildPrompt(cefrLevel, skillType);

    try {
      const aiResponse = await aiGateway.generateText({
        system: 'Bạn là chuyên gia đánh giá trình độ tiếng Anh. Tạo câu hỏi placement test chất lượng cao.',
        prompt,
        maxOutputTokens: 800,
        timeoutMs: 30000,
      });

      return this.parseAiResponse(aiResponse.text);
    } catch (err) {
      logger.error('PLACEMENT_AI_GENERATE_FAILED', {
        cefrLevel,
        skillType,
        error: err.message,
      });
      return null;
    }
  }

  /**
   * Build prompt for AI
   */
  buildPrompt(cefrLevel, skillType) {
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
    };

    return `Tạo 1 câu hỏi placement test ${skillPrompts[skillType]} cho trình độ ${cefrLevel} (${levelDescriptions[cefrLevel]}).

Format JSON:
{
  "type": "multiple_choice",
  "content": "Câu hỏi...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correctAnswer": "A",
  "explanation": "Giải thích ngắn gọn..."
}

Yêu cầu:
- Độ khó phù hợp ${cefrLevel}
- 4 options cho multiple choice
- Chỉ trả về JSON, không thêm text khác`;
  }

  /**
   * Parse AI response
   */
  parseAiResponse(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          type: parsed.type || 'multiple_choice',
          content: parsed.content,
          options: parsed.options || [],
          correctAnswer: parsed.correctAnswer,
          explanation: parsed.explanation || '',
        };
      }
    } catch (err) {
      logger.warn('PLACEMENT_AI_PARSE_FAILED', { text: text?.substring(0, 100) });
    }
    return null;
  }

  /**
   * Save question to database
   */
  async saveQuestion(question, cefrLevel, skillType) {
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
  }

  /**
   * Utility: sleep with abort signal check
   */
  sleepWithAbortCheck(ms, signal) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('AbortError'));
        }, { once: true });
      }
    });
  }

  /**
   * Utility: sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get statistics about question bank
   */
  async getBankStatistics() {
    const stats = {};
    
    for (const cefrLevel of CEFR_LEVELS) {
      stats[cefrLevel] = {};
      for (const skillType of SKILL_TYPES) {
        const count = await this.getQuestionCount(cefrLevel, skillType);
        stats[cefrLevel][skillType] = {
          count,
          needed: Math.max(0, MAX_QUESTIONS_PER_COMBO - count),
        };
      }
    }

    return stats;
  }
}

module.exports = new PlacementQuestionGenerator();
