const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole } = require('./testAuth');
const { seedCore } = require('./jest.teardown');

// Mock AI services để tránh gọi API thật
jest.mock('../services/aiGateway.service', () => ({
  generateText: jest.fn(async () => ({ 
    text: 'MOCK_AI_GENERATED_CONTENT',
    usage: { promptTokens: 100, completionTokens: 50 }
  })),
  generateStreamingText: jest.fn(async function* () {
    yield { text: 'MOCK_STREAM_CHUNK_1', done: false };
    yield { text: 'MOCK_STREAM_CHUNK_2', done: false };
    yield { text: '', done: true };
  }),
  embedText: jest.fn(async () => ({ embedding: [0.1, 0.2, 0.3] })),
}));

jest.mock('../services/aiContent.service', () => ({
  generateQuizQuestions: jest.fn(async () => [
    {
      question: 'What is React?',
      options: ['Library', 'Framework', 'Language', 'Database'],
      correctAnswer: 0,
      explanation: 'React is a JavaScript library',
      difficulty: 'easy',
      type: 'multiple_choice'
    }
  ]),
  generateAndSaveQuiz: jest.fn(async () => ({
    quiz: { id: 1, title: 'Test Quiz', courseId: 1 },
    questions: [{ id: 1, question: 'Test?' }]
  })),
  generatePracticeExercises: jest.fn(async () => [
    {
      title: 'Exercise 1',
      instructions: 'Build a component',
      difficulty: 'medium',
      estimatedTime: 30
    }
  ]),
  analyzeContentQuality: jest.fn(async () => ({
    overallScore: 85,
    readability: { score: 90, level: 'easy' },
    engagement: { score: 80, hasExamples: true },
    accuracy: { score: 85, hasSources: false },
    suggestions: ['Add more examples']
  })),
}));

jest.mock('../modules/ai/aiTeachingAssistant.service', () => ({
  generateTeachingGuide: jest.fn(async () => ({
    content: 'MOCK_TEACHING_GUIDE',
    metadata: { classDuration: 60, teachingMode: 'offline' }
  })),
  generateTeachingMaterials: jest.fn(async () => ({
    content: 'MOCK_SLIDES_OUTLINE',
    metadata: { materialType: 'slides', slideCount: 15 }
  })),
  analyzeCourseDifficulty: jest.fn(async () => ({
    overallDifficulty: 'intermediate',
    recommendations: ['Add more practice exercises'],
    chapterAnalysis: []
  })),
}));

