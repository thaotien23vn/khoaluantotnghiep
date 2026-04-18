const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole, TEST_ACCOUNTS } = require('./testAuth');

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
  let testStudent;
  let createdPermissionId;

  beforeAll(async () => {
    adminToken = await loginByRole('admin');
    teacherToken = await loginByRole('teacher');
    studentToken = await loginByRole('student');

    testStudent = await db.models.User.findOne({
      where: { email: TEST_ACCOUNTS.student.email },
      attributes: ['id'],
    });
    expect(testStudent).toBeTruthy();
  });

  afterAll(async () => {
    if (createdPermissionId) {
      await db.models.ChatPermission.destroy({
        where: { id: createdPermissionId },
        force: true,
      });
    }
  });

  describe('GET /api/admin/ai/chat-permissions', () => {
    it('returns 200 for admin', async () => {
      const res = await request(app)
        .get('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body?.data?.permissions)).toBe(true);
    });

    it('returns 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/admin/ai/chat-permissions/mute', () => {
    it('mutes a user globally', async () => {
      const res = await request(app)
        .post('/api/admin/ai/chat-permissions/mute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testStudent.id,
          durationMinutes: 30,
          reason: 'Test mute'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/admin/ai/chat-permissions/unmute', () => {
    it('unmutes a user', async () => {
      const res = await request(app)
        .post('/api/admin/ai/chat-permissions/unmute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testStudent.id
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /api/admin/ai/chat-permissions', () => {
    it('sets role-level chat permission', async () => {
      const res = await request(app)
        .put('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'student',
          canChat: true,
          reason: 'Allow students to chat'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const listRes = await request(app)
        .get('/api/admin/ai/chat-permissions?role=student&page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.statusCode).toBe(200);
      const first = listRes.body?.data?.permissions?.[0];
      expect(first).toBeTruthy();
      createdPermissionId = first.id;
    });

    it('returns 403 for non-admin role update', async () => {
      const res = await request(app)
        .put('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          role: 'student',
          canChat: true
        });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/admin/ai/chat-permissions/:id', () => {
    it('soft deletes a created permission', async () => {
      expect(createdPermissionId).toBeTruthy();
      const deleteRes = await request(app)
        .delete(`/api/admin/ai/chat-permissions/${createdPermissionId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deleteRes.statusCode).toBe(200);
      expect(deleteRes.body.success).toBe(true);
      createdPermissionId = null;
    });

    it('returns 403 when non-admin attempts delete', async () => {
      const res = await request(app)
        .delete('/api/admin/ai/chat-permissions/1')
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('conversation endpoint permission guard', () => {
    it('returns 400 when conversation payload is invalid', async () => {
      const res = await request(app)
        .post('/api/student/ai/conversations')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Missing courseId' });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 when teacher accesses student conversation endpoint', async () => {
      const res = await request(app)
        .post('/api/student/ai/conversations')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ courseId: 1, title: 'Blocked by role' });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('muting does not break admin list endpoint', () => {
    it('keeps chat-permissions list accessible after mute/unmute cycle', async () => {
      const muteRes = await request(app)
        .post('/api/admin/ai/chat-permissions/mute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: testStudent.id, durationMinutes: 5, reason: 'cycle test' });
      expect(muteRes.statusCode).toBe(200);

      const unmuteRes = await request(app)
        .post('/api/admin/ai/chat-permissions/unmute')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: testStudent.id });
      expect(unmuteRes.statusCode).toBe(200);

      const listRes = await request(app)
        .get('/api/admin/ai/chat-permissions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.statusCode).toBe(200);
      expect(listRes.body.success).toBe(true);
    });
  });
});
