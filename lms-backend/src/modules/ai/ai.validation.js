const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Student AI Conversation Validation
 */
const createStudentConversationValidation = [
  body('courseId')
    .notEmpty()
    .withMessage('courseId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  body('lectureId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('lectureId phải là số nguyên dương'),
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Tiêu đề tối đa 200 ký tự'),
  handleValidationErrors,
];

/**
 * Student AI Message Validation
 */
const sendStudentMessageValidation = [
  param('id')
    .notEmpty()
    .withMessage('conversationId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('conversationId phải là số nguyên dương'),
  body('message')
    .notEmpty()
    .withMessage('message là bắt buộc')
    .isString()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message phải từ 1-2000 ký tự'),
  handleValidationErrors,
];

/**
 * Teacher Lecture AI Notes Validation
 */
const updateTeacherLectureAiNotesValidation = [
  param('id')
    .notEmpty()
    .withMessage('lectureId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('lectureId phải là số nguyên dương'),
  body('aiNotes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('aiNotes tối đa 5000 ký tự'),
  handleValidationErrors,
];

/**
 * Teacher Ingest Lecture Validation
 */
const ingestTeacherLectureValidation = [
  param('lectureId')
    .notEmpty()
    .withMessage('lectureId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('lectureId phải là số nguyên dương'),
  handleValidationErrors,
];

/**
 * Admin AI Settings Validation
 */
const upsertAdminAiSettingsValidation = [
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('enabled phải là boolean'),
  body('provider')
    .optional()
    .isString()
    .trim()
    .isIn(['gemini', 'openai'])
    .withMessage('provider phải là gemini hoặc openai'),
  body('model')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Model tối đa 100 ký tự'),
  handleValidationErrors,
];

/**
 * Admin AI Policy Validation
 */
const createAdminAiPolicyValidation = [
  body('role')
    .notEmpty()
    .withMessage('role là bắt buộc')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('role phải từ 1-50 ký tự'),
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('enabled phải là boolean'),
  body('dailyLimit')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('dailyLimit phải từ 1-10000'),
  body('maxOutputTokens')
    .optional()
    .isInt({ min: 1, max: 8192 })
    .withMessage('maxOutputTokens phải từ 1-8192'),
  body('ragTopK')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('ragTopK phải từ 1-20'),
  handleValidationErrors,
];

/**
 * Admin Prompt Template Validation
 */
const createAdminPromptTemplateValidation = [
  body('key')
    .notEmpty()
    .withMessage('key là bắt buộc')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('key phải từ 1-100 ký tự'),
  body('template')
    .notEmpty()
    .withMessage('template là bắt buộc')
    .isString()
    .trim()
    .isLength({ min: 10, max: 10000 })
    .withMessage('template phải từ 10-10000 ký tự'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive phải là boolean'),
  handleValidationErrors,
];

/**
 * Student Learning Path Validation
 */
const getStudentLearningPathValidation = [
  query('courseId')
    .notEmpty()
    .withMessage('courseId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  handleValidationErrors,
];

/**
 * Student Recommendations Validation
 */
const getStudentRecommendationsValidation = [
  query('courseId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  query('type')
    .optional()
    .isIn(['content', 'study_path', 'time', 'weak_area', 'quiz', 'practice'])
    .withMessage('type không hợp lệ'),
  query('status')
    .optional()
    .isIn(['pending', 'accepted', 'rejected', 'completed'])
    .withMessage('status không hợp lệ'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page phải là số nguyên dương'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit phải từ 1-100'),
  handleValidationErrors,
];

/**
 * Update Recommendation Status Validation
 */
const updateRecommendationStatusValidation = [
  param('id')
    .notEmpty()
    .withMessage('recommendationId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('recommendationId phải là số nguyên dương'),
  body('status')
    .notEmpty()
    .withMessage('status là bắt buộc')
    .isIn(['pending', 'accepted', 'rejected', 'completed'])
    .withMessage('status phải là pending, accepted, rejected, hoặc completed'),
  handleValidationErrors,
];

/**
 * Student Knowledge Gaps Validation
 */
const getStudentKnowledgeGapsValidation = [
  query('courseId')
    .notEmpty()
    .withMessage('courseId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  handleValidationErrors,
];

/**
 * Student Learning Analytics Validation
 */
const getStudentLearningAnalyticsValidation = [
  query('courseId')
    .notEmpty()
    .withMessage('courseId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate phải là định dạng ISO8601'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate phải là định dạng ISO8601'),
  handleValidationErrors,
];

/**
 * Track Learning Event Validation
 */
const trackLearningEventValidation = [
  body('courseId')
    .notEmpty()
    .withMessage('courseId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  body('eventData')
    .notEmpty()
    .withMessage('eventData là bắt buộc')
    .isObject()
    .withMessage('eventData phải là object'),
  body('eventData.eventType')
    .notEmpty()
    .withMessage('eventData.eventType là bắt buộc')
    .isIn(['lecture_start', 'lecture_complete', 'quiz_start', 'quiz_complete', 'practice_start', 'practice_complete', 'content_interaction'])
    .withMessage('eventType không hợp lệ'),
  body('eventData.lectureId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('lectureId phải là số nguyên dương'),
  handleValidationErrors,
];

/**
 * Student Study Schedule Validation
 */
const getStudentStudyScheduleValidation = [
  query('courseId')
    .notEmpty()
    .withMessage('courseId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  query('hoursPerDay')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('hoursPerDay phải từ 1-12'),
  query('preferredDays')
    .optional()
    .isString()
    .withMessage('preferredDays phải là string (comma-separated)'),
  query('deadline')
    .optional()
    .isISO8601()
    .withMessage('deadline phải là định dạng ISO8601'),
  handleValidationErrors,
];

/**
 * Teacher Generate Content Validation
 */
const generateTeacherContentValidation = [
  body('courseId')
    .notEmpty()
    .withMessage('courseId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  body('chapterId')
    .notEmpty()
    .withMessage('chapterId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('chapterId phải là số nguyên dương'),
  body('outlineData')
    .notEmpty()
    .withMessage('outlineData là bắt buộc')
    .isObject()
    .withMessage('outlineData phải là object'),
  body('outlineData.title')
    .notEmpty()
    .withMessage('title là bắt buộc')
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('title phải từ 1-200 ký tự'),
  body('outlineData.outline')
    .notEmpty()
    .withMessage('outline là bắt buộc')
    .isString()
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('outline phải từ 10-5000 ký tự'),
  body('outlineData.learningObjectives')
    .optional()
    .isArray()
    .withMessage('learningObjectives phải là array'),
  body('outlineData.targetAudience')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('targetAudience tối đa 100 ký tự'),
  handleValidationErrors,
];

/**
 * Teacher Generate Quiz Validation
 */
const generateTeacherQuizValidation = [
  body('lectureId')
    .notEmpty()
    .withMessage('lectureId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('lectureId phải là số nguyên dương'),
  body('options')
    .optional()
    .isObject()
    .withMessage('options phải là object'),
  body('options.count')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('count phải từ 1-50'),
  body('options.difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('difficulty phải là easy, medium, hoặc hard'),
  body('options.questionTypes')
    .optional()
    .isArray()
    .withMessage('questionTypes phải là array'),
  handleValidationErrors,
];

/**
 * Teacher Generate Exercises Validation
 */
const generateTeacherExercisesValidation = [
  body('lectureId')
    .notEmpty()
    .withMessage('lectureId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('lectureId phải là số nguyên dương'),
  body('options')
    .optional()
    .isObject()
    .withMessage('options phải là object'),
  body('options.count')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('count phải từ 1-20'),
  body('options.difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('difficulty phải là easy, medium, hoặc hard'),
  handleValidationErrors,
];

/**
 * Teacher Content Quality Analysis Validation
 */
const analyzeTeacherContentQualityValidation = [
  query('contentId')
    .notEmpty()
    .withMessage('contentId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('contentId phải là số nguyên dương'),
  query('contentType')
    .notEmpty()
    .withMessage('contentType là bắt buộc')
    .isIn(['lecture', 'quiz'])
    .withMessage('contentType phải là lecture hoặc quiz'),
  handleValidationErrors,
];

/**
 * Teacher Course Analytics Validation
 */
const getTeacherCourseAnalyticsValidation = [
  query('courseId')
    .notEmpty()
    .withMessage('courseId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate phải là định dạng ISO8601'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate phải là định dạng ISO8601'),
  query('groupBy')
    .optional()
    .isIn(['day', 'week', 'month'])
    .withMessage('groupBy phải là day, week, hoặc month'),
  handleValidationErrors,
];

/**
 * Teacher Quality Report Validation
 */
const getTeacherQualityReportValidation = [
  query('courseId')
    .notEmpty()
    .withMessage('courseId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  query('contentType')
    .optional()
    .isIn(['lecture', 'quiz', 'all'])
    .withMessage('contentType phải là lecture, quiz, hoặc all'),
  query('minScore')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('minScore phải từ 0-10'),
  query('maxScore')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('maxScore phải từ 0-10'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page phải là số nguyên dương'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit phải từ 1-100'),
  handleValidationErrors,
];

/**
 * Admin Platform Analytics Validation
 */
const getAdminPlatformAnalyticsValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate phải là định dạng ISO8601'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate phải là định dạng ISO8601'),
  query('groupBy')
    .optional()
    .isIn(['day', 'week', 'month'])
    .withMessage('groupBy phải là day, week, hoặc month'),
  handleValidationErrors,
];

/**
 * Admin Content Quality Report Validation
 */
const getAdminContentQualityReportValidation = [
  query('courseId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  query('minScore')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('minScore phải từ 0-10'),
  query('maxScore')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('maxScore phải từ 0-10'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page phải là số nguyên dương'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit phải từ 1-100'),
  handleValidationErrors,
];

/**
 * Admin Trigger Recommendations Validation
 */
const triggerAdminRecommendationsValidation = [
  body('courseId')
    .notEmpty()
    .withMessage('courseId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('courseId phải là số nguyên dương'),
  handleValidationErrors,
];

/**
 * Publish Quiz Validation
 */
const publishQuizValidation = [
  param('quizId')
    .notEmpty()
    .withMessage('quizId là bắt buộc')
    .isInt({ min: 1 })
    .withMessage('quizId phải là số nguyên dương'),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  createStudentConversationValidation,
  sendStudentMessageValidation,
  updateTeacherLectureAiNotesValidation,
  ingestTeacherLectureValidation,
  upsertAdminAiSettingsValidation,
  createAdminAiPolicyValidation,
  createAdminPromptTemplateValidation,
  // Student enhancements
  getStudentLearningPathValidation,
  getStudentRecommendationsValidation,
  updateRecommendationStatusValidation,
  getStudentKnowledgeGapsValidation,
  getStudentLearningAnalyticsValidation,
  trackLearningEventValidation,
  getStudentStudyScheduleValidation,
  // Teacher enhancements
  generateTeacherContentValidation,
  generateTeacherQuizValidation,
  generateTeacherExercisesValidation,
  analyzeTeacherContentQualityValidation,
  getTeacherCourseAnalyticsValidation,
  getTeacherQualityReportValidation,
  publishQuizValidation,
  // Admin enhancements
  getAdminPlatformAnalyticsValidation,
  getAdminContentQualityReportValidation,
  triggerAdminRecommendationsValidation,
};
