const { body, param } = require('express-validator');

/**
 * Quiz validation schemas
 */

const createQuizValidation = [
  body('title')
    .notEmpty()
    .withMessage('Tiêu đề quiz không được để trống'),
  body('maxScore')
    .optional()
    .isNumeric()
    .withMessage('Điểm tối đa phải là số'),
  body('timeLimit')
    .optional()
    .isNumeric()
    .withMessage('Thời gian làm bài phải là số'),
  body('passingScore')
    .optional()
    .isNumeric()
    .withMessage('Điểm đạt phải là số'),
];

const updateQuizValidation = [
  param('quizId')
    .isInt({ min: 1 })
    .withMessage('Quiz ID phải là số nguyên dương'),
  body('title')
    .optional()
    .notEmpty()
    .withMessage('Tiêu đề không được để trống'),
  body('maxScore')
    .optional()
    .isNumeric()
    .withMessage('Điểm tối đa phải là số'),
  body('timeLimit')
    .optional()
    .isNumeric()
    .withMessage('Thời gian làm bài phải là số'),
  body('passingScore')
    .optional()
    .isNumeric()
    .withMessage('Điểm đạt phải là số'),
];

const addQuestionValidation = [
  param('quizId')
    .isInt({ min: 1 })
    .withMessage('Quiz ID phải là số nguyên dương'),
  body('type')
    .isIn(['multiple_choice', 'true_false', 'short_answer', 'essay'])
    .withMessage('Loại câu hỏi không hợp lệ'),
  body('content')
    .notEmpty()
    .withMessage('Nội dung câu hỏi không được để trống'),
  body('points')
    .optional()
    .isFloat({ min: 0.5, max: 100 })
    .withMessage('Điểm mỗi câu phải từ 0.5-100'),
  body('options')
    .if(body('type').equals('multiple_choice'))
    .isArray({ min: 2 })
    .withMessage('Câu hỏi trắc nghiệm phải có ít nhất 2 lựa chọn'),
  body('correctAnswer')
    .if(body('type').equals('multiple_choice'))
    .notEmpty()
    .withMessage('Đáp án đúng không được để trống'),
];

const updateQuestionValidation = [
  param('questionId')
    .isInt({ min: 1 })
    .withMessage('Question ID phải là số nguyên dương'),
  body('type')
    .optional()
    .isIn(['multiple_choice', 'true_false', 'short_answer', 'essay'])
    .withMessage('Loại câu hỏi không hợp lệ'),
  body('content')
    .optional()
    .notEmpty()
    .withMessage('Nội dung câu hỏi không được để trống'),
  body('points')
    .optional()
    .isFloat({ min: 0.5, max: 100 })
    .withMessage('Điểm mỗi câu phải từ 0.5-100'),
  body('options')
    .if(body('type').equals('multiple_choice'))
    .isArray({ min: 2 })
    .withMessage('Câu hỏi trắc nghiệm phải có ít nhất 2 lựa chọn'),
  body('correctAnswer')
    .if(body('type').equals('multiple_choice'))
    .notEmpty()
    .withMessage('Đáp án đúng không được để trống'),
];

const deleteQuestionValidation = [
  param('questionId')
    .isInt({ min: 1 })
    .withMessage('Question ID phải là số nguyên dương'),
];

const getQuizValidation = [
  param('quizId')
    .isInt({ min: 1 })
    .withMessage('Quiz ID phải là số nguyên dương'),
];

const getCourseQuizzesValidation = [
  param('courseId')
    .isInt({ min: 1 })
    .withMessage('Course ID phải là số nguyên dương'),
];

module.exports = {
  createQuizValidation,
  updateQuizValidation,
  addQuestionValidation,
  updateQuestionValidation,
  deleteQuestionValidation,
  getQuizValidation,
  getCourseQuizzesValidation,
};
