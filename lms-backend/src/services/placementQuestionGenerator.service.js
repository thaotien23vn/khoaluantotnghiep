const db = require('../models');
const aiGateway = require('./aiGateway.service');
const logger = require('../utils/logger');

const { PlacementQuestionBank } = db.models;

// CEFR levels and skills to generate questions for
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SKILL_TYPES = ['grammar', 'vocabulary', 'reading'];

// Target: 100 questions per level-skill combination
const TARGET_QUESTIONS_PER_COMBO = 100;
const MIN_QUESTIONS_THRESHOLD = 50; // Generate if below this
const BATCH_SIZE = 5; // Generate 5 at a time per batch to avoid rate limits
const DELAY_BETWEEN_BATCHES_MS = 8000; // 8s delay between batches

class PlacementQuestionGenerator {
  /**
   * Main entry point - run nightly to pre-generate questions
   */
  async generateAllMissingQuestions() {
    logger.info('PLACEMENT_BATCH_GENERATION_START');
    const results = {
      generated: 0,
      failed: 0,
      errors: [],
    };

    for (const cefrLevel of CEFR_LEVELS) {
      for (const skillType of SKILL_TYPES) {
        try {
          const count = await this.getQuestionCount(cefrLevel, skillType);
          const needed = TARGET_QUESTIONS_PER_COMBO - count;

          if (needed > 0) {
            logger.info('PLACEMENT_GENERATING_BATCH', {
              cefrLevel,
              skillType,
              currentCount: count,
              needed,
            });

            const generated = await this.generateBatch(cefrLevel, skillType, Math.min(needed, 20));
            results.generated += generated;

            // Delay between combinations
            await this.sleep(DELAY_BETWEEN_BATCHES_MS);
          }
        } catch (err) {
          logger.error('PLACEMENT_BATCH_GENERATE_ERROR', {
            cefrLevel,
            skillType,
            error: err.message,
          });
          results.failed++;
          results.errors.push({ cefrLevel, skillType, error: err.message });
        }
      }
    }

    logger.info('PLACEMENT_BATCH_GENERATION_COMPLETE', results);
    return results;
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
  async generateBatch(cefrLevel, skillType, count) {
    let generated = 0;
    const batches = Math.ceil(count / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const batchSize = Math.min(BATCH_SIZE, count - generated);
      
      for (let j = 0; j < batchSize; j++) {
        try {
          const question = await this.generateSingleQuestion(cefrLevel, skillType);
          if (question) {
            await this.saveQuestion(question, cefrLevel, skillType);
            generated++;
          }
        } catch (err) {
          logger.warn('PLACEMENT_SINGLE_GENERATE_FAILED', {
            cefrLevel,
            skillType,
            error: err.message,
          });
        }
        
        // Small delay between individual questions
        if (j < batchSize - 1) {
          await this.sleep(2000);
        }
      }

      // Delay between batches
      if (i < batches - 1) {
        await this.sleep(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    return generated;
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
        timeoutMs: 15000,
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
          needed: Math.max(0, TARGET_QUESTIONS_PER_COMBO - count),
        };
      }
    }

    return stats;
  }
}

module.exports = new PlacementQuestionGenerator();
