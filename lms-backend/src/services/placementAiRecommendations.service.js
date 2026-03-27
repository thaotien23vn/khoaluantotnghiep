const db = require('../models');
const aiGateway = require('./aiGateway.service');
const logger = require('../utils/logger');

const { AiRecommendation } = db.models;

/**
 * Placement AI Recommendations Service
 * Generates personalized study advice based on placement test results using AI
 */
class PlacementAiRecommendationsService {
  /**
   * Generate AI-powered recommendations after placement test
   * @param {Object} session - PlacementSession instance
   * @param {Object} skillBreakdown - Performance by skill type
   * @param {string} finalLevel - CEFR level (A1-C2)
   * @returns {Object} AI recommendations with study advice
   */
  async generatePlacementRecommendations(session, skillBreakdown, finalLevel) {
    try {
      const prompt = this.buildPlacementRecommendationPrompt(session, skillBreakdown, finalLevel);

      const aiResponse = await aiGateway.generateText({
        system: 'Bạn là chuyên gia tư vấn học tập tiếng Anh. Phân tích kết quả placement test và đưa ra lời khuyên cá nhân hóa.',
        prompt,
        maxOutputTokens: 1200,
        temperature: 0.7,
        timeoutMs: 15000,
      });

      const recommendations = this.parseAiRecommendations(aiResponse.text, finalLevel);

      // Save to database if user is logged in
      if (session.userId) {
        await this.savePlacementRecommendation(session, recommendations);
      }

      logger.info('PLACEMENT_AI_RECOMMENDATIONS_GENERATED', {
        sessionId: session.id,
        finalLevel,
        hasWeakAreas: recommendations.weakAreas?.length > 0,
      });

      return recommendations;
    } catch (err) {
      logger.error('PLACEMENT_AI_RECOMMENDATIONS_FAILED', {
        sessionId: session.id,
        error: err.message,
      });

      // Fallback to basic recommendations
      return this.getFallbackRecommendations(finalLevel, skillBreakdown);
    }
  }

  /**
   * Build prompt for AI placement recommendations
   */
  buildPlacementRecommendationPrompt(session, skillBreakdown, finalLevel) {
    const skillAnalysis = skillBreakdown.map(s => 
      `- ${s.skill}: ${Math.round(s.accuracy * 100)}% đúng (${s.correct}/${s.total})`
    ).join('\n');

    return `Phân tích kết quả placement test và đưa ra lời khuyên học tập.

THÔNG TIN:
- Trình độ đánh giá: ${finalLevel}
- Độ chính xác: ${Math.round((session.correctCount / session.questionCount) * 100)}%
- Số câu đã làm: ${session.questionCount}

PHÂN TÍCH THEO KỸ NĂNG:
${skillAnalysis}

Yêu cầu trả về JSON:
{
  "overallAssessment": "Đánh giá tổng quan 2-3 câu",
  "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"],
  "weakAreas": ["Điểm yếu 1", "Điểm yếu 2"],
  "studyPlan": {
    "immediate": "Hành động ngay",
    "shortTerm": "Mục tiêu 1-2 tuần",
    "longTerm": "Mục tiêu 1-3 tháng"
  },
  "suggestedResources": [
    {"type": "grammar", "resource": "Tài nguyên cụ thể"},
    {"type": "vocabulary", "resource": "Tài nguyên cụ thể"}
  ],
  "nextSteps": ["Bước 1", "Bước 2", "Bước 3"]
}

Chỉ trả về JSON, không thêm text khác.`;
  }

