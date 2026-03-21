const { param, body } = require('express-validator');

/**
 * Lesson (Lecture) validation schemas
 */

const createLessonValidation = [
  param('chapterId')
    .isInt({ min: 1 })
    .withMessage('Chapter ID phải là số nguyên dương'),
  
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Tiêu đề bài giảng không được để trống')
    .isLength({ min: 2, max: 200 })
    .withMessage('Tiêu đề bài giảng phải có độ dài từ 2 đến 200 ký tự'),
  
  body('type')
    .trim()
    .notEmpty()
    .withMessage('Loại bài giảng không được để trống')
    .isIn(['video', 'text', 'pdf', 'quiz', 'audio'])
    .withMessage('Loại bài giảng không hợp lệ'),
  
  body('content')
    .optional()
    .trim(),
  
  body('contentUrl')
    .optional()
    .trim()
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true;
      // Validate video URL format
      if (value.includes('youtube.com') || value.includes('youtu.be') || 
          value.includes('vimeo.com') || value.startsWith('http')) {
        return true;
      }
      throw new Error('URL nội dung không hợp lệ. Chỉ chấp nhận YouTube, Vimeo hoặc URL hợp lệ.');
    }),
  
  body('duration')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Thời lượng phải là số nguyên không âm (giây)'),
  
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Thứ tự phải là số nguyên không âm'),
  
  body('isPreview')
    .optional()
    .isBoolean()
    .withMessage('isPreview phải là boolean'),
];

const updateLessonValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Lesson ID phải là số nguyên dương'),
  
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Tiêu đề bài giảng không được để trống')
    .isLength({ min: 2, max: 200 })
    .withMessage('Tiêu đề bài giảng phải có độ dài từ 2 đến 200 ký tự'),
  
  body('type')
    .optional()
    .trim()
    .isIn(['video', 'text', 'pdf', 'quiz', 'audio'])
    .withMessage('Loại bài giảng không hợp lệ'),
  
  body('content')
    .optional()
    .trim(),
  
  body('contentUrl')
    .optional()
    .trim()
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true;
      // Validate video URL format
      if (value.includes('youtube.com') || value.includes('youtu.be') || 
          value.includes('vimeo.com') || value.startsWith('http')) {
        return true;
      }
      throw new Error('URL nội dung không hợp lệ. Chỉ chấp nhận YouTube, Vimeo hoặc URL hợp lệ.');
    }),
  
  body('duration')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Thời lượng phải là số nguyên không âm (giây)'),
  
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Thứ tự phải là số nguyên không âm'),
  
  body('isPreview')
    .optional()
    .isBoolean()
    .withMessage('isPreview phải là boolean'),
];

const deleteLessonValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Lesson ID phải là số nguyên dương'),
];

module.exports = {
  createLessonValidation,
  updateLessonValidation,
  deleteLessonValidation,
};
