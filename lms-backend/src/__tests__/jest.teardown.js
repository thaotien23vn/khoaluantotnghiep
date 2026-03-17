const bcrypt = require('bcryptjs');
const db = require('../models');

const TEST_PREFIX = 'it_seed_';

async function ensureUser({
  email,
  username,
  name,
  password,
  role,
  isEmailVerified = true,
}) {
  const { User } = db.models;
  
  // For SQLite, we need to handle table creation
  try {
    const existing = await User.findOne({ where: { email } });
    if (existing) return existing;
  } catch (error) {
    // Table might not exist yet, try to sync
    if (error.message.includes('no such table') || error.message.includes('SQLITE_ERROR: no such table')) {
      await db.sequelize.sync();
    } else {
      throw error;
    }
  }
  
  const existing = await User.findOne({ where: { email } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(password, 10);
  return User.create({
    name,
    email,
    username,
    passwordHash,
    role,
    isEmailVerified,
    isActive: true,
  });
}

async function seedCore() {
  // Ensure all tables are created first
  await db.sequelize.sync();
  
  const { Category, Course, Enrollment, Review, Notification, ScheduleEvent } = db.models;

  const teacher = await ensureUser({
    email: `${TEST_PREFIX}teacher@example.com`,
    username: `${TEST_PREFIX}teacher`,
    name: 'IT Seed Teacher',
    password: '123456',
    role: 'teacher',
  });

  const student = await ensureUser({
    email: `${TEST_PREFIX}student@example.com`,
    username: `${TEST_PREFIX}student`,
    name: 'IT Seed Student',
    password: '123456',
    role: 'student',
  });

  let category = await Category.findOne({ where: { name: `${TEST_PREFIX}Category` } });
  if (!category) {
    category = await Category.create({ name: `${TEST_PREFIX}Category`, menuSection: null });
  }

  let course = await Course.findOne({ where: { slug: `${TEST_PREFIX}course` } });
  if (!course) {
    course = await Course.create({
      title: 'IT Seed Course',
      slug: `${TEST_PREFIX}course`,
      description: 'seed',
      imageUrl: null,
      level: 'Mọi cấp độ',
      price: 0,
      published: true,
      rating: 0,
      reviewCount: 0,
      students: 0,
      totalLessons: 0,
      duration: null,
      willLearn: [],
      requirements: [],
      tags: [],
      categoryId: category.id,
      createdBy: teacher.id,
    });
  }

  let paidCourse = await Course.findOne({ where: { slug: `${TEST_PREFIX}paid-course` } });
  if (!paidCourse) {
    paidCourse = await Course.create({
      title: 'IT Seed Paid Course',
      slug: `${TEST_PREFIX}paid-course`,
      description: 'seed paid',
      imageUrl: null,
      level: 'Mọi cấp độ',
      price: 10,
      published: true,
      rating: 0,
      reviewCount: 0,
      students: 0,
      totalLessons: 0,
      duration: null,
      willLearn: [],
      requirements: [],
      tags: [],
      categoryId: category.id,
      createdBy: teacher.id,
    });
  }

  const existingEnrollment = await Enrollment.findOne({
    where: { userId: student.id, courseId: course.id },
  });
  const enrollment = existingEnrollment
    ? existingEnrollment
    : await Enrollment.create({
        userId: student.id,
        courseId: course.id,
        status: 'enrolled',
        progressPercent: 0,
      });

  const existingReview = await Review.findOne({
    where: { userId: student.id, courseId: course.id },
  });
  const review = existingReview
    ? existingReview
    : await Review.create({
        userId: student.id,
        courseId: course.id,
        rating: 5,
        comment: 'Đây là review seed để chạy integration tests.',
      });

  let scheduleEvent = await ScheduleEvent.findOne({ where: { courseId: course.id, title: `${TEST_PREFIX}event` } });
  if (!scheduleEvent) {
    const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
    scheduleEvent = await ScheduleEvent.create({
      courseId: course.id,
      title: `${TEST_PREFIX}event`,
      type: 'lesson',
      startAt,
      endAt,
      status: 'upcoming',
      description: 'seed',
      zoomLink: null,
      location: null,
    });
  }

  let notification = await Notification.findOne({ where: { userId: student.id, title: `${TEST_PREFIX}notification` } });
  if (!notification) {
    notification = await Notification.create({
      userId: student.id,
      type: 'announcement',
      title: `${TEST_PREFIX}notification`,
      message: 'seed',
      payload: { test: true },
      read: false,
    });
  }

  return { teacher, student, category, course, paidCourse, enrollment, review, scheduleEvent, notification };
}

async function cleanupCore() {
  const { Review, Enrollment, Course, Category, User, Notification, ScheduleEvent } = db.models;

  const teacher = await User.findOne({ where: { email: `${TEST_PREFIX}teacher@example.com` } });
  const student = await User.findOne({ where: { email: `${TEST_PREFIX}student@example.com` } });
  const course = await Course.findOne({ where: { slug: `${TEST_PREFIX}course` } });
  const paidCourse = await Course.findOne({ where: { slug: `${TEST_PREFIX}paid-course` } });
  const category = await Category.findOne({ where: { name: `${TEST_PREFIX}Category` } });

  if (course && student) {
    await Review.destroy({ where: { courseId: course.id, userId: student.id } });
    await Enrollment.destroy({ where: { courseId: course.id, userId: student.id } });
    await Notification.destroy({ where: { userId: student.id, title: `${TEST_PREFIX}notification` } });
    await ScheduleEvent.destroy({ where: { courseId: course.id, title: `${TEST_PREFIX}event` } });
  }
  if (course) {
    await Course.destroy({ where: { id: course.id } });
  }
  if (paidCourse) {
    await Course.destroy({ where: { id: paidCourse.id } });
  }
  if (category) {
    await Category.destroy({ where: { id: category.id } });
  }
  if (teacher) await User.destroy({ where: { id: teacher.id } });
  if (student) await User.destroy({ where: { id: student.id } });
}

afterAll(async () => {
  try {
    if (process.env.TEST_CLEANUP === '1') {
      await cleanupCore();
    }
  } catch (e) {
    // ignore
  }
  try {
    if (db?.sequelize?.close) {
      await db.sequelize.close();
    }
  } catch (e) {
    // ignore
  }
});

module.exports = {
  seedCore,
  cleanupCore,
  TEST_PREFIX,
};
