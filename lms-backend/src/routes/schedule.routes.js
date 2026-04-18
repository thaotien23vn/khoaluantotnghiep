const express = require('express');
const { body, param } = require('express-validator');
const scheduleController = require('../modules/schedule/schedule.controller');
const authMiddleware = require('../middlewares/auth');
const authorizeRole = require('../middlewares/authorize');

const router = express.Router();

// Validation helpers
const noteValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('startAt').notEmpty().withMessage('startAt is required'),
  body('endAt').notEmpty().withMessage('endAt is required'),
];

const noteIdValidation = [
  param('noteId').isInt().withMessage('noteId must be an integer'),
];

// Student routes
router.get('/student/learning-schedule', authMiddleware, authorizeRole('student'), scheduleController.getMySchedule);

router.post('/student/schedule/notes', 
  authMiddleware, 
  authorizeRole('student'), 
  noteValidation,
  scheduleController.createStudentNote
);

router.put('/student/schedule/notes/:noteId', 
  authMiddleware, 
  authorizeRole('student'), 
  noteIdValidation,
  scheduleController.updateStudentNote
);

router.delete('/student/schedule/notes/:noteId', 
  authMiddleware, 
  authorizeRole('student'), 
  noteIdValidation,
  scheduleController.deleteStudentNote
);

router.get('/student/schedule/next-event', authMiddleware, authorizeRole('student'), scheduleController.getNextScheduleEvent);
router.get('/student/learning-schedule/next', authMiddleware, authorizeRole('student'), scheduleController.getNextScheduleEvent);

// Teacher routes
router.get('/teacher/schedule', authMiddleware, authorizeRole('teacher', 'admin'), scheduleController.getTeacherSchedule);

router.post('/teacher/schedule/notes', 
  authMiddleware, 
  authorizeRole('teacher', 'admin'), 
  noteValidation,
  scheduleController.createStudentNote  // Reuse same method for teacher notes
);

router.put('/teacher/schedule/notes/:noteId', 
  authMiddleware, 
  authorizeRole('teacher', 'admin'), 
  noteIdValidation,
  scheduleController.updateStudentNote
);

router.delete('/teacher/schedule/notes/:noteId', 
  authMiddleware, 
  authorizeRole('teacher', 'admin'), 
  noteIdValidation,
  scheduleController.deleteStudentNote
);

// Course schedule events (teacher only)
router.get('/teacher/courses/:courseId/schedule-events', 
  authMiddleware, 
  authorizeRole('teacher', 'admin'), 
  scheduleController.listCourseScheduleEvents
);

router.post('/teacher/courses/:courseId/schedule-events', 
  authMiddleware, 
  authorizeRole('teacher', 'admin'),
  [
    param('courseId').isInt().withMessage('courseId must be an integer'),
    body('title').notEmpty().withMessage('Title is required'),
    body('type').notEmpty().withMessage('Type is required'),
    body('startAt').notEmpty().withMessage('startAt is required'),
    body('endAt').notEmpty().withMessage('endAt is required'),
  ],
  scheduleController.createCourseScheduleEvent
);

router.put('/teacher/schedule-events/:eventId', 
  authMiddleware, 
  authorizeRole('teacher', 'admin'),
  [
    param('eventId').isInt().withMessage('eventId must be an integer'),
  ],
  scheduleController.updateScheduleEvent
);

router.delete('/teacher/schedule-events/:eventId', 
  authMiddleware, 
  authorizeRole('teacher', 'admin'),
  [
    param('eventId').isInt().withMessage('eventId must be an integer'),
  ],
  scheduleController.deleteScheduleEvent
);

module.exports = router;
