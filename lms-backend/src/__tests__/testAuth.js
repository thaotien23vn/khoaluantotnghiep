const request = require('supertest');
const app = require('../app');

const TEST_ACCOUNTS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'adminThai@gmail.com',
    password: process.env.TEST_ADMIN_PASSWORD || '123456',
  },
  teacher: {
    email: process.env.TEST_TEACHER_EMAIL || 'a@example.com',
    password: process.env.TEST_TEACHER_PASSWORD || 'password123',
  },
  student: {
    email: process.env.TEST_STUDENT_EMAIL || 'ngocthaiuser1@gmail.com',
    password: process.env.TEST_STUDENT_PASSWORD || '123456',
  },
};

async function loginByRole(role) {
  const account = TEST_ACCOUNTS[role];
  if (!account) throw new Error(`Unknown role: ${role}`);

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: account.email, password: account.password });

  if (![200, 201].includes(res.statusCode) || !res.body?.success) {
    throw new Error(`Login failed for role=${role} status=${res.statusCode} body=${JSON.stringify(res.body)}`);
  }

  const token = res.body?.data?.token;
  if (typeof token !== 'string') {
    throw new Error(`Missing token for role=${role} body=${JSON.stringify(res.body)}`);
  }

  return token;
}

module.exports = {
  loginByRole,
  TEST_ACCOUNTS,
};
