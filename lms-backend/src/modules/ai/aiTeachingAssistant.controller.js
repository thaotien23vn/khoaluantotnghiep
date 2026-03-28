const aiTeachingAssistantService = require('./aiTeachingAssistant.service');
const logger = require('../../utils/logger');

class AiTeachingAssistantController {
  /**
   * POST /teacher/ai/teaching-guide
   * Generate teaching guide/lesson plan for a lecture
   */
  async generateTeachingGuide(req, res) {
    try {
      const { lectureId } = req.body;
      const teacherId = req.user.id;
      
      const options = {
        classDuration: req.body.classDuration || 60,
        classSize: req.body.classSize || 30,
        teachingMode: req.body.teachingMode || 'offline',
        studentLevel: req.body.studentLevel || 'intermediate',
      };

      const result = await aiTeachingAssistantService.generateTeachingGuide(
        lectureId,
        teacherId,
        options
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('GENERATE_TEACHING_GUIDE_ERROR', {
        userId: req.user?.id,
        body: req.body,
        error: error.message,
      });

      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Không thể tạo giáo án',
        code: error.code || 'GENERATE_TEACHING_GUIDE_ERROR',
      });
    }
  }

  /**
   * POST /teacher/ai/student-feedback
   * Generate personalized student feedback suggestions
   */
  async generateStudentFeedback(req, res) {
    try {
      const { courseId } = req.body;
      const teacherId = req.user.id;
      
      const options = {
        studentId: req.body.studentId,
        feedbackType: req.body.feedbackType || 'general',
        assignmentId: req.body.assignmentId,
      };

      const result = await aiTeachingAssistantService.generateStudentFeedbackSuggestions(
        courseId,
        teacherId,
        options
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('GENERATE_STUDENT_FEEDBACK_ERROR', {
        userId: req.user?.id,
        body: req.body,
        error: error.message,
      });

      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Không thể tạo gợi ý feedback',
        code: error.code || 'GENERATE_STUDENT_FEEDBACK_ERROR',
      });
    }
  }

  /**
   * POST /teacher/ai/generate-exam
   * Generate quiz/exam for teacher with answer key
   */
  async generateTeacherQuiz(req, res) {
    try {
      const { courseId } = req.body;
      const teacherId = req.user.id;
      
      const options = {
        quizType: req.body.quizType || 'chapter_test',
        difficulty: req.body.difficulty || 'mixed',
        questionCount: req.body.questionCount || 20,
        includeAnswerKey: req.body.includeAnswerKey !== false,
        timeLimit: req.body.timeLimit || 45,
        chapterIds: req.body.chapterIds || [],
      };

      const result = await aiTeachingAssistantService.generateTeacherQuiz(
        courseId,
        teacherId,
        options
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('GENERATE_TEACHER_QUIZ_ERROR', {
        userId: req.user?.id,
        body: req.body,
        error: error.message,
      });

      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Không thể tạo đề kiểm tra',
        code: error.code || 'GENERATE_TEACHER_QUIZ_ERROR',
      });
    }
  }

  /**
   * POST /teacher/ai/teaching-materials
   * Generate teaching materials (slides, handouts, worksheets)
   */
  async generateTeachingMaterials(req, res) {
    try {
      const { lectureId } = req.body;
      const teacherId = req.user.id;
      
      const options = {
        materialType: req.body.materialType || 'slides',
        slideCount: req.body.slideCount || 15,
        includeActivities: req.body.includeActivities !== false,
      };

      const result = await aiTeachingAssistantService.generateTeachingMaterials(
        lectureId,
        teacherId,
        options
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('GENERATE_TEACHING_MATERIALS_ERROR', {
        userId: req.user?.id,
        body: req.body,
        error: error.message,
      });

      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Không thể tạo tài liệu',
        code: error.code || 'GENERATE_TEACHING_MATERIALS_ERROR',
      });
    }
  }

  /**
   * GET /teacher/ai/course-difficulty/:courseId
   * Analyze course difficulty and suggest adjustments
   */
  async analyzeCourseDifficulty(req, res) {
    try {
      const { courseId } = req.params;
      const teacherId = req.user.id;

      const result = await aiTeachingAssistantService.analyzeCourseDifficulty(
        parseInt(courseId),
        teacherId
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('ANALYZE_COURSE_DIFFICULTY_ERROR', {
        userId: req.user?.id,
        params: req.params,
        error: error.message,
      });

      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Không thể phân tích độ khó',
        code: error.code || 'ANALYZE_COURSE_DIFFICULTY_ERROR',
      });
    }
  }
}

module.exports = new AiTeachingAssistantController();
