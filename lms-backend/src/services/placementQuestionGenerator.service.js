const db = require('../models');
const aiGateway = require('./aiGateway.service');
const logger = require('../utils/logger');

const { PlacementQuestionBank } = db.models;

// CEFR levels in order
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SKILL_TYPES = ['grammar', 'vocabulary', 'reading'];

// Target total questions per run
const TOTAL_QUESTIONS_PER_RUN = 20;
const MAX_QUESTIONS_PER_LEVEL = 20; // Cap per CEFR level

class PlacementQuestionGenerator {
  /**
   * Main entry point - generate exactly 20 questions in a single AI call
   * Distributed based on current database counts to save RPM quota
   */
  async generateAllMissingQuestions(signal) {
    logger.info('PLACEMENT_BATCH_GENERATION_START', { targetTotal: TOTAL_QUESTIONS_PER_RUN });
    const results = {
      generated: 0,
      failed: 0,
      errors: [],
      stoppedEarly: false,
      reason: null,
      distribution: {},
    };

    // Check for abort signal
    if (signal?.aborted) {
      logger.info('PLACEMENT_GENERATION_ABORTED_BY_USER');
      results.stoppedEarly = true;
      results.reason = 'Cancelled by user';
      return results;
    }

    try {
      // Step 1: Get current counts for all CEFR levels
      const levelCounts = await this.getLevelCounts();
      logger.info('PLACEMENT_CURRENT_LEVEL_COUNTS', { counts: levelCounts });

      // Step 2: Calculate distribution for 20 new questions
      const distribution = this.calculateDistribution(levelCounts);
      logger.info('PLACEMENT_CALCULATED_DISTRIBUTION', { distribution });

      // Check if distribution is empty (all levels at cap)
      const totalToGenerate = Object.values(distribution).reduce((sum, count) => sum + count, 0);
      if (totalToGenerate === 0) {
        logger.info('PLACEMENT_ALL_LEVELS_AT_CAP');
        results.stoppedEarly = true;
        results.reason = 'All CEFR levels reached max questions';
        return results;
      }

      // Step 3: Generate all questions in a SINGLE AI request to save RPM
      logger.info('PLACEMENT_PROCESSING_SINGLE_REQUEST', { totalToGenerate });
      const questions = await this.generateQuestionsBatch(distribution, signal);
      
      if (signal?.aborted) {
        results.stoppedEarly = true;
        results.reason = 'Cancelled by user';
        return results;
      }

      if (!questions || questions.length === 0) {
        results.failed = 1;
        results.errors.push({ error: 'No questions generated from AI' });
        results.stoppedEarly = true;
        results.reason = 'AI returned no questions or all keys exhausted';
        return results;
      }

      // Step 4: Save all questions to database
      let savedCount = 0;
      for (const question of questions) {
        if (signal?.aborted) {
          results.stoppedEarly = true;
          results.reason = 'Cancelled during saving';
          break;
        }

        try {
          await this.saveQuestion(question);
          savedCount++;
          
          // Track distribution
          const key = `${question.cefrLevel}-${question.skillType}`;
          results.distribution[key] = (results.distribution[key] || 0) + 1;
        } catch (err) {
          logger.error('PLACEMENT_SAVE_QUESTION_FAILED', {
            question: question.content?.substring(0, 50),
            error: err.message,
          });
          results.failed++;
          results.errors.push({ question: question.content?.substring(0, 50), error: err.message });
        }
      }

      results.generated = savedCount;

      if (savedCount === 0) {
        results.stoppedEarly = true;
        results.reason = 'Failed to save any questions';
      }

    } catch (err) {
      logger.error('PLACEMENT_GENERATION_ERROR', { error: err.message });
      results.failed = 1;
      results.errors.push({ error: err.message });
      results.stoppedEarly = true;
      results.reason = err.message;
    }

    logger.info('PLACEMENT_BATCH_GENERATION_COMPLETE', {
      ...results,
      distribution: results.distribution,
    });
    
    return results;
  }

