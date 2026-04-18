const request = require('supertest');
const app = require('../../app');
const { loginByRole } = require('../testAuth');

// Mock AI services để tránh timeout
jest.mock('../../services/aiGateway.service', () => ({
  generateText: jest.fn(async () => ({ text: 'MOCK_AI_ANSWER' })),
  embedText: jest.fn(async () => ({ embedding: [1, 0, 0] })),
}));

jest.mock('../../services/aiRag.service', () => ({
  retrieveTopChunks: jest.fn(async () => [
    { id: 1, text: 'MOCK_CHUNK_1', score: 0.9, lectureId: null, courseId: null },
  ]),
  ingestLecture: jest.fn(async () => ({ documentId: 1, chunks: 2 })),
}));

describe('AI Tutor Flow Integration Test', () => {
  let studentToken;
  let teacherToken;
  let adminToken;
  let testCourse;
  let testChapter;
  let testLecture;
  let conversationId;
  const createdCourseIds = [];
  const createdChapterIds = [];
  const createdLectureIds = [];

  beforeAll(async () => {
    studentToken = await loginByRole('student');
    teacherToken = await loginByRole('teacher');
    adminToken = await loginByRole('admin');

    // 1. Create course and lecture
    const courseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'AI Test Course',
        description: 'Testing AI tutor flow',
        price: 0
      });
    expect(courseRes.status).toBe(201);
    testCourse = courseRes.body.data.course;
    createdCourseIds.push(testCourse.id);

    // Publish requires admin role in current codebase.
    const publishRes = await request(app)
      .put(`/api/teacher/courses/${testCourse.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });
    expect(publishRes.status).toBe(200);

    const chapterRes = await request(app)
      .post(`/api/teacher/chapters`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ courseId: testCourse.id, title: 'AI Chapter', order: 1 });
    expect(chapterRes.status).toBe(201);
    testChapter = chapterRes.body.data.chapter;
    createdChapterIds.push(testChapter.id);

    const lectureRes = await request(app)
      .post(`/api/teacher/chapters/${testChapter.id}/lectures`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'AI Lecture', content: 'React hooks are functions that let you "hook into" React state and lifecycle features from function components.', type: 'text', order: 1 });
    expect(lectureRes.status).toBe(201);
    testLecture = lectureRes.body.data.lecture;
    createdLectureIds.push(testLecture.id);

    // 2. Student enrolls
    const enrollRes = await request(app)
      .post(`/api/student/enroll/${testCourse.id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(enrollRes.status).toBe(201);

    // 3. Ingest lecture for AI (Teacher)
    const ingestRes = await request(app)
      .post(`/api/teacher/ai/ingest/lecture/${testLecture.id}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(ingestRes.status).toBe(200);
  });

  afterAll(async () => {
    const db = require('../../models');
    const { Lecture, Chapter, Course, Enrollment } = db.models;
    await Enrollment.destroy({ where: { courseId: createdCourseIds } });
    await Lecture.destroy({ where: { id: createdLectureIds } });
    await Chapter.destroy({ where: { id: createdChapterIds } });
    await Course.destroy({ where: { id: createdCourseIds } });
  });

  it('creates conversation for enrolled student', async () => {
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
  });

  it('sends message and gets AI answer for created conversation', async () => {
    expect(conversationId).toBeTruthy();
    const msgRes = await request(app)
      .post(`/api/student/ai/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        message: 'What are React hooks?'
      });

    expect(msgRes.statusCode).toBe(201);
    expect(msgRes.body.success).toBe(true);
    expect(msgRes.body.data).toHaveProperty('answer');
  });

  it('denies AI conversation for unenrolled student', async () => {
    // Create a new course but DON'T enroll the student
    const newCourseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'AI Unenrolled Test Course',
        description: 'Testing AI access denial',
        price: 0
      });
    expect(newCourseRes.status).toBe(201);
    const newCourse = newCourseRes.body.data.course;
    createdCourseIds.push(newCourse.id);

    const publishRes = await request(app)
      .put(`/api/teacher/courses/${newCourse.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });
    expect(publishRes.status).toBe(200);

    // Create chapter and lecture for the new course
    const chapterRes = await request(app)
      .post(`/api/teacher/chapters`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ courseId: newCourse.id, title: 'Chapter 1', order: 1 });
    expect(chapterRes.status).toBe(201);
    const chapter = chapterRes.body.data.chapter;
    createdChapterIds.push(chapter.id);

    const lectureRes = await request(app)
      .post(`/api/teacher/chapters/${chapter.id}/lectures`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Test Lecture', content: 'Test content', type: 'text', order: 1 });
    expect(lectureRes.status).toBe(201);
    const lecture = lectureRes.body.data.lecture;
    createdLectureIds.push(lecture.id);
    
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

  it('validates message payload for existing conversation', async () => {
    const res = await request(app)
      .post(`/api/student/ai/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ message: '' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
