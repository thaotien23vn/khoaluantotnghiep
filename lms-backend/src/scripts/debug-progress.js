const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { sequelize, connectDB, models } = require('../models');

async function main() {
  await connectDB();
  const { Enrollment, LectureProgress, Quiz, Lecture, Attempt } = models;

  const courseId = 28;
  const userId = 96; // demo.student.final@lms.com

  const enrollment = await Enrollment.findOne({ where: { userId, courseId } });
  console.log('Enrollment:', enrollment ? {
    progressPercent: enrollment.progressPercent,
    enrollmentStatus: enrollment.enrollmentStatus,
    status: enrollment.status,
  } : 'NOT FOUND');

  const lp = await LectureProgress.findOne({ where: { userId, courseId } });
  console.log('LectureProgress:', lp ? {
    isCompleted: lp.isCompleted,
    watchedPercent: lp.watchedPercent,
    watchTime: lp.watchTime,
    completedAt: lp.completedAt,
  } : 'NOT FOUND');

  const lectures = await Lecture.count({ where: { courseId } });
  const quizzes = await Quiz.count({ where: { courseId, status: 'published' } });
  const attempts = await Attempt.count({ where: { userId, courseId } });
  console.log(`Lectures: ${lectures}, Quizzes: ${quizzes}, Attempts: ${attempts}`);

  await sequelize.close();
  process.exit(0);
}
main().catch(console.error);
