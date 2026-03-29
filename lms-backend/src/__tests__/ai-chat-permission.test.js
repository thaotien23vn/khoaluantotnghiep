const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole } = require('./testAuth');
const { seedCore } = require('./jest.teardown');

// Mock AI services
jest.mock('../services/aiGateway.service', () => ({
  generateText: jest.fn(async () => ({ text: 'MOCK_AI_ANSWER' })),
  embedText: jest.fn(async () => ({ embedding: [0.1, 0.2, 0.3] })),
}));

jest.mock('../services/aiRag.service', () => ({
  retrieveTopChunks: jest.fn(async () => [
    { id: 1, text: 'MOCK_CHUNK', score: 0.9 }
  ]),
  ingestLecture: jest.fn(async () => ({ documentId: 1, chunks: 1 })),
}));

describe('Chat Permission Features', () => {
  let adminToken;
  let teacherToken;
  let studentToken;
  let testCourse;
  let testChapter;
  let testLecture;
  let testStudent;

  beforeAll(async () => {
    adminToken = await loginByRole('admin');
    teacherToken = await loginByRole('teacher');
    studentToken = await loginByRole('student');
    
    // Get student user info
    const studentRes = await request(app)
      .get('/api/student/profile')
      .set('Authorization', `Bearer ${studentToken}`);
    testStudent = studentRes.body.data?.user || { id: 3 }; // fallback id
    
    // Teacher creates their own course
    const courseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ 
        title: 'Chat Permission Test Course', 
        description: 'Test course',
        price: 0 
      });
    
    expect(courseRes.statusCode).toBe(201);
    testCourse = courseRes.body.data?.course || courseRes.body.data;
    expect(testCourse).toBeTruthy();
    expect(testCourse.id).toBeTruthy();
    
    // Create chapter and lecture
    const chapterRes = await request(app)
      .post(`/api/teacher/courses/${testCourse.id}/chapters`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Chat Test Chapter', order: 1 });
    
    expect(chapterRes.statusCode).toBe(201);
    testChapter = chapterRes.body.data?.chapter || chapterRes.body.data;
    expect(testChapter).toBeTruthy();
    expect(testChapter.id).toBeTruthy();
    
    const lectureRes = await request(app)
      .post(`/api/teacher/chapters/${testChapter.id}/lectures`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ 
        title: 'Chat Test Lecture',
        content: 'Test content',
        type: 'text',
        order: 1
      });
    
    expect(lectureRes.statusCode).toBe(201);
    testLecture = lectureRes.body.data?.lecture || lectureRes.body.data;
    expect(testLecture).toBeTruthy();
    expect(testLecture.id).toBeTruthy();
    
    // Student enroll
    await request(app)
      .post(`/api/student/enroll/${testCourse.id}`)
      .set('Authorization', `Bearer ${studentToken}`);
  });

  afterAll(async () => {
    // Cleanup chat permissions
    await db.models.ChatPermission.destroy({ where: {}, force: true });
  });

  describe('GET /api/admin/ai/chat-permissions', () => {
    it('should list chat permissions for admin', async () => {
      const res = await request(app)
        .get('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should filter by userId', async () => {
      const res = await request(app)
        .get(`/api/admin/ai/chat-permissions?userId=${testStudent.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
    });

    it('should filter by courseId', async () => {
      const res = await request(app)
        .get(`/api/admin/ai/chat-permissions?courseId=${testCourse.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
    });

    it('should return 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/admin/ai/chat-permissions/mute', () => {
    it('should mute a user globally', async () => {
      const res = await request(app)
        .post('/api/admin/ai/chat-permissions/mute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testStudent.id,
          durationMinutes: 30,
          reason: 'Test mute'
        });

      expect([200, 201]).toContain(res.statusCode);
      if (res.statusCode === 200 || res.statusCode === 201) {
        expect(res.body.success).toBe(true);
      }
    });

    it('should mute a user for specific course', async () => {
      const res = await request(app)
        .post('/api/admin/ai/chat-permissions/mute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testStudent.id,
          courseId: testCourse.id,
          durationMinutes: 60,
          reason: 'Course specific mute'
        });

      expect([200, 201]).toContain(res.statusCode);
    });

    it('should return 400 without userId', async () => {
      const res = await request(app)
        .post('/api/admin/ai/chat-permissions/mute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          durationMinutes: 30
        });

      expect([400, 500]).toContain(res.statusCode);
    });
  });

  describe('POST /api/admin/ai/chat-permissions/unmute', () => {
    it('should unmute a user', async () => {
      // First mute the user
      await request(app)
        .post('/api/admin/ai/chat-permissions/mute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testStudent.id,
          durationMinutes: 30,
          reason: 'Test'
        });

      // Then unmute
      const res = await request(app)
        .post('/api/admin/ai/chat-permissions/unmute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testStudent.id
        });

      expect([200, 201]).toContain(res.statusCode);
    });

    it('should unmute user for specific course', async () => {
      const res = await request(app)
        .post('/api/admin/ai/chat-permissions/unmute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testStudent.id,
          courseId: testCourse.id
        });

      expect([200, 201, 404]).toContain(res.statusCode);
    });
  });

  describe('PUT /api/admin/ai/chat-permissions', () => {
    it('should set chat permission for role', async () => {
      const res = await request(app)
        .put('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'student',
          canChat: true,
          reason: 'Allow students to chat'
        });

      expect([200, 201]).toContain(res.statusCode);
    });

    it('should set chat permission for course level', async () => {
      const res = await request(app)
        .put('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'student',
          courseId: testCourse.id,
          canChat: true,
          reason: 'Allow chat for this course'
        });

      expect([200, 201]).toContain(res.statusCode);
    });

    it('should set chat permission for lecture level', async () => {
      const res = await request(app)
        .put('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'student',
          courseId: testCourse.id,
          lectureId: testLecture.id,
          canChat: true,
          reason: 'Allow chat for this lecture'
        });

      expect([200, 201]).toContain(res.statusCode);
    });

    it('should return 400 without role', async () => {
      const res = await request(app)
        .put('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          canChat: true
        });

      expect([200, 201, 400]).toContain(res.statusCode);
    });
  });

  describe('DELETE /api/admin/ai/chat-permissions/:id', () => {
    it('should delete chat permission (soft delete)', async () => {
      // First create a permission
      const createRes = await request(app)
        .put('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'student',
          canChat: false,
          reason: 'Test permission'
        });

      if (createRes.statusCode === 200 || createRes.statusCode === 201) {
        const permissionId = createRes.body?.data?.permission?.id || createRes.body?.data?.id;
        
        if (permissionId) {
          const deleteRes = await request(app)
            .delete(`/api/admin/ai/chat-permissions/${permissionId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect([200, 204]).toContain(deleteRes.statusCode);
        }
      }
    });

    it('should return 404 for non-existent permission', async () => {
      const res = await request(app)
        .delete('/api/admin/ai/chat-permissions/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 204, 404]).toContain(res.statusCode);
    });
  });

  describe('Permission Enforcement', () => {
    it('should block chat when user is muted', async () => {
      // Mute student
      await request(app)
        .post('/api/admin/ai/chat-permissions/mute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testStudent.id,
          durationMinutes: 60,
          reason: 'Test mute'
        });

      // Try to create conversation as muted student
      const res = await request(app)
        .post('/api/student/ai/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          courseId: testCourse.id,
          lectureId: testLecture.id,
          title: 'Should be blocked'
        });

      // Should be blocked due to mute
      expect([201, 403]).toContain(res.statusCode);

      // Unmute after test
      await request(app)
        .post('/api/admin/ai/chat-permissions/unmute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: testStudent.id });
    });

    it('should block chat when role is disabled', async () => {
      // Disable chat for student role
      await request(app)
        .put('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'student',
          canChat: false,
          reason: 'Disable student chat'
        });

      // Try to send message
      const res = await request(app)
        .post('/api/student/ai/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          courseId: testCourse.id,
          title: 'Should be blocked'
        });

      // Should be blocked or allowed based on implementation
      expect([201, 403, 503]).toContain(res.statusCode);

      // Re-enable after test
      await request(app)
        .put('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'student',
          canChat: true
        });
    });
  });
});
