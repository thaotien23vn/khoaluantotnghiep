const request = require('supertest');
const app = require('../app');
const bcrypt = require('bcryptjs');
const db = require('../models');

const TEST_ACCOUNTS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@gmail.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'Password123@',
  },
  teacher: {
    email: process.env.TEST_TEACHER_EMAIL || 'teacher@gmail.com',
    password: process.env.TEST_TEACHER_PASSWORD || 'Password123@',
  },
  student: {
    email: process.env.TEST_STUDENT_EMAIL || 'student@gmail.com',
    password: process.env.TEST_STUDENT_PASSWORD || 'Password123@',
  },
};

async function ensureTestAccount(role) {
  const account = TEST_ACCOUNTS[role];
  if (!account) throw new Error(`Unknown role: ${role}`);

  const { User } = db.models;
  const existing = await User.findOne({ where: { email: account.email } });

  const passwordHash = await bcrypt.hash(account.password, 10);

  if (existing) {
    if (!existing.isEmailVerified || !existing.isActive || existing.role !== role) {
      await existing.update({
        role,
        isEmailVerified: true,
        isActive: true,
      });
    }

    // Ensure password always matches TEST_ACCOUNTS, since DB may be recreated.
    await existing.update({ passwordHash });
    return;
  }

  await User.create({
    name: `Test ${role}`,
    email: account.email,
    username: `test_${role}_${Date.now()}`,
    passwordHash,
    role,
    isEmailVerified: true,
    isActive: true,
  });
}

async function loginByRole(role) {
  const account = TEST_ACCOUNTS[role];
  if (!account) throw new Error(`Unknown role: ${role}`);

  await ensureTestAccount(role);

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

// Setup test accounts before all tests
beforeAll(async () => {
  try {
    // Ensure database tables exist
    await db.sequelize.sync();
    
    // Create all test accounts
    await Promise.all([
      ensureTestAccount('admin'),
      ensureTestAccount('teacher'),
      ensureTestAccount('student'),
    ]);
  } catch (error) {
    console.error('❌ Failed to setup test accounts:', error.message);
    throw error;
  }
});

module.exports = {
  loginByRole,
  TEST_ACCOUNTS,
};
