const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { seedCore, TEST_PREFIX } = require('./jest.teardown');
const { loginByRole } = require('./testAuth');

async function login(email, password = 'Password123@') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect([200, 201]).toContain(res.statusCode);
  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Forum flow', () => {
  it('student can create topic + post, and admin can list reports and ban user', async () => {
    const seeded = await seedCore();

    // Ensure student not banned from previous runs
    await db.models.User.update(
      { chatBannedUntil: null, chatBanReason: null },
      { where: { id: seeded.student.id } },
    );

    const studentToken = await login(`${TEST_PREFIX}student@example.com`);

    // create topic
    const topicRes = await request(app)
      .post('/api/forum/topics')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: `${TEST_PREFIX}topic`,
        content: 'seed topic content',
        type: 'global',
      });

    expect(topicRes.statusCode).toBe(201);
    expect(topicRes.body).toHaveProperty('success', true);
    const topic = topicRes.body?.data;
    expect(topic).toBeTruthy();

    // create post
    const postRes = await request(app)
      .post(`/api/forum/topics/${topic.id}/posts`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'seed post content' });

    expect(postRes.statusCode).toBe(201);
    expect(postRes.body).toHaveProperty('success', true);
    const post = postRes.body?.data;
    expect(post).toBeTruthy();

    // report post
    const reportRes = await request(app)
      .post(`/api/forum/posts/${post.id}/report`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ reason: 'spam' });

    expect(reportRes.statusCode).toBe(201);
    expect(reportRes.body).toHaveProperty('success', true);

    // admin list reports
    const adminToken = await loginByRole('admin');

    const reportsRes = await request(app)
      .get('/api/forum/reports?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reportsRes.statusCode).toBe(200);
    expect(reportsRes.body).toHaveProperty('success', true);
    const reports = reportsRes.body?.data?.reports;
    expect(Array.isArray(reports)).toBe(true);

    // ban student from forum
    const banRes = await request(app)
      .put(`/api/forum/admin/users/${seeded.student.id}/ban-forum`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        chatBannedUntil: new Date(Date.now() + 60_000).toISOString(),
        chatBanReason: 'test',
      });

    expect(banRes.statusCode).toBe(200);
    expect(banRes.body).toHaveProperty('success', true);

    // now student cannot create topic
    const deniedRes = await request(app)
      .post('/api/forum/topics')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: `${TEST_PREFIX}topic_denied`,
        content: 'denied',
        type: 'global',
      });

    expect(deniedRes.statusCode).toBe(403);

    // cleanup created forum rows
    const { ForumPost, ForumTopic, ForumReport } = db.models;
    await ForumReport.destroy({ where: { reporterId: seeded.student.id } });
    await ForumPost.destroy({ where: { topicId: topic.id } });
    await ForumTopic.destroy({ where: { id: topic.id } });
  });
});
