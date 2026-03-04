const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false,
  }
);

// ----- models setup -----
const models = {};
[
  'user',
  'course',
  'category',
  'chapter',
  'lecture',
  'enrollment',
  'payment',
  'quiz',
  'question',
  'attempt',
  'review',
  'notification',
].forEach((name) => {
  models[name.charAt(0).toUpperCase() + name.slice(1)] = require(`./${name}.model`)(sequelize);
});

// setup associations
const {
  User,
  Course,
  Category,
  Chapter,
  Lecture,
  Enrollment,
  Payment,
  Quiz,
  Question,
  Attempt,
  Review,
  Notification,
} = models;

User.hasMany(Course, { foreignKey: 'createdBy', as: 'createdCourses' });
Course.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Category.hasMany(Course, { foreignKey: 'categoryId' });
Course.belongsTo(Category, { foreignKey: 'categoryId' });

Course.hasMany(Chapter, { foreignKey: 'courseId' });
Chapter.belongsTo(Course, { foreignKey: 'courseId' });
Chapter.hasMany(Lecture, { foreignKey: 'chapterId' });
Lecture.belongsTo(Chapter, { foreignKey: 'chapterId' });

User.hasMany(Enrollment, { foreignKey: 'userId' });
Enrollment.belongsTo(User, { foreignKey: 'userId' });
Course.hasMany(Enrollment, { foreignKey: 'courseId' });
Enrollment.belongsTo(Course, { foreignKey: 'courseId' });

Enrollment.hasOne(Payment, { foreignKey: 'enrollmentId' });
Payment.belongsTo(Enrollment, { foreignKey: 'enrollmentId' });
User.hasMany(Payment, { foreignKey: 'userId' });
Course.hasMany(Payment, { foreignKey: 'courseId' });

// Quiz/Question/Attempt/Review/Notification/Payment models define associations with aliases.
// Wire them up here so controller `include: { as: ... }` works reliably.
for (const model of [Payment, Review, Notification, Quiz, Question, Attempt]) {
  if (model && typeof model.associate === 'function') {
    model.associate(models);
  }
}

// Extra "inverse" relations (optional but useful)
User.hasMany(Quiz, { foreignKey: 'createdBy', as: 'createdQuizzes' });
Course.hasMany(Quiz, { foreignKey: 'courseId', as: 'quizzes' });
User.hasMany(Attempt, { foreignKey: 'userId', as: 'attempts' });
User.hasMany(Review, { foreignKey: 'userId', as: 'reviews' });
Course.hasMany(Review, { foreignKey: 'courseId', as: 'reviews' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

const connectDB = async () => {
  await sequelize.authenticate();
  console.log('✅ Database connected');
};

module.exports = { sequelize, connectDB, models };