  /**
   * Split distribution into batches of max batchSize questions
   */
  splitDistributionIntoBatches(distribution, batchSize) {
    const batches = [];
    const entries = Object.entries(distribution);
    
    // Sort by count descending to prioritize levels needing more questions
    entries.sort((a, b) => b[1] - a[1]);
    
    let currentBatch = {};
    let currentBatchTotal = 0;
    
    for (const [level, count] of entries) {
      let remaining = count;
      
      while (remaining > 0) {
        const availableSpace = batchSize - currentBatchTotal;
        
        if (availableSpace <= 0) {
          // Current batch is full, start new batch
          batches.push(currentBatch);
          currentBatch = {};
          currentBatchTotal = 0;
          continue;
        }
        
        const toAdd = Math.min(remaining, availableSpace);
        currentBatch[level] = (currentBatch[level] || 0) + toAdd;
        currentBatchTotal += toAdd;
        remaining -= toAdd;
        
        if (currentBatchTotal >= batchSize) {
          batches.push(currentBatch);
          currentBatch = {};
          currentBatchTotal = 0;
        }
      }
    }
    
    // Don't forget the last batch if it has content
    if (currentBatchTotal > 0) {
      batches.push(currentBatch);
    }
    
    return batches;
  }

  /**
   * Get total question count for each CEFR level (sum of all skill types)
   */
  async getLevelCounts() {
    const counts = {};
    for (const level of CEFR_LEVELS) {
      const totalCount = await PlacementQuestionBank.count({
        where: {
          cefrLevel: level,
          isActive: true,
        },
      });
      counts[level] = totalCount;
    }
    return counts;
  }

  /**
   * Calculate distribution of 20 questions across CEFR levels
   * Based on inverse proportion to current counts
   */
  calculateDistribution(levelCounts) {
    const distribution = {};
    
    // Calculate need scores
    const needScores = {};
    let totalNeed = 0;
    
    for (const level of CEFR_LEVELS) {
      const currentCount = levelCounts[level] || 0;
      const need = Math.max(0, MAX_QUESTIONS_PER_LEVEL - currentCount);
      needScores[level] = need;
      totalNeed += need;
    }
    
    // If all levels at cap, return empty
    if (totalNeed === 0) {
      return distribution;
    }
    
    // Calculate proportional distribution
    const rawDistribution = {};
    let allocatedTotal = 0;
    
    for (const level of CEFR_LEVELS) {
      if (needScores[level] > 0) {
        const proportion = needScores[level] / totalNeed;
        const allocated = Math.floor(proportion * TOTAL_QUESTIONS_PER_RUN);
        rawDistribution[level] = allocated;
        allocatedTotal += allocated;
      } else {
        rawDistribution[level] = 0;
      }
    }
    
    // Distribute remaining questions
    let remaining = TOTAL_QUESTIONS_PER_RUN - allocatedTotal;
    const sortedLevels = CEFR_LEVELS.filter(l => needScores[l] > 0)
      .sort((a, b) => needScores[b] - needScores[a]);
    
    for (const level of sortedLevels) {
      if (remaining <= 0) break;
      rawDistribution[level]++;
      remaining--;
    }
    
    // Build final distribution
    for (const level of CEFR_LEVELS) {
      if (rawDistribution[level] > 0) {
        distribution[level] = rawDistribution[level];
      }
    }
    
    return distribution;
  }

  /**
   * Generate questions batch using single AI call
   */
  async generateQuestionsBatch(distribution, signal) {
    const prompt = this.buildBatchPrompt(distribution);
    const totalQuestions = Object.values(distribution).reduce((sum, c) => sum + c, 0);
    
    try {
      logger.info('PLACEMENT_AI_BATCH_GENERATE_START', { distribution, totalQuestions });
      
      const aiResponse = await aiGateway.generateText({
        system: 'Bạn là chuyên gia đánh giá trình độ tiếng Anh. Tạo câu hỏi placement test chất lượng cao.',
        prompt,
        maxOutputTokens: totalQuestions <= 10 ? 3000 : 5000,
        timeoutMs: 90000, // Increased to 90s for 20 questions
      });

      if (signal?.aborted) {
        return [];
      }

      const questions = this.parseBatchResponse(aiResponse.text);
      
      logger.info('PLACEMENT_AI_BATCH_GENERATE_COMPLETE', { 
        count: questions.length,
        expected: totalQuestions 
      });
      
      return questions;
    } catch (err) {
      logger.error('PLACEMENT_AI_BATCH_GENERATE_FAILED', { error: err.message, distribution });
      return [];
    }
  }

