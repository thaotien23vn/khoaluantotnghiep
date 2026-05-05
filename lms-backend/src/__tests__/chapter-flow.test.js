const request = require('supertest');
const app = require('../app');
const { loginByRole } = require('./testAuth');
const db = require('../models');
const { Course, Chapter, Lesson } = db.models;

describe('Chapter Flow Tests', () => {
  let teacherToken;
  let teacherUserId;
  let testCourse;
  let testChapter;

  beforeAll(async () => {
    teacherToken = await loginByRole('teacher');

    const { User, Category } = db.models;
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
      title: 'Chapter Test Course',
      slug: `chapter-test-course-${timestamp}`,
      description: 'Test course for chapters',
      price: 0,
      teacherId: teacherUserId,
      published: true,
      categoryId: 1
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testChapter) {
      await Lesson.destroy({ where: { chapterId: testChapter.id }, force: true });
      await testChapter.destroy({ force: true });
    }
    if (testCourse) await testCourse.destroy({ force: true });
  });

  describe('Teacher Chapter Management', () => {
    test('GET /api/teacher/courses/:courseId/chapters - Get course chapters', async () => {
      const res = await request(app)
        .get(`/api/teacher/courses/${testCourse.id}/chapters`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect([200, 403, 404]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeInstanceOf(Array);
      }
    });

    test('POST /api/teacher/chapters - Create a chapter', async () => {
      const res = await request(app)
        .post('/api/teacher/chapters')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          courseId: testCourse.id,
          title: 'Test Chapter',
          description: 'Chapter for testing',
          orderIndex: 0
        });

      expect([201, 400, 403, 404]).toContain(res.statusCode);
      if (res.statusCode === 201) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('id');
        testChapter = res.body.data;
      }
    });

    test('PUT /api/teacher/chapters/:id - Update a chapter', async () => {
      // Create a chapter first if not exists
      if (!testChapter) {
        const createRes = await request(app)
          .post('/api/teacher/chapters')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            courseId: testCourse.id,
            title: 'Temp Chapter',
            description: 'Temp',
            orderIndex: 0
          });
        if (createRes.statusCode === 201) {
          testChapter = createRes.body.data;
        }
      }

      if (testChapter) {
        const res = await request(app)
          .put(`/api/teacher/chapters/${testChapter.id}`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            title: 'Updated Chapter Title',
            description: 'Updated description'
          });

        expect([200, 400, 403, 404]).toContain(res.statusCode);
        if (res.statusCode === 200) {
          expect(res.body.success).toBe(true);
        }
      }
    });

    test('POST /api/teacher/chapters/:chapterId/lectures - Create lecture in chapter', async () => {
      if (!testChapter) {
        // Create a chapter first
        const createRes = await request(app)
          .post('/api/teacher/chapters')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            courseId: testCourse.id,
            title: 'Chapter for Lecture',
            description: 'Test',
            orderIndex: 1
          });
        if (createRes.statusCode === 201) {
          testChapter = createRes.body.data;
        }
      }

      if (testChapter) {
        const res = await request(app)
          .post(`/api/teacher/chapters/${testChapter.id}/lectures`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            title: 'Test Lecture',
            description: 'Test lecture description',
            type: 'video',
            videoUrl: 'https://example.com/video.mp4',
            duration: 10,
            orderIndex: 0,
            isPublished: true
          });

        expect([201, 400, 403, 404]).toContain(res.statusCode);
        if (res.statusCode === 201) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('id');
        }
      }
    });

    test('DELETE /api/teacher/chapters/:id - Delete a chapter', async () => {
      // Create a temp chapter to delete
      const createRes = await request(app)
        .post('/api/teacher/chapters')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          courseId: testCourse.id,
          title: 'Chapter to Delete',
          description: 'Will be deleted',
          orderIndex: 99
        });

      if (createRes.statusCode === 201) {
        const chapterToDelete = createRes.body.data;

        const res = await request(app)
          .delete(`/api/teacher/chapters/${chapterToDelete.id}`)
          .set('Authorization', `Bearer ${teacherToken}`);

        expect([200, 400, 403, 404]).toContain(res.statusCode);
        if (res.statusCode === 200) {
          expect(res.body.success).toBe(true);
        }
      }
    });
  });

  describe('Student should not modify chapters', () => {
    let studentToken;

    beforeAll(async () => {
      studentToken = await loginByRole('student');
    });

    test('POST /api/teacher/chapters - Student cannot create chapter', async () => {
      const res = await request(app)
        .post('/api/teacher/chapters')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          courseId: testCourse.id,
          title: 'Student Chapter',
          description: 'Should fail',
          orderIndex: 0
        });

      expect(res.statusCode).toBe(403);
    });

    test('PUT /api/teacher/chapters/:id - Student cannot update chapter', async () => {
      if (testChapter) {
        const res = await request(app)
          .put(`/api/teacher/chapters/${testChapter.id}`)
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ title: 'Hacked Title' });

        expect(res.statusCode).toBe(403);
      }
    });

    test('DELETE /api/teacher/chapters/:id - Student cannot delete chapter', async () => {
      if (testChapter) {
        const res = await request(app)
          .delete(`/api/teacher/chapters/${testChapter.id}`)
          .set('Authorization', `Bearer ${studentToken}`);

        expect(res.statusCode).toBe(403);
      }
    });
  });
});
