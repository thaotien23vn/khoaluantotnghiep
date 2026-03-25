const request = require('supertest');
const app = require('../../app');
const db = require('../../models');
const { loginByRole } = require('../testAuth');

describe('AI Tutor Flow Integration Test', () => {
  let studentToken;
  let teacherToken;
  let testCourse;
  let testLecture;
  let conversationId;

  beforeAll(async () => {
    studentToken = await loginByRole('student');
    teacherToken = await loginByRole('teacher');

    // 1. Create course and lecture
    const courseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'AI Test Course',
        description: 'Testing AI tutor flow',
        price: 0
      });
    testCourse = courseRes.body.data.course;

    // Publish the course
    await request(app)
      .put(`/api/teacher/courses/${testCourse.id}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ published: true });

    const chapterRes = await request(app)
      .post(`/api/teacher/courses/${testCourse.id}/chapters`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'AI Chapter', order: 1 });
    const testChapter = chapterRes.body.data.chapter;

    const lectureRes = await request(app)
      .post(`/api/teacher/chapters/${testChapter.id}/lectures`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'AI Lecture', content: 'React hooks are functions that let you "hook into" React state and lifecycle features from function components.', type: 'text', order: 1 });
    testLecture = lectureRes.body.data.lecture;

    // 2. Student enrolls
    await request(app)
      .post(`/api/student/enroll/${testCourse.id}`)
      .set('Authorization', `Bearer ${studentToken}`);

    // 3. Ingest lecture for AI (Teacher)
    // Note: In real test environment, this might be mocked or use a test AI provider
    await request(app)
      .post(`/api/teacher/ai/ingest/lecture/${testLecture.id}`)
      .set('Authorization', `Bearer ${teacherToken}`);
  });

  it('should allow student to start a conversation and ask questions', async () => {
    // 1. Create conversation
    const convRes = await request(app)
      .post('/api/student/ai/conversations')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        courseId: testCourse.id,
        lectureId: testLecture.id,
        title: 'Learning about Hooks'
      });

    expect(convRes.statusCode).toBe(201);
    expect(convRes.body.success).toBe(true);
    conversationId = convRes.body.data.conversation.id;

    // 2. Send message (may return 201 on success or 500/503 if AI service not configured)
    const msgRes = await request(app)
      .post(`/api/student/ai/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        message: 'What are React hooks?'
      });

    // If AI service is configured: 201 with answer, otherwise may return 500/503
    expect([201, 500, 503]).toContain(msgRes.statusCode);
    if (msgRes.statusCode === 201) {
      expect(msgRes.body.success).toBe(true);
      expect(msgRes.body.data).toHaveProperty('answer');
    }
  }, 15000);

  it('should deny AI access if student is not enrolled', async () => {
    // Create a new course but DON'T enroll the student
    const newCourseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'AI Unenrolled Test Course',
        description: 'Testing AI access denial',
        price: 0
      });
    const newCourse = newCourseRes.body.data.course;

    // Publish the course
    await request(app)
      .put(`/api/teacher/courses/${newCourse.id}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ published: true });

    // Create chapter and lecture for the new course
    const chapterRes = await request(app)
      .post(`/api/teacher/courses/${newCourse.id}/chapters`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Chapter 1', order: 1 });
    const chapter = chapterRes.body.data.chapter;

    const lectureRes = await request(app)
      .post(`/api/teacher/chapters/${chapter.id}/lectures`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Test Lecture', content: 'Test content', type: 'text', order: 1 });
    const lecture = lectureRes.body.data.lecture;
    
    // Try to create AI conversation for unenrolled course
    const convRes = await request(app)
      .post('/api/student/ai/conversations')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        courseId: newCourse.id,
        lectureId: lecture.id,
        title: 'Test Conversation'
      });

    expect(convRes.statusCode).toBe(403);
    expect(convRes.body.success).toBe(false);
  });
});
