const request = require('supertest');
const app = require('../../app');
const db = require('../../models');
const { loginByRole } = require('../testAuth');

describe('Forum Interaction Integration Test', () => {
  let studentToken;
  let adminToken;
  let testTopic;
  let testPost;

  beforeAll(async () => {
    studentToken = await loginByRole('student');
    adminToken = await loginByRole('admin');
  });

  it('should allow student to create a topic and others to reply', async () => {
    // 1. Student creates a topic
    const topicRes = await request(app)
      .post('/api/forum/topics')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: 'Integration Test Topic',
        content: 'This is a test topic for integration testing',
        category: 'general'
      });

    expect(topicRes.statusCode).toBe(201);
    expect(topicRes.body.success).toBe(true);
    testTopic = topicRes.body.data;

    // 2. Admin (or another user) replies to the topic
    const postRes = await request(app)
      .post(`/api/forum/topics/${testTopic.id}/posts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        content: 'This is a test reply'
      });

    expect(postRes.statusCode).toBe(201);
    expect(postRes.body.success).toBe(true);
    testPost = postRes.body.data;
  });

  it('should allow users to like posts', async () => {
    const likeRes = await request(app)
      .post(`/api/forum/posts/${testPost.id}/like`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(likeRes.statusCode).toBe(200);
    expect(likeRes.body.success).toBe(true);

    // Verify like count
    const topicRes = await request(app)
      .get(`/api/forum/topics/${testTopic.id}`)
      .set('Authorization', `Bearer ${studentToken}`);

    const post = topicRes.body.data.posts.find(p => p.id === testPost.id);
    expect(post.likes).toBeGreaterThan(0);
  });

  it('should allow reporting inappropriate posts and admin to review', async () => {
    // 1. Student reports the post
    const reportRes = await request(app)
      .post(`/api/forum/posts/${testPost.id}/report`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        reason: 'Inappropriate content'
      });

    expect(reportRes.statusCode).toBe(201);

    // 2. Admin views reports
    const adminReportsRes = await request(app)
      .get('/api/forum/reports')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminReportsRes.statusCode).toBe(200);
    expect(adminReportsRes.body.data.reports.length).toBeGreaterThan(0);
  });
});
