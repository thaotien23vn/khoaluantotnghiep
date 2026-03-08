const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole } = require('./testAuth');

describe('Admin users CRUD (test-created users only)', () => {
  it('should create, update, list, and delete a user created by tests', async () => {
    const token = await loginByRole('admin');

    const uniq = Date.now();
    const username = `it_seed_user_${uniq}`;
    const email = `it_seed_user_${uniq}@example.com`;

    const createRes = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username, email, password: '123456', role: 'student' });

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body).toHaveProperty('success', true);

    const createdId = createRes.body?.data?.user?.id;
    expect(createdId).toBeTruthy();

    const listRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body).toHaveProperty('success', true);

    const users = listRes.body?.data?.users;
    expect(Array.isArray(users)).toBe(true);

    const found = users.find((u) => Number(u.id) === Number(createdId));
    expect(found).toBeTruthy();

    const updateRes = await request(app)
      .put(`/api/admin/users/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true, role: 'student', newPassword: '123456' });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body).toHaveProperty('success', true);

    const deleteRes = await request(app)
      .delete(`/api/admin/users/${createdId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body).toHaveProperty('success', true);

    await db.models.User.destroy({ where: { id: createdId } });
  });
});