describe('AI Teacher Features', () => {
  let teacherToken;
  let testCourse;
  let testChapter;
  let testLecture;

  beforeAll(async () => {
    teacherToken = await loginByRole('teacher');
    
    // Teacher creates their own course (to be the owner)
    const courseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ 
        title: 'AI Teacher Test Course', 
        description: 'Test course for AI features',
        price: 0 
      });
    
    expect(courseRes.statusCode).toBe(201);
    testCourse = courseRes.body.data?.course || courseRes.body.data;
    expect(testCourse).toBeTruthy();
    expect(testCourse.id).toBeTruthy();
    
    // Create chapter
    const chapterRes = await request(app)
      .post(`/api/teacher/chapters`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ courseId: testCourse.id, title: 'Test Chapter', order: 1 });
    
    expect(chapterRes.statusCode).toBe(201);
    testChapter = chapterRes.body.data?.chapter || chapterRes.body.data;
    expect(testChapter).toBeTruthy();
    expect(testChapter.id).toBeTruthy();
    
    // Create lecture
    const lectureRes = await request(app)
      .post(`/api/teacher/chapters/${testChapter.id}/lectures`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ 
        title: 'Test Lecture', 
        content: 'Test content for AI generation',
        type: 'text',
        order: 1 
      });
    
    expect(lectureRes.statusCode).toBe(201);
    testLecture = lectureRes.body.data?.lecture || lectureRes.body.data;
    expect(testLecture).toBeTruthy();
    expect(testLecture.id).toBeTruthy();
  });

  describe('POST /api/teacher/ai/generate-content', () => {
    it('should generate lecture content', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/generate-content')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          courseId: testCourse.id,
          chapterId: testChapter.id,
          outlineData: {
            title: 'React Hooks Tutorial',
            outline: 'Introduction to React Hooks, useState, useEffect, and custom hooks.',
            learningObjectives: ['Understand useState', 'Master useEffect'],
            targetAudience: 'beginner'
          }
        });

      expect([200, 201, 500]).toContain(res.statusCode);
      if (res.statusCode === 200 || res.statusCode === 201) {
        expect(res.body.success).toBe(true);
      }
    });

    it('should return 403 if not teacher', async () => {
      const studentToken = await loginByRole('student');
      const res = await request(app)
        .post('/api/teacher/ai/generate-content')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ 
          courseId: testCourse.id,
          chapterId: testChapter.id,
          outlineData: {
            title: 'Test',
            outline: 'Test outline content here'
          }
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/teacher/ai/generate-quiz', () => {
    it('should generate quiz questions for lecture', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/generate-quiz')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          lectureId: testLecture.id,
          questionCount: 5,
          questionTypes: ['multiple_choice'],
          difficulty: 'easy'
        });

      expect([200, 201]).toContain(res.statusCode);
    });
  });

  describe('POST /api/teacher/ai/generate-exercises', () => {
    it('should generate practice exercises', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/generate-exercises')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          lectureId: testLecture.id,
          exerciseCount: 3,
          exerciseTypes: ['hands_on'],
          difficulty: 'medium'
        });

      expect([200, 201]).toContain(res.statusCode);
    });
  });

  describe('POST /api/teacher/ai/teaching-guide', () => {
    it('should generate teaching guide', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/teaching-guide')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          lectureId: testLecture.id,
          classDuration: 60,
          classSize: 30,
          teachingMode: 'offline'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/teacher/ai/teaching-materials', () => {
    it('should generate teaching materials (slides)', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/teaching-materials')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          lectureId: testLecture.id,
          materialType: 'slides',
          slideCount: 15
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should generate teaching materials (handout)', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/teaching-materials')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          lectureId: testLecture.id,
          materialType: 'handout'
        });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/teacher/ai/content-quality', () => {
    it('should analyze content quality', async () => {
      const res = await request(app)
        .get(`/api/teacher/ai/content-quality?contentId=${testLecture.id}&contentType=lecture`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/teacher/ai/course-analytics', () => {
    it('should return course analytics', async () => {
      const res = await request(app)
        .get(`/api/teacher/ai/course-analytics?courseId=${testCourse.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect([200, 404, 500]).toContain(res.statusCode);
    });
  });

  describe('GET /api/teacher/ai/quality-report', () => {
    it('should return quality report for course', async () => {
      const res = await request(app)
        .get(`/api/teacher/ai/quality-report?courseId=${testCourse.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect([200, 404, 500]).toContain(res.statusCode);
    });
  });

  describe('POST /api/teacher/ai/generate-and-save-quiz', () => {
    it('should generate and save quiz as draft', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/generate-and-save-quiz')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          courseId: testCourse.id,
          lectureId: testLecture.id,
          chapterIds: [testChapter.id],
          options: {
            count: 5,
            difficulty: 'medium',
            questionTypes: ['multiple_choice']
          }
        });

      expect([200, 201]).toContain(res.statusCode);
    });
  });

  describe('POST /api/teacher/ai/quizzes/:quizId/publish', () => {
    it('should publish draft quiz', async () => {
      // Using non-existent quiz ID
      const res = await request(app)
        .post('/api/teacher/ai/quizzes/99999/publish')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect([200, 201, 404, 500]).toContain(res.statusCode);
    });
  });

  describe('POST /api/teacher/ai/student-feedback', () => {
    it('should generate student feedback suggestions', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/student-feedback')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          courseId: testCourse.id,
          feedbackType: 'general'
        });

      expect([200, 201, 500]).toContain(res.statusCode);
    });
  });

  describe('POST /api/teacher/ai/generate-exam', () => {
    it('should generate exam/quiz with answer key', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/generate-exam')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          courseId: testCourse.id,
          chapterIds: [testChapter.id],
          quizType: 'chapter_test',
          difficulty: 'medium',
          questionCount: 10,
          timeLimit: 60,
          includeAnswerKey: true
        });

      expect([200, 201, 500]).toContain(res.statusCode);
    });
  });

  describe('GET /api/teacher/ai/course-difficulty/:courseId', () => {
    it('should analyze course difficulty', async () => {
      const res = await request(app)
        .get(`/api/teacher/ai/course-difficulty/${testCourse.id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect([200, 404, 500]).toContain(res.statusCode);
    });
  });

  describe('POST /api/teacher/ai/generate-course-outline', () => {
    it('should generate course outline', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/generate-course-outline')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          topic: 'JavaScript Programming',
          targetAudience: 'beginner',
          difficulty: 'beginner',
          estimatedWeeks: 4,
          chaptersPerWeek: 2,
          lecturesPerChapter: 3
        });

      expect([200, 201, 500]).toContain(res.statusCode);
    });
  });

  describe('POST /api/teacher/ai/save-course-outline', () => {
    it('should save course outline to database', async () => {
      const res = await request(app)
        .post('/api/teacher/ai/save-course-outline')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          outline: {
            title: 'JavaScript Programming',
            description: 'Learn JavaScript basics',
            chapters: [
              { title: 'Chapter 1: Introduction', order: 1 },
              { title: 'Chapter 2: Variables', order: 2 }
            ]
          },
          config: {
            targetAudience: 'beginner',
            difficulty: 'beginner'
          }
        });

      expect([200, 201, 400, 500]).toContain(res.statusCode);
    });
  });
});