  /**
   * Parse AI response into structured recommendations
   */
  parseAiRecommendations(text, finalLevel) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          finalLevel,
          aiGenerated: true,
          overallAssessment: parsed.overallAssessment || '',
          strengths: parsed.strengths || [],
          weakAreas: parsed.weakAreas || [],
          studyPlan: {
            immediate: parsed.studyPlan?.immediate || 'Tiếp tục luyện tập hàng ngày',
            shortTerm: parsed.studyPlan?.shortTerm || 'Hoàn thành khóa học phù hợp',
            longTerm: parsed.studyPlan?.longTerm || 'Nâng cao trình độ lên cấp độ tiếp theo',
          },
          suggestedResources: parsed.suggestedResources || [],
          nextSteps: parsed.nextSteps || [],
        };
      }
    } catch (err) {
      logger.warn('PLACEMENT_AI_PARSE_FAILED', { text: text?.substring(0, 200) });
    }

    return this.getFallbackRecommendations(finalLevel);
  }

  /**
   * Get fallback recommendations when AI fails
   */
  getFallbackRecommendations(finalLevel, skillBreakdown = []) {
    const levelAdvice = {
      A1: {
        overallAssessment: 'Bạn đang ở trình độ mới bắt đầu. Cần tập trung vào nền tảng cơ bản.',
        strengths: ['Bắt đầu hành trình học tiếng Anh'],
        weakAreas: ['Ngữ pháp cơ bản', 'Từ vựng thông dụng'],
        nextSteps: ['Học thuộc 10 từ mới mỗi ngày', 'Luyện nghe cơ bản 15 phút/ngày'],
      },
      A2: {
        overallAssessment: 'Bạn đã có nền tảng cơ bản. Cần mở rộng vốn từ và thực hành nhiều hơn.',
        strengths: ['Hiểu các cấu trúc câu đơn giản'],
        weakAreas: ['Thì quá khứ', 'Từ vựng chủ đề cụ thể'],
        nextSteps: ['Luyện nói về chủ đề hàng ngày', 'Đọc truyện ngắn đơn giản'],
      },
      B1: {
        overallAssessment: 'Trình độ trung cấp tốt. Bạn có thể giao tiếp trong hầu hết các tình huống.',
        strengths: ['Giao tiếp cơ bản', 'Đọc hiểu văn bản đơn giản'],
        weakAreas: ['Cấu trúc phức tạp', 'Collocations'],
        nextSteps: ['Học idioms thông dụng', 'Xem phim không phụ đề đơn giản'],
      },
      B2: {
        overallAssessment: 'Trình độ khá tốt. Bạn có thể tương tác hiệu quả với người bản xứ.',
        strengths: ['Ngữ pháp nâng cao', 'Viết văn bản rõ ràng'],
        weakAreas: ['Ngữ điệu tinh tế', 'Phrasal verbs nâng cao'],
        nextSteps: ['Đọc báo/bài viết học thuật', 'Thực hành viết luận'],
      },
      C1: {
        overallAssessment: 'Trình độ cao cấp. Bạn sử dụng ngôn ngữ linh hoạt và hiệu quả.',
        strengths: ['Ngôn ngữ linh hoạt', 'Hiểu ngữ cảnh phức tạp'],
        weakAreas: ['Từ vựng học thuật chuyên ngành'],
        nextSteps: ['Đọc tài liệu chuyên ngành', 'Thuyết trình chuyên nghiệp'],
      },
      C2: {
        overallAssessment: 'Trình độ thành thạo. Bạn đã đạt đến mức độ tương đương người bản xứ.',
        strengths: ['Sử dụng ngôn ngữ chính xác', 'Hiểu sắc thái tinh tế'],
        weakAreas: ['Có thể bảo trì và nâng cao thêm'],
        nextSteps: ['Giảng dạy tiếng Anh', 'Viết sách/bài báo tiếng Anh'],
      },
    };

    const advice = levelAdvice[finalLevel] || levelAdvice.B1;

    return {
      finalLevel,
      aiGenerated: false,
      overallAssessment: advice.overallAssessment,
      strengths: advice.strengths,
      weakAreas: advice.weakAreas,
      studyPlan: {
        immediate: 'Tiếp tục luyện tập hàng ngày',
        shortTerm: `Hoàn thành khóa học ${finalLevel}`,
        longTerm: `Đạt trình độ ${this.getNextLevel(finalLevel)}`,
      },
      suggestedResources: [],
      nextSteps: advice.nextSteps,
    };
  }

  /**
   * Save placement recommendation to database
   */
  async savePlacementRecommendation(session, recommendations) {
    try {
      await AiRecommendation.create({
        userId: session.userId,
        courseId: session.targetCourseId || null,
        recommendationType: 'placement_result',
        content: recommendations,
        confidenceScore: 0.85,
        metadata: {
          placementSessionId: session.id,
          finalLevel: recommendations.finalLevel,
          isQuickCheck: session.isQuickCheck,
        },
        status: 'new',
      });
    } catch (err) {
      logger.warn('PLACEMENT_RECOMMENDATION_SAVE_FAILED', { error: err.message });
    }
  }

  /**
   * Get next CEFR level
   */
  getNextLevel(currentLevel) {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const currentIdx = levels.indexOf(currentLevel);
    return currentIdx < levels.length - 1 ? levels[currentIdx + 1] : 'C2+';
  }

  /**
   * Get historical recommendations for user
   */
  async getUserPlacementRecommendations(userId, options = {}) {
    const { limit = 5 } = options;

    return await AiRecommendation.findAll({
      where: {
        userId,
        recommendationType: 'placement_result',
      },
      order: [['createdAt', 'DESC']],
      limit,
    });
  }
}

module.exports = new PlacementAiRecommendationsService();