  /**
   * Build prompt for generating batch of questions
   */
  buildBatchPrompt(distribution) {
    const levelDescriptions = {
      'A1': 'người mới bắt đầu, từ vựng cơ bản, câu đơn giản',
      'A2': 'sơ cấp, giao tiếp hàng ngày đơn giản',
      'B1': 'trung cấp, miêu tả kinh nghiệm, ý kiến',
      'B2': 'trung cấp cao, tương tác phức tạp, văn bản chi tiết',
      'C1': 'cao cấp, ngôn ngữ linh hoạt, hiểu ngụ ý',
      'C2': 'thành thạo, chính xác cao, phân biệt tinh tế',
    };

    const distributionText = Object.entries(distribution)
      .map(([level, count]) => {
        return `- ${level}: ${count} câu (${levelDescriptions[level]})`;
      })
      .join('\n');

    const totalQuestions = Object.values(distribution).reduce((sum, c) => sum + c, 0);

    return `Tạo ${totalQuestions} câu hỏi placement test phân bổ theo trình độ CEFR:

PHÂN BỔ CÂU HỎI:
${distributionText}

YÊU CẦU CHUNG:
- Tổng ${totalQuestions} câu multiple choice
- Mỗi câu có 4 options (A, B, C, D)
- Câu hỏi đa dạng: grammar, vocabulary, reading comprehension
- Độ khó phù hợp từng trình độ CEFR

FORMAT JSON (MẢNG ${totalQuestions} CÂU):
[
  {
    "cefrLevel": "A1",
    "skillType": "grammar",
    "type": "multiple_choice",
    "content": "Câu hỏi...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correctAnswer": "A",
    "explanation": "Giải thích ngắn gọn..."
  },
  ... (tổng ${totalQuestions} câu)
]

QUAN TRỌNG:
- Chỉ trả về JSON array, không thêm text khác
- Mỗi câu PHẢI có cefrLevel và skillType
- Đảm bảo đúng số lượng mỗi trình độ theo phân bổ trên`;
  }

  /**
   * Parse batch AI response
   */
  parseBatchResponse(text) {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn('PLACEMENT_BATCH_PARSE_NO_ARRAY', { text: text?.substring(0, 100) });
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsed)) {
        logger.warn('PLACEMENT_BATCH_PARSE_NOT_ARRAY', { parsed });
        return [];
      }

      const validQuestions = parsed
        .map((item, index) => this.normalizeQuestion(item, index))
        .filter(q => q !== null);

      logger.info('PLACEMENT_BATCH_PARSE_SUCCESS', { 
        total: parsed.length, 
        valid: validQuestions.length 
      });

      return validQuestions;
    } catch (err) {
      logger.error('PLACEMENT_BATCH_PARSE_FAILED', { 
        error: err.message,
        text: text?.substring(0, 200) 
      });
      return [];
    }
  }

  /**
   * Normalize and validate a single question
   */
  normalizeQuestion(item, index) {
    try {
      if (!item.cefrLevel || !item.content || !item.options || !item.correctAnswer) {
        logger.warn('PLACEMENT_QUESTION_MISSING_FIELDS', { index, item });
        return null;
      }

      if (!CEFR_LEVELS.includes(item.cefrLevel)) {
        logger.warn('PLACEMENT_QUESTION_INVALID_LEVEL', { index, level: item.cefrLevel });
        return null;
      }

      const skillType = item.skillType || 'grammar';
      if (!SKILL_TYPES.includes(skillType)) {
        logger.warn('PLACEMENT_QUESTION_INVALID_SKILL', { index, skill: skillType });
        return null;
      }

      return {
        cefrLevel: item.cefrLevel,
        skillType: skillType,
        questionType: item.type || 'multiple_choice',
        content: item.content,
        options: Array.isArray(item.options) ? item.options : [],
        correctAnswer: item.correctAnswer,
        explanation: item.explanation || '',
        aiGenerated: true,
        isActive: true,
      };
    } catch (err) {
      logger.warn('PLACEMENT_QUESTION_NORMALIZE_FAILED', { index, error: err.message });
      return null;
    }
  }

  /**
   * Save question to database
   */
  async saveQuestion(question) {
    await PlacementQuestionBank.create({
      cefrLevel: question.cefrLevel,
      skillType: question.skillType,
      questionType: question.questionType,
      content: question.content,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      aiGenerated: question.aiGenerated,
      isActive: question.isActive,
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
   * Get statistics about question bank
   */
  async getBankStatistics() {
    const stats = {};
    
    for (const cefrLevel of CEFR_LEVELS) {
      stats[cefrLevel] = {};
      for (const skillType of SKILL_TYPES) {
        const count = await PlacementQuestionBank.count({
          where: {
            cefrLevel,
            skillType,
            isActive: true,
          },
        });
        stats[cefrLevel][skillType] = {
          count,
          needed: Math.max(0, 10 - count),
        };
      }
    }

    return stats;
  }
}

module.exports = new PlacementQuestionGenerator();
