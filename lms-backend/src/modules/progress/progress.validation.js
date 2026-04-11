const { param } = require('express-validator');

const updateLectureProgressValidation = [
  param('lectureId').isInt({ min: 1 }).withMessage('Lecture ID phải là số nguyên dương'),
  require('express-validator').body('watchedPercent')
    .isFloat({ min: 0, max: 100 }).withMessage('Watched percent phải từ 0 đến 100'),
];

const getStudentCourseProgressValidation = [
  param('courseId').isInt({ min: 1 }).withMessage('Course ID phải là số nguyên dương'),
];

const getTeacherStudentProgressValidation = [
  param('courseId').isInt({ min: 1 }).withMessage('Course ID phải là số nguyên dương'),
  param('studentId').isInt({ min: 1 }).withMessage('Student ID phải là số nguyên dương'),
];

const getCourseStudentsProgressValidation = [
  param('courseId').isInt({ min: 1 }).withMessage('Course ID phải là số nguyên dương'),
];

const getLastAccessedLectureValidation = [
  param('courseId').isInt({ min: 1 }).withMessage('Course ID phải là số nguyên dương'),
];

const getCertificateEligibilityValidation = [
  param('courseId').isInt({ min: 1 }).withMessage('Course ID phải là số nguyên dương'),
];

module.exports = {
  updateLectureProgressValidation,
  getStudentCourseProgressValidation,
  getTeacherStudentProgressValidation,
  getCourseStudentsProgressValidation,
  getLastAccessedLectureValidation,
  getCertificateEligibilityValidation,
};
