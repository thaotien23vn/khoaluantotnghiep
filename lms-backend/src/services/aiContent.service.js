const db = require('../models');
const { Op } = require('sequelize');
const aiGateway = require('./aiGateway.service');
const logger = require('../utils/logger');
const { safeAiCall } = require('../utils/aiSafeCaller');

// Content cleaning utility
function cleanContent(content) {
  if (!content || typeof content !== 'string') return content;
  
  return content
    // Remove common AI response prefixes
    .replace(/^(Chào bạn,?\s*)?(với tư cách là|tôi là|tôi rất hào hứng|tôi sẽ giúp|dưới đây là|đây là)[^\n]*\n*/gi, '')
    // Remove markdown code block markers if content is wrapped in them
    .replace(/^```(?:markdown|text)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    // Clean up multiple consecutive newlines
    .replace(/\n{4,}/g, '\n\n\n')
    // Remove trailing spaces
    .replace(/[ \t]+$/gm, '')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Trim
    .trim();
}

const {
  ContentQualityScore,
  Course,
  Chapter,
  Lecture,
  Quiz,
  Question,
  UserLearningProfile,
  LearningAnalytics,
} = db.models;

class AiContentService {
  /**
   * Generate lecture content from outline
   */
  async generateLectureContent(courseId, chapterId, outlineData) {
    try {
      const {
        title,
        outline,
        targetAudience,
        difficulty = 'intermediate',
        estimatedDuration = 60,
        learningObjectives = [],
      } = outlineData;

      // Get course context
      const course = await Course.findByPk(courseId, {
        attributes: ['title'],
      });

      if (!course) {
        throw {
          status: 404,
          message: 'Không tìm thấy khóa học',
          code: 'COURSE_NOT_FOUND',
        };
      }

      const chapter = await Chapter.findByPk(chapterId, {
        attributes: ['title'],
      });

      if (!chapter) {
        throw {
          status: 404,
          message: 'Không tìm thấy chương',
          code: 'CHAPTER_NOT_FOUND',
        };
      }

      const systemPrompt = `Bạn là một chuyên gia tạo nội dung học tập trực tuyến (e-learning) cho học viên TỰ HỌC. 
Nội dung phải được viết TRỰC TIẾP cho học viên, không phải giáo viên.

QUAN TRỌNG:
- Viết ở ngôi thứ 2 ("bạn" - học viên)
- KHÔNG có: "Ghi chú cho giảng viên", "Người dẫn (GV)", "Pair work", "Hoạt động lớp"
- Học viên tự đọc và tự làm bài tập cá nhân
- Có interactive elements: quick quiz, flashcards
- Thêm video scripts nếu cần

Yêu cầu chất lượng:
- Nội dung rõ ràng, có cấu trúc logic
- Phù hợp cấp độ: ${difficulty}
- Thời lượng: ${estimatedDuration} phút
- Đối tượng: ${targetAudience || 'Học viên tự học online'}
- Có tính tương tác và engagement`;

      const prompt = `Tạo nội dung TỰ HỌC cho lecture với thông tin sau:

COURSE: ${course.title}
${course.description ? `MÔ TẢ KHÓA HỌC: ${course.description}` : ''}

CHAPTER: ${chapter.title}
${chapter.description ? `MÔ TẢ CHƯƠNG: ${chapter.description}` : ''}

LECTURE TITLE: ${title}
OUTLINE:
${outline}

MỤC TIÊU HỌC TẬP:
${learningObjectives.length > 0 ? learningObjectives.join('\n') : 'Chưa xác định'}

YÊU CẦU NỘI DUNG (VIẾT TRỰC TIẾP CHO HỌC VIÊN):

1. 🎯 MỞ ĐẦU (5-7 phút)
   - Giải thích tại sao học viên cần học chủ đề này
   - Lợi ích thực tế trong công việc/cuộc sống
   - Không có lời chào/thân mật không cần thiết

2. 📚 NỘI DUNG CHÍNH (30-40 phút) - Chia thành sections nhỏ
   Mỗi section có:
   - Explanation trực tiếp (ngôi thứ 2)
   - Real-world examples cụ thể
   - 💡 Pro tips: "Mẹo thực hành"
   - ⚠️ Common mistakes: "Lỗi thường gặp và cách tránh"

3. 🎮 INTERACTIVE ELEMENTS
   - 🎯 Quick Check: 2-3 câu hỏi ngắn có đáp án giải thích
   - 📝 Key Takeaways: 3-5 điểm chính cần nhớ
   - ✏️ Practice Exercise: Bài tập cá nhân (không cần partner)

4. 🔚 TÓM TẮT (3-5 phút)
   - Những điểm quan trọng nhất để áp dụng ngay

5. 🚀 NEXT STEPS
   - Gợi ý bài học tiếp theo hoặc resources bổ sung

QUY TẮC:
- KHÔNG bắt đầu bằng "Chào bạn", "Dưới đây là", "Tôi sẽ"
- KHÔNG có "Giáo viên cần...", "GV nên..."
- Viết ngắn gọn, súc tích, dễ đọc
- Dùng emojis để tăng visual appeal

Format: Markdown với headings rõ ràng.`;

      const aiResponse = await aiGateway.generateText({
        system: systemPrompt,
        prompt,
        maxOutputTokens: 4096,
        timeoutMs: 120000, // 120s timeout cho lecture dài
      });

      const content = cleanContent(aiResponse.text);

      // Get the lecture ID from the context or generate one
      const lecture = await Lecture.findOne({
        where: { title, chapterId },
        order: [['createdAt', 'DESC']],
      });
      
      const lectureId = lecture ? lecture.id : null;

      // Analyze content quality
      const qualityScore = await this.analyzeContentQuality(lectureId, content, 'lecture');

      return {
        content,
        qualityScore,
        metadata: {
          estimatedDuration,
          difficulty,
          targetAudience,
          learningObjectives,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      logger.error('LECTURE_CONTENT_GENERATION_FAILED', {
        courseId,
        chapterId,
        outlineData,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw {
        status: error.status || 500,
        message: error.message || 'Không thể tạo lecture content',
        code: error.code || 'LECTURE_CONTENT_GENERATION_FAILED',
      };
    }
  }

  /**
   * Generate quiz questions from lecture content
   */
  async generateQuizQuestions(lectureId, options = {}) {
    try {
      const {
        questionCount = 5,  // Giảm từ 10 xuống 5 để tránh timeout
        questionTypes = ['multiple_choice', 'true_false', 'short_answer'],
        difficulty = 'mixed',
      } = options;

      // Get lecture content
      const lecture = await Lecture.findByPk(lectureId, {
        include: [
          {
            model: Chapter,
            include: [
              {
                model: Course,
                attributes: ['title', 'category'],
              },
            ],
          },
        ],
      });

      if (!lecture) {
        throw {
          status: 404,
          message: 'Lecture not found',
          code: 'LECTURE_NOT_FOUND',
        };
      }

      const chapter = lecture.Chapter;

      const systemPrompt = `Bạn là một chuyên gia giáo dục trong việc tạo câu hỏi kiểm tra chất lượng cao. Tạo câu hỏi dựa trên nội dung lecture được cung cấp.

Yêu cầu:
- Câu hỏi phải rõ ràng và không ambiguous
- Đáp án phải chính xác
- Phù hợp với mục tiêu learning objectives
- Test cả comprehension và application`;

      const prompt = `Tạo ${questionCount} câu hỏi quiz từ nội dung lecture sau:

COURSE: ${lecture.Chapter?.Course?.title}
CHAPTER: ${lecture.Chapter?.title}
LECTURE: ${lecture.title}

LECTURE CONTENT:
${lecture.content || lecture.aiNotes || 'Nội dung không available'}

Yêu cầu:
- Số lượng câu hỏi: ${questionCount}
- Loại câu hỏi: ${questionTypes.join(', ')}
- Độ khó: ${difficulty}

Format mỗi câu hỏi như sau:
{
  "type": "multiple_choice|true_false|short_answer",
  "question": "Nội dung câu hỏi",
  "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
  "correctAnswer": "A hoặc true/false hoặc text answer",
  "explanation": "Giải thích tại sao đáp án đúng",
  "difficulty": "easy|medium|hard",
  "topic": "Chủ đề liên quan"
}

Trả về danh sách các câu hỏi trong format JSON array.`;

      let aiResponse;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          aiResponse = await aiGateway.generateText({
            system: systemPrompt,
            prompt,
            maxOutputTokens: 8192,
            timeoutMs: 180000,  // 180s cho quiz nặng
          });
          break; // Success
        } catch (aiError) {
          const isRetryable = aiError.message?.includes('429') || 
                             aiError.message?.includes('503') ||
                             aiError.message?.includes('timeout') ||
                             aiError.statusCode === 429 || 
                             aiError.statusCode === 503;
                             
          if (isRetryable && retries < maxRetries - 1) {
            retries++;
            const delayMs = 30000 * Math.pow(2, retries - 1); // 30s, 60s
            logger.warn('QUIZ_GENERATE_RETRY', { retry: retries, delaySeconds: delayMs / 1000, error: aiError.message });
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            throw aiError;
          }
        }
      }

      let questions;
      try {
        // Try multiple extraction methods
        let jsonText = aiResponse.text;

        // Method 1: Extract from markdown code block ```json ... ```
        const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1];
        }

        // Method 2: Extract array pattern [...] - non-greedy first, then greedy
        const arrayMatch = jsonText.match(/\[[\s\S]*?\](?=\s*$|\s*\n)/) || jsonText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          jsonText = arrayMatch[0];
        }

        // Method 3: Try to find JSON array between brackets
        const startIdx = jsonText.indexOf('[');
        let endIdx = jsonText.lastIndexOf(']');
        
        // If JSON seems truncated (no closing bracket), try to fix it
        if (startIdx !== -1) {
          if (endIdx === -1 || endIdx < startIdx) {
            // JSON is truncated - try to find partial array and close it
            jsonText = jsonText.substring(startIdx) + '\n}]';
            logger.warn('JSON_TRUNCATED_ATTEMPTING_FIX', { lectureId });
          } else {
            jsonText = jsonText.substring(startIdx, endIdx + 1);
          }
        }

        questions = JSON.parse(jsonText);

        // Ensure it's an array
        if (!Array.isArray(questions)) {
          throw new Error('Parsed result is not an array');
        }
      } catch (parseError) {
        logger.error('QUIZ_QUESTIONS_PARSE_FAILED', {
          lectureId,
          response: aiResponse.text?.substring(0, 500),
          error: parseError.message,
        });
        throw {
          status: 500,
          message: 'Không thể parse quiz questions',
          code: 'QUIZ_QUESTIONS_PARSE_FAILED',
        };
      }

      // Validate and enhance questions
      const validatedQuestions = await this.validateQuizQuestions(questions, lectureId);

      return {
        questions: validatedQuestions,
        metadata: {
          questionCount: validatedQuestions.length,
          questionTypes,
          difficulty,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      logger.error('QUIZ_GENERATION_FAILED', {
        lectureId,
        options,
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw {
        status: error.status || 500,
        message: error.message || 'Không thể tạo quiz questions',
        code: error.code || 'QUIZ_GENERATION_FAILED',
      };
    }
  }

  /**
   * Generate quiz and auto-save as draft
   */
  async generateAndSaveQuiz(lectureId, quizData, options = {}, userId) {
    try {
      const {
        title,
        description,
        timeLimit = 30,
        passingScore = 60,
        maxScore = 100,
      } = quizData;

      // Generate questions first
      const generatedQuestions = await this.generateQuizQuestions(lectureId, options);

      // Get lecture info for courseId
      const lecture = await Lecture.findByPk(lectureId, {
        include: [
          {
            model: Chapter,
            attributes: ['courseId'],
          },
        ],
      });

      if (!lecture) {
        throw {
          status: 404,
          message: 'Không tìm thấy lecture',
          code: 'LECTURE_NOT_FOUND',
        };
      }

      const courseId = lecture.Chapter.courseId;

      // Create quiz as draft
      const quiz = await Quiz.create({
        title: title || `Quiz: ${lecture.title}`,
        description: description || `Quiz được tạo tự động từ lecture "${lecture.title}"`,
        courseId,
        lectureId,
        createdBy: userId,
        timeLimit,
        passingScore,
        maxScore,
        status: 'draft',
        showResults: true,
      });

      // Create questions
      const questionRecords = [];
      for (const q of generatedQuestions.questions) {
        const question = await Question.create({
          quizId: quiz.id,
          type: q.type,
          content: q.question,
          options: q.options || null,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || null,
          points: 1,
          order: q.order,
        });
        questionRecords.push(question);
      }

      // Analyze content quality
      let qualityScore = null;
      try {
        qualityScore = await this.analyzeQuizQuality(quiz.id);
      } catch (qualityError) {
        logger.warn('ANALYZE_QUIZ_QUALITY_ERROR', {
          quizId: quiz.id,
          error: qualityError.message,
        });
        // Continue without quality score
      }

      logger.info('QUIZ_GENERATED_AND_SAVED', {
        quizId: quiz.id,
        lectureId,
        courseId,
        userId,
        questionCount: questionRecords.length,
        status: 'draft',
      });

      return {
        quiz,
        questions: questionRecords,
        qualityScore,
        metadata: {
          generatedAt: new Date(),
          questionCount: questionRecords.length,
          status: 'draft',
        },
      };
    } catch (error) {
      logger.error('GENERATE_AND_SAVE_QUIZ_FAILED', {
        lectureId,
        quizData,
        options,
        userId,
        error: error.message,
        stack: error.stack,
      });
      throw {
        status: error.status || 500,
        message: error.message || 'Không thể tạo và lưu quiz',
        code: error.code || 'GENERATE_AND_SAVE_QUIZ_FAILED',
      };
    }
  }

  /**
   * Analyze quiz quality
   */
  async analyzeQuizQuality(quizId) {
    try {
      const quiz = await Quiz.findByPk(quizId, {
        include: [Question],
      });

      if (!quiz || !quiz.questions || quiz.questions.length === 0) {
        return null;
      }

      const questions = quiz.questions;
      const questionTypes = questions.reduce((acc, q) => {
        acc[q.type] = (acc[q.type] || 0) + 1;
        return acc;
      }, {});

      const hasCorrectAnswers = questions.every(q => q.correctAnswer);
      const hasExplanations = questions.filter(q => q.explanation).length;
      const explanationRate = questions.length > 0 ? hasExplanations / questions.length : 0;

      const qualityMetrics = {
        questionCount: questions.length,
        questionTypes,
        hasCorrectAnswers,
        explanationRate,
        overallScore: 7.0, // Base score
      };

      // Calculate overall score based on criteria
      if (hasCorrectAnswers) qualityMetrics.overallScore += 1.5;
      if (explanationRate > 0.5) qualityMetrics.overallScore += 1;
      if (Object.keys(questionTypes).length > 1) qualityMetrics.overallScore += 0.5;

      return qualityMetrics;
    } catch (error) {
      logger.error('ANALYZE_QUIZ_QUALITY_FAILED', {
        quizId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Publish a draft quiz
   */
  async publishQuiz(quizId, userId) {
    try {
      const quiz = await Quiz.findByPk(quizId);

      if (!quiz) {
        throw {
          status: 404,
          message: 'Không tìm thấy quiz',
          code: 'QUIZ_NOT_FOUND',
        };
      }

      if (quiz.createdBy !== userId) {
        throw {
          status: 403,
          message: 'Bạn không có quyền publish quiz này',
          code: 'UNAUTHORIZED',
        };
      }

      if (quiz.status !== 'draft') {
        throw {
          status: 400,
          message: 'Quiz đã được publish hoặc không ở trạng thái draft',
          code: 'INVALID_STATUS',
        };
      }

      // Check if quiz has questions
      const questionCount = await Question.count({ where: { quizId } });
      if (questionCount === 0) {
        throw {
          status: 400,
          message: 'Quiz không có câu hỏi nào',
          code: 'NO_QUESTIONS',
        };
      }

      await quiz.update({ status: 'published' });

      logger.info('QUIZ_PUBLISHED', {
        quizId,
        userId,
        questionCount,
      });

      return {
        quiz,
        publishedAt: new Date(),
        questionCount,
      };
    } catch (error) {
      logger.error('PUBLISH_QUIZ_FAILED', {
        quizId,
        userId,
        error: error.message,
      });
      throw {
        status: error.status || 500,
        message: error.message || 'Không thể publish quiz',
        code: error.code || 'PUBLISH_QUIZ_FAILED',
      };
    }
  }

  /**
   * Generate practice exercises
   */
  async generatePracticeExercises(lectureId, options = {}) {
    try {
      const {
        exerciseCount = 5,
        exerciseTypes = ['hands_on', 'case_study', 'discussion'],
        difficulty = 'medium',
      } = options;

      const lecture = await Lecture.findByPk(lectureId, {
        include: [
          {
            model: Chapter,
            include: [
              {
                model: Course,
                attributes: ['title', 'category'],
              },
            ],
          },
        ],
      });

      if (!lecture) {
        throw {
          status: 404,
          message: 'Lecture not found',
          code: 'LECTURE_NOT_FOUND',
        };
      }

      const systemPrompt = `Bạn là một chuyên gia giáo dục trong việc tạo bài tập thực hành chất lượng cao. Tạo bài tập giúp học viên áp dụng kiến thức từ lecture.

Yêu cầu:
- Bài tập phải practical và applicable
- Có clear instructions và expectations
- Phù hợp với level của học viên
- Thúc đẩy critical thinking`;

      const prompt = `Tạo ${exerciseCount} bài tập thực hành từ nội dung lecture sau:

COURSE: ${lecture.Chapter?.Course?.title}
CHAPTER: ${lecture.Chapter?.title}
LECTURE: ${lecture.title}

LECTURE CONTENT:
${lecture.content || lecture.aiNotes || 'Nội dung không available'}

Yêu cầu:
- Số lượng bài tập: ${exerciseCount}
- Loại bài tập: ${exerciseTypes.join(', ')}
- Độ khó: ${difficulty}

Format mỗi bài tập như sau:
{
  "type": "hands_on|case_study|discussion|project",
  "title": "Tiêu đề bài tập",
  "description": "Mô tả chi tiết bài tập",
  "instructions": "Hướng dẫn step-by-step",
  "estimatedTime": "Thời gian ước tính (phút)",
  "difficulty": "easy|medium|hard",
  "deliverables": "Sản phẩm cần nộp",
  "evaluationCriteria": ["Tiêu chí 1", "Tiêu chí 2"]
}

Trả về danh sách bài tập trong format JSON array.`;

      const aiResponse = await aiGateway.generateText({
        system: systemPrompt,
        prompt,
        maxOutputTokens: 4096,
      });

      let exercises;
      try {
        const jsonMatch = aiResponse.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          exercises = JSON.parse(jsonMatch[0]);
        } else {
          exercises = JSON.parse(aiResponse.text);
        }
      } catch (parseError) {
        logger.error('PRACTICE_EXERCISES_PARSE_FAILED', {
          lectureId,
          response: aiResponse.text,
          error: parseError.message,
        });
        throw {
          status: 500,
          message: 'Không thể parse practice exercises',
          code: 'PRACTICE_EXERCISES_PARSE_FAILED',
        };
      }

      const validatedExercises = await this.validatePracticeExercises(exercises, lectureId);

      return {
        exercises: validatedExercises,
        metadata: {
          exerciseCount: validatedExercises.length,
          exerciseTypes,
          difficulty,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      logger.error('PRACTICE_EXERCISES_GENERATION_FAILED', {
        lectureId,
        options,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể tạo practice exercises',
        code: 'PRACTICE_EXERCISES_GENERATION_FAILED',
      };
    }
  }

  /**
   * Analyze content quality
   */
  async analyzeContentQuality(contentId, content, contentType) {
    try {
      const systemPrompt = `Bạn là một chuyên gia đánh giá chất lượng nội dung giáo dục. Phân tích nội dung được cung cấp và cho điểm các tiêu chí sau:

1. Clarity (1-10): Nội dung có rõ ràng, dễ hiểu không?
2. Completeness (1-10): Nội dung có đầy đủ, comprehensive không?
3. Engagement (1-10): Nội dung có hấp dẫn, interesting không?
4. Technical Accuracy (1-10): Thông tin có chính xác không?
5. Pedagogical Value (1-10): Có giá trị giáo dục không?

Format response JSON:
{
  "clarityScore": 8.5,
  "completenessScore": 7.0,
  "engagementScore": 6.5,
  "technicalAccuracyScore": 9.0,
  "pedagogicalScore": 8.0,
  "overallScore": 7.8,
  "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"],
  "improvements": ["Cần cải thiện 1", "Cần cải thiện 2"],
  "issues": ["Vấn đề 1 nếu có"]
}`;

      const safeContent = String(content || '');
      const prompt = `Phân tích chất lượng nội dung ${contentType} sau:

${safeContent.substring(0, 3000)}${safeContent.length > 3000 ? '...' : ''}

Hãy đánh giá và cho điểm theo các tiêu chí đã nêu.`;

      const aiResponse = await aiGateway.generateText({
        system: systemPrompt,
        prompt,
        maxOutputTokens: 2048,
        timeoutMs: 60000, // 60s cho quality analysis
      });

      let analysis;
      try {
        const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          analysis = JSON.parse(aiResponse.text);
        }
      } catch (parseError) {
        // Fallback if JSON parsing fails
        analysis = {
          overallScore: 7.0,
          clarityScore: 7.0,
          completenessScore: 7.0,
          engagementScore: 7.0,
          technicalAccuracyScore: 7.0,
          pedagogicalScore: 7.0,
          strengths: ['Content generated'],
          improvements: ['Review needed'],
          issues: [],
        };
      }

      // Save to database
      try {
        await this.updateContentQualityScore(contentId, contentType, analysis);
      } catch (saveError) {
        logger.error('SAVE_QUALITY_SCORE_FAILED', {
          contentId,
          contentType,
          error: saveError.message,
        });
        // Continue to return analysis even if save fails
      }

      return analysis;
    } catch (error) {
      logger.error('CONTENT_QUALITY_ANALYSIS_FAILED', {
        contentType,
        contentId,
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      // Return default scores if analysis fails
      return {
        overallScore: 5.0,
        clarityScore: 5.0,
        completenessScore: 5.0,
        engagementScore: 5.0,
        technicalAccuracyScore: 5.0,
        pedagogicalScore: 5.0,
        strengths: [],
        improvements: ['Manual review required'],
        issues: ['Analysis failed: ' + error.message],
      };
    }
  }

  /**
   * Validate quiz questions
   */
  async validateQuizQuestions(questions, lectureId) {
    return questions.filter((question, index) => {
      // Basic validation
      if (!question.question || !question.correctAnswer) {
        logger.warn('INVALID_QUESTION_STRUCTURE', {
          lectureId,
          questionIndex: index,
          question,
        });
        return false;
      }

      if (question.type === 'multiple_choice' && 
          (!question.options || question.options.length < 2)) {
        logger.warn('INVALID_MULTIPLE_CHOICE', {
          lectureId,
          questionIndex: index,
          question,
        });
        return false;
      }

      return true;
    }).map((question, index) => ({
      ...question,
      order: index + 1,
      id: null, // Will be set when saved to database
    }));
  }

  /**
   * Validate practice exercises
   */
  async validatePracticeExercises(exercises, lectureId) {
    return exercises.filter((exercise, index) => {
      if (!exercise.title || !exercise.description || !exercise.instructions) {
        logger.warn('INVALID_EXERCISE_STRUCTURE', {
          lectureId,
          exerciseIndex: index,
          exercise,
        });
        return false;
      }

      return true;
    }).map((exercise, index) => ({
      ...exercise,
      order: index + 1,
      id: null, // Will be set when saved to database
    }));
  }

  /**
   * Update content quality score
   */
  async updateContentQualityScore(contentId, contentType, qualityAnalysis) {
    try {
      const [score, created] = await ContentQualityScore.findOrCreate({
        where: {
          contentId,
          contentType,
        },
        defaults: {
          contentId,
          contentType,
          overallScore: qualityAnalysis.overallScore,
          clarityScore: qualityAnalysis.clarityScore,
          completenessScore: qualityAnalysis.completenessScore,
          engagementScore: qualityAnalysis.engagementScore,
          technicalAccuracyScore: qualityAnalysis.technicalAccuracyScore,
          pedagogicalScore: qualityAnalysis.pedagogicalScore,
          issues: qualityAnalysis.issues || [],
          suggestions: qualityAnalysis.improvements || [],
          lastAnalyzedAt: new Date(),
        },
      });

      if (!created) {
        await score.update({
          overallScore: qualityAnalysis.overallScore,
          clarityScore: qualityAnalysis.clarityScore,
          completenessScore: qualityAnalysis.completenessScore,
          engagementScore: qualityAnalysis.engagementScore,
          technicalAccuracyScore: qualityAnalysis.technicalAccuracyScore,
          pedagogicalScore: qualityAnalysis.pedagogicalScore,
          issues: qualityAnalysis.issues || [],
          suggestions: qualityAnalysis.improvements || [],
          lastAnalyzedAt: new Date(),
        });
      }

      return { score };
    } catch (error) {
      logger.error('UPDATE_CONTENT_QUALITY_SCORE_FAILED', {
        contentId,
        contentType,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể cập nhật content quality score',
        code: 'UPDATE_CONTENT_QUALITY_SCORE_FAILED',
      };
    }
  }

  /**
   * Calculate quality summary
   */
  async calculateQualitySummary(qualityScores) {
    if (qualityScores.length === 0) {
      return {
        averageOverallScore: 0,
        averageClarityScore: 0,
        averageCompletenessScore: 0,
        averageEngagementScore: 0,
        averageTechnicalAccuracyScore: 0,
        averagePedagogicalScore: 0,
        totalContent: 0,
        lowQualityContent: 0,
        highQualityContent: 0,
      };
    }

    const totals = qualityScores.reduce((acc, score) => {
      acc.overall += score.overallScore;
      acc.clarity += score.clarityScore;
      acc.completeness += score.completenessScore;
      acc.engagement += score.engagementScore;
      acc.technicalAccuracy += score.technicalAccuracyScore;
      acc.pedagogical += score.pedagogicalScore;
      acc.total++;
      if (score.overallScore < 6) acc.lowQuality++;
      if (score.overallScore >= 8) acc.highQuality++;
      return acc;
    }, {
      overall: 0,
      clarity: 0,
      completeness: 0,
      engagement: 0,
      technicalAccuracy: 0,
      pedagogical: 0,
      total: 0,
      lowQuality: 0,
      highQuality: 0,
    });

    const count = totals.total;
    return {
      averageOverallScore: totals.overall / count,
      averageClarityScore: totals.clarity / count,
      averageCompletenessScore: totals.completeness / count,
      averageEngagementScore: totals.engagement / count,
      averageTechnicalAccuracyScore: totals.technicalAccuracy / count,
      averagePedagogicalScore: totals.pedagogical / count,
      totalContent: count,
      lowQualityContent: totals.lowQuality,
      highQualityContent: totals.highQuality,
    };
  }

  /**
   * Get content quality report
   */
  async getContentQualityReport(courseId, options = {}) {
    try {
      const {
        contentType,
        minScore,
        maxScore,
        page = 1,
        limit = 20,
      } = options;

      const where = {};
      if (contentType) where.contentType = contentType;
      if (minScore) where.overallScore = { [Op.gte]: minScore };
      if (maxScore) where.overallScore = { ...where.overallScore, [Op.lte]: maxScore };

      // Get content IDs for this course
      const lectureIds = await Lecture.findAll({
        include: [
          {
            model: Chapter,
            where: { courseId },
          },
        ],
        attributes: ['id'],
      }).then(lectures => lectures.map(l => l.id));

      where.contentId = {
        [Op.in]: lectureIds,
      };

      const { count, rows } = await ContentQualityScore.findAndCountAll({
        where,
        order: [['overallScore', 'ASC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      // Calculate summary statistics
      const summary = await this.calculateQualitySummary(rows);

      return {
        qualityScores: rows,
        summary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit)),
        },
      };
    } catch (error) {
      logger.error('GET_CONTENT_QUALITY_REPORT_FAILED', {
        courseId,
        options,
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw {
        status: 500,
        message: 'Không thể lấy content quality report',
        code: 'GET_CONTENT_QUALITY_REPORT_FAILED',
      };
    }
  }

  /**
   * Generate content improvement suggestions
   */
  async generateContentImprovementSuggestions(contentId, contentType) {
    try {
      const qualityScore = await ContentQualityScore.findOne({
        where: { contentId, contentType },
      });

      if (!qualityScore) {
        throw {
          status: 404,
          message: 'Content quality score not found',
          code: 'QUALITY_SCORE_NOT_FOUND',
        };
      }

      const content = await this.getContentById(contentId, contentType);
      
      const systemPrompt = `Bạn là một chuyên gia cải thiện nội dung giáo dục. Dựa trên phân tích chất lượng và nội dung hiện tại, hãy đưa ra suggestions cụ thể để cải thiện.

Focus on:
1. Clarity improvements
2. Adding missing content
3. Making it more engaging
4. Technical accuracy
5. Better pedagogical approaches`;

      const prompt = `Nội dung ${contentType} hiện tại:
${content}

Phân tích chất lượng hiện tại:
- Overall Score: ${qualityScore.overallScore}/10
- Clarity: ${qualityScore.clarityScore}/10
- Completeness: ${qualityScore.completenessScore}/10
- Engagement: ${qualityScore.engagementScore}/10
- Technical Accuracy: ${qualityScore.technicalAccuracyScore}/10
- Pedagogical Value: ${qualityScore.pedagogicalScore}/10

Các vấn đề đã xác định:
${qualityScore.issues?.join('\n') || 'Không có'}

Hãy đưa ra 3-5 suggestions cụ thể và actionable để cải thiện nội dung này. Format response JSON:
{
  "suggestions": [
    {
      "category": "clarity|completeness|engagement|accuracy|pedagogy",
      "priority": "high|medium|low",
      "description": "Mô tả chi tiết suggestion",
      "example": "Ví dụ cụ thể nếu applicable"
    }
  ]
}`;

      const aiResponse = await aiGateway.generateText({
        system: systemPrompt,
        prompt,
        maxOutputTokens: 2048,
      });

      let suggestions;
      try {
        const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        } else {
          suggestions = JSON.parse(aiResponse.text);
        }
      } catch (parseError) {
        logger.error('IMPROVEMENT_SUGGESTIONS_PARSE_FAILED', {
          contentId,
          contentType,
          response: aiResponse.text,
          error: parseError.message,
        });
        suggestions = {
          suggestions: [
            {
              category: 'general',
              priority: 'medium',
              description: 'Review and improve content manually',
              example: 'Consider adding more examples and clarifications',
            },
          ],
        };
      }

      return suggestions;
    } catch (error) {
      logger.error('CONTENT_IMPROVEMENT_SUGGESTIONS_FAILED', {
        contentId,
        contentType,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể tạo improvement suggestions',
        code: 'CONTENT_IMPROVEMENT_SUGGESTIONS_FAILED',
      };
    }
  }

  /**
   * Generate course outline with chapters and lectures
   */
  async generateCourseOutline(courseConfig, userId) {
    try {
      const {
        topic,
        targetAudience = 'general',
        difficulty = 'intermediate',
        estimatedWeeks = 8,
        chaptersPerWeek = 2,
        lecturesPerChapter = 3,
        language = 'vietnamese',
      } = courseConfig;

      const totalChapters = estimatedWeeks * chaptersPerWeek;
      const totalLectures = totalChapters * lecturesPerChapter;

      const systemPrompt = `Bạn là một chuyên gia giáo dục trong việc thiết kế khóa học chất lượng cao. Tạo outline chi tiết cho khóa học với cấu trúc rõ ràng.

Yêu cầu:
- Tổng số chapter: ${totalChapters}
- Mỗi chapter có ${lecturesPerChapter} lectures
- Phù hợp với cấp độ: ${difficulty}
- Đối tượng: ${targetAudience}
- Ngôn ngữ: ${language}
- Nội dung từ cơ bản đến nâng cao (progressive learning)
- Mỗi chapter có learning objectives rõ ràng`;

      const prompt = `Tạo outline cho khóa học "${topic}"

THÔNG TIN KHÓA HỌC:
- Chủ đề: ${topic}
- Cấp độ: ${difficulty}
- Đối tượng: ${targetAudience}
- Thời lượng: ${estimatedWeeks} tuần
- Số chapter: ${totalChapters}
- Số lectures mỗi chapter: ${lecturesPerChapter}

Yêu cầu output JSON:
{
  "title": "Tên khóa học đầy đủ",
  "description": "Mô tả tổng quan khóa học",
  "learningObjectives": ["Mục tiêu 1", "Mục tiêu 2", ...],
  "chapters": [
    {
      "order": 1,
      "title": "Tên chapter",
      "description": "Mô tả chapter",
      "learningObjectives": ["Mục tiêu chapter"],
      "lectures": [
        {
          "order": 1,
          "title": "Tên lecture",
          "description": "Mô tả ngắn",
          "estimatedDuration": 45
        }
      ]
    }
  ],
  "estimatedTotalDuration": "Thời lượng tổng (giờ)",
  "prerequisites": ["Kiến thức cần có"],
  "skillsGained": ["Kỹ năng đạt được"]
}

Lưu ý:
- Chapter 1-2: Giới thiệu và cơ bản
- Chapter giữa: Nội dung chính, thực hành
- Chapter cuối: Nâng cao và tổng kết
- Tên lecture phải cụ thể và hấp dẫn`;

      let aiResponse;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          aiResponse = await aiGateway.generateText({
            system: systemPrompt,
            prompt,
            maxOutputTokens: 8192,
            timeoutMs: 180000, // 180s cho outline phức tạp
          });
          break; // Success
        } catch (aiError) {
          if (aiError.message?.includes('429') || aiError.statusCode === 429) {
            retries++;
            if (retries >= maxRetries) throw aiError;
            
            const delayMs = 60000 * Math.pow(2, retries - 1); // 60s, 120s
            logger.warn('OUTLINE_RATE_LIMIT_RETRY', { retry: retries, delaySeconds: delayMs / 1000 });
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            throw aiError;
          }
        }
      }

      let outline;
      try {
        // Try multiple extraction methods
        let jsonText = aiResponse.text;

        // Method 1: Extract from markdown code block
        const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1];
        }

        // Method 2: Extract object pattern
        const objectMatch = jsonText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonText = objectMatch[0];
        }

        outline = JSON.parse(jsonText);

        // Validate structure
        if (!outline.title || !outline.chapters || !Array.isArray(outline.chapters)) {
          throw new Error('Invalid outline structure');
        }

      } catch (parseError) {
        logger.error('COURSE_OUTLINE_PARSE_FAILED', {
          topic,
          response: aiResponse.text?.substring(0, 500),
          error: parseError.message,
        });
        throw {
          status: 500,
          message: 'Không thể parse course outline',
          code: 'COURSE_OUTLINE_PARSE_FAILED',
        };
      }

      logger.info('COURSE_OUTLINE_GENERATED', {
        topic,
        userId,
        totalChapters: outline.chapters.length,
        totalLectures: outline.chapters.reduce((acc, ch) => acc + (ch.lectures?.length || 0), 0),
      });

      return {
        outline,
        config: courseConfig,
        metadata: {
          generatedAt: new Date(),
          aiGenerated: true,
        },
      };
    } catch (error) {
      logger.error('COURSE_OUTLINE_GENERATION_FAILED', {
        courseConfig,
        userId,
        error: error.message,
        stack: error.stack,
      });
      throw {
        status: error.status || 500,
        message: error.message || 'Không thể tạo course outline',
        code: error.code || 'COURSE_OUTLINE_GENERATION_FAILED',
      };
    }
  }

  /**
   * Save course outline to database as draft
   */
  async saveCourseOutline(outlineData, userId) {
    const transaction = await db.sequelize.transaction();

    try {
      const { outline, config } = outlineData;

      // Create course
      const course = await Course.create({
        title: outline.title,
        description: outline.description,
        slug: this.generateSlug(outline.title),
        level: config.difficulty === 'beginner' ? 'beginner' : config.difficulty === 'intermediate' ? 'intermediate' : 'advanced',
        category: config.topic,
        duration: outline.estimatedTotalDuration || `${config.estimatedWeeks} tuần`,
        totalLessons: outline.chapters?.reduce((acc, ch) => acc + (ch.lectures?.length || 0), 0) || 0,
        willLearn: outline.learningObjectives || [],
        requirements: outline.prerequisites || [],
        tags: [config.targetAudience, config.topic].filter(Boolean),
        published: false,
        aiGenerated: true,
        generationStatus: 'outline_ready',
        generationConfig: config,
        createdBy: userId,
      }, { transaction });

      // Create chapters and lectures
      const chapterRecords = [];
      for (const chapterData of outline.chapters || []) {
        const chapter = await Chapter.create({
          courseId: course.id,
          title: chapterData.title,
          description: chapterData.description,
          order: chapterData.order,
        }, { transaction });

        // Create lectures for this chapter
        const lectureRecords = [];
        for (const lectureData of chapterData.lectures || []) {
          const lecture = await Lecture.create({
            chapterId: chapter.id,
            title: lectureData.title,
            description: lectureData.description,
            type: 'video', // Required field
            duration: (lectureData.estimatedDuration || 45) * 60, // Convert to seconds
            order: lectureData.order,
            content: '', // Will be generated in Phase 2
          }, { transaction });

          lectureRecords.push(lecture);
        }

        chapterRecords.push({
          chapter,
          lectures: lectureRecords,
        });
      }

      await transaction.commit();

      logger.info('COURSE_OUTLINE_SAVED', {
        courseId: course.id,
        userId,
        title: course.title,
        chapterCount: chapterRecords.length,
        lectureCount: chapterRecords.reduce((acc, ch) => acc + ch.lectures.length, 0),
      });

      return {
        course,
        chapters: chapterRecords,
        message: 'Course outline đã được lưu vào database',
        status: 'outline_ready',
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('COURSE_OUTLINE_SAVE_FAILED', {
        outlineData,
        userId,
        error: error.message,
        stack: error.stack,
      });
      throw {
        status: 500,
        message: 'Không thể lưu course outline',
        code: 'COURSE_OUTLINE_SAVE_FAILED',
      };
    }
  }

  /**
   * Generate and save course outline (gộp Step 1 + 2)
   */
  async generateAndSaveCourseOutline(courseConfig, userId) {
    // Step 1: Generate outline
    const generationResult = await this.generateCourseOutline(courseConfig, userId);
    
    // Step 2: Save to database
    const saveResult = await this.saveCourseOutline({
      outline: generationResult.outline,
      config: courseConfig,
    }, userId);
    
    return {
      course: saveResult.course,
      chapters: saveResult.chapters,
      outline: generationResult.outline,
      metadata: {
        generatedAt: new Date(),
        totalChapters: saveResult.chapters.length,
        totalLectures: saveResult.chapters.reduce((acc, ch) => acc + ch.lectures.length, 0),
      },
    };
  }

  /**
   * Generate slug from title
   */
  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50) + '-' + Date.now();
  }

  /**
   * Get content by ID and type
   */
  async getContentById(contentId, contentType) {
    switch (contentType) {
      case 'lecture':
        const lecture = await Lecture.findByPk(contentId);
        return lecture?.content || lecture?.aiNotes || '';
      case 'quiz':
        const quiz = await Quiz.findByPk(contentId, {
          include: [Question],
        });
        return JSON.stringify(quiz, null, 2);
      default:
        throw {
          status: 400,
          message: 'Content type not supported',
          code: 'UNSUPPORTED_CONTENT_TYPE',
        };
    }
  }
}

module.exports = new AiContentService();
