const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole } = require('./testAuth');

describe('Teacher course CRUD (safe: only test-created resources)', () => {
  it('should create, update, publish/unpublish, and delete a teacher course created by tests', async () => {
    const teacherToken = await loginByRole('teacher');
    const adminToken = await loginByRole('admin');

    const uniq = Date.now();
    const title = `it_seed_teacher_course_${uniq}`;

    const createRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title, description: 'seed', price: 0, published: false });

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body).toHaveProperty('success', true);

    const createdId = createRes.body?.data?.course?.id;
    expect(createdId).toBeTruthy();

    const updateRes = await request(app)
      .put(`/api/teacher/courses/${createdId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: `${title}_updated`, description: 'seed2', price: 0 });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body).toHaveProperty('success', true);

    // Test updating published via general update endpoint (frontend behavior)
    const updatePublishRes = await request(app)
      .put(`/api/teacher/courses/${createdId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ published: true });

    expect(updatePublishRes.statusCode).toBe(200);
    expect(updatePublishRes.body).toHaveProperty('success', true);

    // Test with string 'true' (common frontend issue)
    const updatePublishStringRes = await request(app)
      .put(`/api/teacher/courses/${createdId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ published: 'true' });

    expect(updatePublishStringRes.statusCode).toBe(200);
    expect(updatePublishStringRes.body).toHaveProperty('success', true);

    const unpubRes = await request(app)
      .put(`/api/teacher/courses/${createdId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: false });

    expect(unpubRes.statusCode).toBe(200);
    expect(unpubRes.body).toHaveProperty('success', true);

    const pubRes = await request(app)
      .put(`/api/teacher/courses/${createdId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });

    expect(pubRes.statusCode).toBe(200);
    expect(pubRes.body).toHaveProperty('success', true);

    const deleteRes = await request(app)
      .delete(`/api/teacher/courses/${createdId}`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body).toHaveProperty('success', true);

    await db.models.Course.destroy({ where: { id: createdId } });
  });
});
