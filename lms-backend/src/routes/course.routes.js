const express = require('express');
const courseController = require('../modules/course/course.controller');
const { listCoursesValidation, getCourseValidation } = require('../modules/course/course.validation');

const router = express.Router();

// Public endpoints for browsing published courses

// GET /api/courses
router.get('/', listCoursesValidation, courseController.getPublishedCourses);

// GET /api/courses/:id
router.get('/:id', getCourseValidation, courseController.getCourseDetail);

module.exports = router;

