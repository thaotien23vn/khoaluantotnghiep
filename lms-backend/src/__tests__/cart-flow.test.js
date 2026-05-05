const request = require('supertest');
const app = require('../app');
const { loginByRole } = require('./testAuth');
const db = require('../models');
const { Course, Cart } = db.models;

describe('Cart Flow Tests', () => {
  let studentToken;
  let studentUserId;
  let testCourse1;
  let testCourse2;

  beforeAll(async () => {
    studentToken = await loginByRole('student');
    
    // Get student user info from token
    const { User } = db.models;
    const student = await User.findOne({ where: { email: 'student@gmail.com' } });
    studentUserId = student?.id;

    // Create test courses with unique slugs
    const teacher = await User.findOne({ where: { email: 'teacher@gmail.com' } });
    const timestamp = Date.now();
    
    // Ensure category exists
    const { Category } = db.models;
    let category = await Category.findByPk(1);
    if (!category) {
      category = await Category.create({ id: 1, name: 'Test Category', slug: 'test-category' });
    }
    
    testCourse1 = await Course.create({
      title: 'Cart Test Course 1',
      slug: `cart-test-course-1-${timestamp}`,
      description: 'Test Description',
      price: 100000,
      teacherId: teacher.id,
      published: true,
      categoryId: 1
    });

    testCourse2 = await Course.create({
      title: 'Cart Test Course 2',
      slug: `cart-test-course-2-${timestamp}`,
      description: 'Test Description',
      price: 200000,
      teacherId: teacher.id,
      published: true,
      categoryId: 1
    });
  });

  afterAll(async () => {
    if (testCourse1) await testCourse1.destroy({ force: true });
    if (testCourse2) await testCourse2.destroy({ force: true });
    if (studentUserId) await Cart.destroy({ where: { userId: studentUserId }, force: true });
  });

  test('GET /api/cart - Initial empty cart', async () => {
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeInstanceOf(Array);
  });

  test('POST /api/cart/items - Add item to cart', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: testCourse1.id });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeInstanceOf(Array);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  test('GET /api/cart/count - Verify cart count', async () => {
    const res = await request(app)
      .get('/api/cart/count')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.count).toBe(1);
  });

  test('POST /api/cart/items - Add duplicate item (should handle gracefully)', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: testCourse1.id });

    expect(res.statusCode).toBe(200); // 200 instead of 201 because it already exists
    expect(res.body.message).toContain('đã có');
  });

  test('DELETE /api/cart/items/:itemId - Remove item from cart', async () => {
    // First get the item ID
    const cartRes = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${studentToken}`);
    
    const itemId = cartRes.body.data.items[0].id;

    const res = await request(app)
      .delete(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify count is 0
    const countRes = await request(app)
      .get('/api/cart/count')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(countRes.body.data.count).toBe(0);
  });

  test('DELETE /api/cart - Clear entire cart', async () => {
    // Add two items
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: testCourse1.id });
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: testCourse2.id });

    // Clear cart
    const res = await request(app)
      .delete('/api/cart')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify count is 0
    const countRes = await request(app)
      .get('/api/cart/count')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(countRes.body.data.count).toBe(0);
  });
});
