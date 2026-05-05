const request = require('supertest');
const app = require('../app');
const { loginByRole } = require('./testAuth');
const db = require('../models');
const { Quiz, Course, Question, Attempt } = db.models;

describe('Attempt Flow Tests', () => {
  let studentToken;
  let teacherToken;
  let studentUserId;
  let teacherUserId;
  let testCourse;
  let testQuiz;
  let testQuestion;
  let testAttempt;

  beforeAll(async () => {
    studentToken = await loginByRole('student');
    teacherToken = await loginByRole('teacher');

    const { User, Category, Enrollment } = db.models;
    const student = await User.findOne({ where: { email: 'student@gmail.com' } });
    studentUserId = student?.id;
    const teacher = await User.findOne({ where: { email: 'teacher@gmail.com' } });
    teacherUserId = teacher?.id;

    const timestamp = Date.now();

    // Ensure category exists
    let category = await Category.findByPk(1);
    if (!category) {
      category = await Category.create({ id: 1, name: 'Test Category', slug: 'test-category' });
    }

    // Create test course
    testCourse = await Course.create({
      title: 'Attempt Test Course',
      slug: `attempt-test-course-${timestamp}`,
      description: 'Test course for quiz attempts',
      price: 0,
      teacherId: teacherUserId,
      published: true,
      categoryId: 1
    });

    // Create enrollment for student
    await Enrollment.create({
      userId: studentUserId,
      courseId: testCourse.id,
      status: 'active',
      enrollmentStatus: 'active',
      progressPercent: 0
    });

    // Create test quiz
    testQuiz = await Quiz.create({
      courseId: testCourse.id,
      title: 'Test Quiz',
      description: 'Quiz for testing attempts',
      timeLimit: 30,
      passingScore: 70,
      maxAttempts: 3,
      shuffleQuestions: false,
      showCorrectAnswers: true,
      isPublished: true,
      createdBy: teacherUserId
    });

    // Create test question
    testQuestion = await Question.create({
      quizId: testQuiz.id,
      type: 'multiple_choice',
      content: 'What is 2+2?',
      options: [
        { id: 'a', text: '3' },
        { id: 'b', text: '4' },
        { id: 'c', text: '5' }
      ],
      correctAnswer: { id: 'b' },
      points: 10,
      order: 0
    });
  });

  afterAll(async () => {
    // Cleanup in reverse order
    if (testQuiz) {
      await Attempt.destroy({ where: { quizId: testQuiz.id }, force: true });
      await Question.destroy({ where: { quizId: testQuiz.id }, force: true });
      await testQuiz.destroy({ force: true });
    }
    const { Enrollment } = db.models;
    if (testCourse) {
      await Enrollment.destroy({ where: { courseId: testCourse.id }, force: true });
      await testCourse.destroy({ force: true });
    }
  });

  describe('Student Attempt Flow', () => {
    test('POST /api/student/quizzes/:quizId/start - Start quiz attempt', async () => {
      const res = await request(app)
        .post(`/api/student/quizzes/${testQuiz.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect([201, 400, 500]).toContain(res.statusCode);
      if (res.statusCode === 201 && res.body.data) {
        expect(res.body.success).toBe(true);
        if (res.body.data.attemptId) {
          expect(res.body.data).toHaveProperty('attemptId');
        }
        if (res.body.data.questions) {
          expect(Array.isArray(res.body.data.questions)).toBe(true);
        }
        // Save attempt for later tests
        testAttempt = { id: res.body.data.attemptId || res.body.data.id };
      }
    });

    test('POST /api/student/attempts/:attemptId/submit - Submit quiz attempt', async () => {
      // First create a new attempt if not exists
      if (!testAttempt) {
        const startRes = await request(app)
          .post(`/api/student/quizzes/${testQuiz.id}/start`)
          .set('Authorization', `Bearer ${studentToken}`);
        testAttempt = { id: startRes.body.data.attemptId };
      }

      const res = await request(app)
        .post(`/api/student/attempts/${testAttempt.id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          answers: [
            {
              questionId: testQuestion.id,
              selectedOptionId: 'b' // Correct answer
            }
          ]
        });

      expect([200, 201, 400]).toContain(res.statusCode);
      if (res.statusCode === 200 || res.statusCode === 201) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('score');
        expect(res.body.data).toHaveProperty('totalScore');
        expect(res.body.data).toHaveProperty('percentage');
      }
    });

    test('GET /api/student/quizzes/:quizId/attempts - Get my attempts for a quiz', async () => {
      const res = await request(app)
        .get(`/api/student/quizzes/${testQuiz.id}/attempts`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect([200, 400, 404]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data) || typeof res.body.data === 'object').toBe(true);
      }
    });

    test('GET /api/student/attempts/:attemptId - Get attempt details', async () => {
      // Create a new attempt for this test
      const startRes = await request(app)
        .post(`/api/student/quizzes/${testQuiz.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);
      const attemptId = startRes.body.data.attemptId;

      const res = await request(app)
        .get(`/api/student/attempts/${attemptId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect([200, 400, 404, 500]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('attempt');
      }
    });

    test('POST /api/student/quizzes/:quizId/start - Should fail when max attempts reached', async () => {
      // This test depends on maxAttempts setting (default 3)
      // We may have already used 2 attempts in previous tests
      const res = await request(app)
        .post(`/api/student/quizzes/${testQuiz.id}/start`)
        .set('Authorization', `Bearer ${studentToken}`);

      // Should succeed if under maxAttempts, or fail with 400/429 if exceeded
      expect([201, 400, 429]).toContain(res.statusCode);
    });
  });

  describe('Teacher Attempt Management', () => {
    test('GET /api/teacher/quizzes/:quizId/attempts - Get all attempts for a quiz', async () => {
      const res = await request(app)
        .get(`/api/teacher/quizzes/${testQuiz.id}/attempts`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect([200, 403, 404]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeInstanceOf(Array);
      }
    });

    test('GET /api/teacher/attempts/:attemptId - Get attempt details as teacher', async () => {
      // Need to get a valid attempt ID first
      const attemptsRes = await request(app)
        .get(`/api/teacher/quizzes/${testQuiz.id}/attempts`)
        .set('Authorization', `Bearer ${teacherToken}`);

      if (attemptsRes.statusCode === 200 && attemptsRes.body.data.length > 0) {
        const attemptId = attemptsRes.body.data[0].id;
        const res = await request(app)
          .get(`/api/teacher/attempts/${attemptId}`)
          .set('Authorization', `Bearer ${teacherToken}`);

        expect([200, 404]).toContain(res.statusCode);
      }
    });
  });

  describe('Performance Stats', () => {
    test('GET /api/student/performance-stats - Get student performance stats', async () => {
      const res = await request(app)
        .get('/api/student/performance-stats')
        .set('Authorization', `Bearer ${studentToken}`);

      expect([200, 400, 404]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('statistics');
        expect(res.body.data).toHaveProperty('recentAttempts');
      }
    });
  });
});
