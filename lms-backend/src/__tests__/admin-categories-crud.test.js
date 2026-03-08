const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole } = require('./testAuth');

describe('Admin categories CRUD', () => {
  it('should create, update, list, and delete a category created by tests', async () => {
    const token = await loginByRole('admin');

    const createRes = await request(app)
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'it_seed_category_admin_crud', menuSection: 'test' });

    expect([200, 201]).toContain(createRes.statusCode);
    expect(createRes.body).toHaveProperty('success', true);

    const createdId = createRes.body?.data?.category?.id || createRes.body?.data?.id;
    expect(createdId).toBeTruthy();

    const listRes = await request(app)
      .get('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body).toHaveProperty('success', true);

    const categories = listRes.body?.data?.categories;
    expect(Array.isArray(categories)).toBe(true);

    const found = categories.find((c) => Number(c.id) === Number(createdId) || String(c.name) === 'it_seed_category_admin_crud');
    expect(found).toBeTruthy();

    const updateRes = await request(app)
      .put(`/api/admin/categories/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'it_seed_category_admin_crud_updated', menuSection: 'test2' });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body).toHaveProperty('success', true);

    const deleteRes = await request(app)
      .delete(`/api/admin/categories/${createdId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body).toHaveProperty('success', true);

    // best-effort cleanup if controller delete failed silently
    await db.models.Category.destroy({ where: { id: createdId } });
  });
});
