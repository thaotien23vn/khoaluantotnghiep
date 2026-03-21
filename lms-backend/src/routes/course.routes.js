const express = require('express');
const courseController = require('../modules/course/course.controller');

const router = express.Router();

// Public endpoints for browsing published courses

// GET /api/courses
router.get('/', courseController.getPublishedCourses);

// GET /api/courses/:id
router.get('/:id', courseController.getCourseDetail);

module.exports = router;

