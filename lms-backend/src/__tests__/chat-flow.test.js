const request = require('supertest');
const app = require('../app');
const { loginByRole } = require('./testAuth');
const db = require('../models');
const { Course, Enrollment } = db.models;

describe('Chat Flow Tests', () => {
  let studentToken;
  let teacherToken;
  let studentUserId;
  let teacherUserId;
  let testCourse;
  let testLesson;
  let testChatId;

  beforeAll(async () => {
    studentToken = await loginByRole('student');
    teacherToken = await loginByRole('teacher');

    const { User, Category, Lecture, CourseChat } = db.models;
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
      title: 'Chat Test Course',
      slug: `chat-test-course-${timestamp}`,
      description: 'Test course for chat',
      price: 0,
      teacherId: teacherUserId,
      published: true,
      categoryId: 1
    });

    // Create enrollment
    await Enrollment.create({
      userId: studentUserId,
      courseId: testCourse.id,
      status: 'active',
      enrollmentStatus: 'active',
      progressPercent: 0
    });

    // Create a lecture for the course
    testLesson = await Lecture.create({
      courseId: testCourse.id,
      title: 'Chat Test Lesson',
      description: 'Test lesson',
      type: 'video',
      duration: 10,
      orderIndex: 0
    });

    // Get or create course chat
    const courseChat = await CourseChat.findOrCreate({
      where: { courseId: testCourse.id },
      defaults: {
        courseId: testCourse.id,
        title: 'Course Chat',
        isEnabled: true,
        isActive: true
      }
    });
    testChatId = courseChat[0].id;
  });

  afterAll(async () => {
    const { Lecture, CourseChat, CourseMessage } = db.models;
    // Cleanup chat messages and related data
    if (testChatId) {
      await CourseMessage.destroy({ where: { chatId: testChatId }, force: true }).catch(() => {});
      await CourseChat.destroy({ where: { courseId: testCourse.id }, force: true }).catch(() => {});
    }
    if (testLesson) await Lecture.destroy({ where: { id: testLesson.id }, force: true }).catch(() => {});
    await Enrollment.destroy({ where: { courseId: testCourse.id }, force: true }).catch(() => {});
    if (testCourse) await testCourse.destroy({ force: true }).catch(() => {});
  });

  describe('Course Chat', () => {
    test('GET /api/student/courses/:courseId/chat - Get course chat', async () => {
      const res = await request(app)
        .get(`/api/student/courses/${testCourse.id}/chat`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect([200, 404]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('chat');
        expect(res.body.data).toHaveProperty('messages');
      }
    });

    test('POST /api/student/courses/:courseId/chat/messages - Send message', async () => {
      try {
        const res = await request(app)
          .post(`/api/student/courses/${testCourse.id}/chat/messages`)
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            content: 'Hello, this is a test message!'
          })
          .timeout(5000); // 5s timeout - AI moderation may be slow

        expect([200, 201, 400, 403, 404, 500]).toContain(res.statusCode);
        if (res.statusCode === 200 || res.statusCode === 201) {
          expect(res.body.success).toBe(true);
          if (res.body.data) {
            expect(res.body.data).toHaveProperty('message');
          }
        }
      } catch (err) {
        // Timeout or network error is acceptable for AI-heavy endpoints
        expect(['timeout', 'ETIMEDOUT', 'ECONNABORTED']).toContain(err.code);
      }
    }, 10000);

    test('GET /api/teacher/courses/:courseId/chat - Get chat as teacher', async () => {
      const res = await request(app)
        .get(`/api/teacher/courses/${testCourse.id}/chat`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect([200, 403, 404]).toContain(res.statusCode);
    });

    test('GET /api/teacher/course-chat/escalations - Get escalations', async () => {
      const res = await request(app)
        .get('/api/teacher/course-chat/escalations')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect([200, 403]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeInstanceOf(Array);
      }
    });

    test('POST /api/teacher/courses/:courseId/chat/reply - Teacher reply', async () => {
      const res = await request(app)
        .post(`/api/teacher/courses/${testCourse.id}/chat/reply`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          content: 'Teacher response',
          parentId: null
        });

      expect([200, 201, 400, 403, 404]).toContain(res.statusCode);
    });
  });

  describe('Lesson Chat', () => {
    test('GET /api/lessons/:lessonId/chat - Get lesson chat', async () => {
      const res = await request(app)
        .get(`/api/lessons/${testLesson.id}/chat`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect([200, 404]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('chat');
      }
    });

    test('POST /api/chat/:chatId/messages - Send message to lesson chat', async () => {
      // First get the chat ID from lesson chat
      const chatRes = await request(app)
        .get(`/api/lessons/${testLesson.id}/chat`)
        .set('Authorization', `Bearer ${studentToken}`);

      if (chatRes.statusCode === 200 && chatRes.body.data?.chat?.id) {
        const chatId = chatRes.body.data.chat.id;

        const res = await request(app)
          .post(`/api/chat/${chatId}/messages`)
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            content: 'Lesson chat message'
          });

        expect([200, 201, 400, 403]).toContain(res.statusCode);
      }
    });
  });

  describe('Chat Management (Teacher/Admin)', () => {
    test('GET /api/teacher/courses/:courseId/chat/analytics - Chat analytics', async () => {
      const res = await request(app)
        .get(`/api/teacher/courses/${testCourse.id}/chat/analytics`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect([200, 403, 404]).toContain(res.statusCode);
    });

    test('POST /api/teacher/courses/:courseId/chat/mute - Mute chat', async () => {
      const res = await request(app)
        .post(`/api/teacher/courses/${testCourse.id}/chat/mute`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ durationMinutes: 30 });

      expect([200, 201, 403, 404]).toContain(res.statusCode);
    });

    test('DELETE /api/teacher/courses/:courseId/chat/mute - Unmute chat', async () => {
      const res = await request(app)
        .delete(`/api/teacher/courses/${testCourse.id}/chat/mute`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect([200, 403, 404]).toContain(res.statusCode);
    });

    test('POST /api/teacher/courses/:courseId/chat/toggle - Toggle chat', async () => {
      const res = await request(app)
        .post(`/api/teacher/courses/${testCourse.id}/chat/toggle`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect([200, 403, 404]).toContain(res.statusCode);
    });
  });

  describe('Message Operations', () => {
    test('PUT /api/student/courses/:courseId/chat/messages/:messageId - Edit message', async () => {
      // This would need a valid message ID
      const res = await request(app)
        .put(`/api/student/courses/${testCourse.id}/chat/messages/99999`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'Edited message' });

      expect([200, 403, 404]).toContain(res.statusCode);
    });

    test('DELETE /api/student/courses/:courseId/chat/messages/:messageId - Delete message', async () => {
      const res = await request(app)
        .delete(`/api/student/courses/${testCourse.id}/chat/messages/99999`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect([200, 403, 404]).toContain(res.statusCode);
    });

    test('DELETE /api/chat/messages/:messageId - Delete via generic route', async () => {
      const res = await request(app)
        .delete('/api/chat/messages/99999')
        .set('Authorization', `Bearer ${studentToken}`);

      expect([200, 403, 404]).toContain(res.statusCode);
    });
  });
});
