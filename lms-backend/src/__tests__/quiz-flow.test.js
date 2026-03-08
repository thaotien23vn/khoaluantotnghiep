const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { seedCore, TEST_PREFIX } = require('./jest.teardown');

async function loginTeacher() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: `${TEST_PREFIX}teacher@example.com`, password: '123456' });

  expect([200, 201]).toContain(res.statusCode);
  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

async function loginStudent() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: `${TEST_PREFIX}student@example.com`, password: '123456' });

  expect([200, 201]).toContain(res.statusCode);
  const token = res.body?.data?.token;
  expect(typeof token).toBe('string');
  return token;
}

describe('Quiz flow (no uploads)', () => {
  it('Teacher can create quiz + add question, student can start + submit attempt', async () => {
    const seeded = await seedCore();

    await db.models.Attempt.destroy({ where: {}, force: false });
    await db.models.Question.destroy({ where: {}, force: false });
    await db.models.Quiz.destroy({ where: { title: 'IT Seed Quiz' } });

    const teacherToken = await loginTeacher();

    const createQuizRes = await request(app)
      .post(`/api/teacher/courses/${seeded.course.id}/quizzes`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'IT Seed Quiz', description: 'seed', maxScore: 10, timeLimit: 10, passingScore: 60 });

    expect(createQuizRes.statusCode).toBe(201);
    expect(createQuizRes.body).toHaveProperty('success', true);

    const quizId = createQuizRes.body?.data?.quiz?.id;
    expect(quizId).toBeTruthy();

    const addQuestionRes = await request(app)
      .post(`/api/teacher/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        type: 'multiple_choice',
        content: '1 + 1 = ? ',
        options: ['1', '2'],
        correctAnswer: '2',
        points: 10,
      });

    expect(addQuestionRes.statusCode).toBe(201);
    expect(addQuestionRes.body).toHaveProperty('success', true);

    const questionId = addQuestionRes.body?.data?.question?.id;
    expect(questionId).toBeTruthy();

    const studentToken = await loginStudent();

    const startAttemptRes = await request(app)
      .post(`/api/student/quizzes/${quizId}/start`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(startAttemptRes.statusCode).toBe(201);
    expect(startAttemptRes.body).toHaveProperty('success', true);

    const attemptId = startAttemptRes.body?.data?.attempt?.id;
    expect(attemptId).toBeTruthy();

    const submitRes = await request(app)
      .post(`/api/student/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: { [questionId]: '2' } });

    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.body).toHaveProperty('success', true);
    expect(submitRes.body?.data?.attempt).toHaveProperty('passed');
  });
});
