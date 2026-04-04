const { Sequelize } = require('sequelize');

// Determine database dialect based on environment
const isTest = process.env.NODE_ENV === 'test';
const isPostgres = process.env.DB_DIALECT === 'postgres' || 
                   process.env.DATABASE_URL ||
                   (process.env.DB_HOST && process.env.DB_HOST.includes('.render.com')) ||
                   (process.env.DB_HOST && process.env.DB_HOST.startsWith('dpg-')) ||
                   (process.env.DB_HOST && process.env.DB_HOST.includes('.neon.tech'));

const isNeon = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech');

let sequelize;

if (isTest) {
  sequelize = new Sequelize('sqlite::memory:', {
    logging: false,
    define: {
      timestamps: true
    }
  });
} else if (isNeon && process.env.DATABASE_URL) {
  // Neon PostgreSQL with connection string
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else if (isPostgres) {
  // Standard PostgreSQL
  sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  });
} else {
  // MySQL
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      dialect: 'mysql',
      logging: false,
    }
  );
}

// ----- models setup -----
const models = {};
[
  'user',
  'course',
  'category',
  'chapter',
  'lecture',
  'forumTopic',
  'forumPost',
  'forumReport',
  'aiSetting',
  'aiRolePolicy',
  'aiPromptTemplate',
  'aiDocument',
  'aiChunk',
  'aiConversation',
  'aiMessage',
  'aiAuditLog',
  'enrollment',
  'payment',
  'cart',
  'quiz',
  'question',
  'attempt',
  'review',
  'notification',
  'scheduleEvent',
  'lectureProgress',
  'userLearningProfile',
  'aiRecommendation',
  'learningAnalytics',
  'contentQualityScore',
  'placementSession',
  'placementQuestion',
  'placementResponse',
  'placementQuestionBank',
  'lessonChat',
  'lessonMessage',
  'chatParticipant',
  'chatEscalation',
  'chatPermission',
  'chatAnalytics',
  'courseChat',
  'courseMessage',
  'courseChatParticipant',
  'courseChatEscalation',
  'courseChatAnalytics',
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
  ForumTopic,
  ForumPost,
  ForumReport,
  AiSetting,
  AiRolePolicy,
  AiPromptTemplate,
  AiDocument,
  AiChunk,
  AiConversation,
  AiMessage,
  AiAuditLog,
  Enrollment,
  Payment,
  Cart,
  Quiz,
  Question,
  Attempt,
  Review,
  Notification,
  ScheduleEvent,
  LectureProgress,
  UserLearningProfile,
  AiRecommendation,
  LearningAnalytics,
  ContentQualityScore,
  PlacementSession,
  PlacementQuestion,
  PlacementResponse,
  PlacementQuestionBank,
  LessonChat,
  LessonMessage,
  ChatParticipant,
  ChatEscalation,
  ChatPermission,
  ChatAnalytics,
  CourseChat,
  CourseMessage,
  CourseChatParticipant,
  CourseChatEscalation,
  CourseChatAnalytics,
} = models;

User.hasMany(Course, { foreignKey: 'createdBy', as: 'createdCourses' });
Course.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Category.hasMany(Course, { foreignKey: 'categoryId' });
Course.belongsTo(Category, { foreignKey: 'categoryId' });

Course.hasMany(Chapter, { foreignKey: 'courseId' });
Chapter.belongsTo(Course, { foreignKey: 'courseId' });
Chapter.hasMany(Lecture, { foreignKey: 'chapterId', as: 'lectures' });
Lecture.belongsTo(Chapter, { foreignKey: 'chapterId', as: 'chapter' });
Chapter.hasMany(Quiz, { foreignKey: 'chapterId', as: 'quizzes' });
Quiz.belongsTo(Chapter, { foreignKey: 'chapterId', as: 'quizChapter' });

User.hasMany(AiConversation, { foreignKey: 'userId', as: 'aiConversations' });
AiConversation.belongsTo(User, { foreignKey: 'userId', as: 'user' });
AiConversation.hasMany(AiMessage, { foreignKey: 'conversationId', as: 'messages' });
AiMessage.belongsTo(AiConversation, { foreignKey: 'conversationId', as: 'conversation' });

Course.hasMany(AiConversation, { foreignKey: 'courseId', as: 'aiConversations' });
AiConversation.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

Lecture.hasMany(AiConversation, { foreignKey: 'lectureId', as: 'aiConversations' });
AiConversation.belongsTo(Lecture, { foreignKey: 'lectureId', as: 'lecture' });

// Forum Associations
User.hasMany(ForumTopic, { foreignKey: 'userId', as: 'forumTopics' });
ForumTopic.belongsTo(User, { foreignKey: 'userId', as: 'author' });

ForumTopic.hasMany(ForumPost, { foreignKey: 'topicId', as: 'posts' });
ForumPost.belongsTo(ForumTopic, { foreignKey: 'topicId', as: 'topic' });

User.hasMany(ForumPost, { foreignKey: 'userId', as: 'forumPosts' });
ForumPost.belongsTo(User, { foreignKey: 'userId', as: 'author' });

ForumPost.hasMany(ForumPost, { foreignKey: 'parentId', as: 'replies' });
ForumPost.belongsTo(ForumPost, { foreignKey: 'parentId', as: 'parent' });

User.hasMany(ForumReport, { foreignKey: 'reporterId', as: 'forumReports' });
ForumReport.belongsTo(User, { foreignKey: 'reporterId', as: 'reporter' });

ForumTopic.hasMany(ForumReport, { foreignKey: 'topicId', as: 'reports' });
ForumReport.belongsTo(ForumTopic, { foreignKey: 'topicId', as: 'topic' });

ForumPost.hasMany(ForumReport, { foreignKey: 'postId', as: 'reports' });
ForumReport.belongsTo(ForumPost, { foreignKey: 'postId', as: 'post' });

// Course associations for forum
Course.hasMany(ForumTopic, { foreignKey: 'courseId', as: 'forumTopics' });
ForumTopic.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

// Lecture associations for forum
Lecture.hasMany(ForumTopic, { foreignKey: 'lectureId', as: 'forumTopics' });
ForumTopic.belongsTo(Lecture, { foreignKey: 'lectureId', as: 'lecture' });

AiDocument.hasMany(AiChunk, { foreignKey: 'documentId', as: 'chunks' });
AiChunk.belongsTo(AiDocument, { foreignKey: 'documentId', as: 'document' });

// AiChunk associations for unified knowledge base
Course.hasMany(AiChunk, { foreignKey: 'courseId', as: 'aiChunks' });
AiChunk.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

User.hasMany(AiPromptTemplate, { foreignKey: 'createdByAdminId', as: 'aiPromptTemplates' });
AiPromptTemplate.belongsTo(User, { foreignKey: 'createdByAdminId', as: 'createdByAdmin' });

User.hasMany(AiAuditLog, { foreignKey: 'userId', as: 'aiAuditLogs' });
AiAuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Enrollment, { foreignKey: 'userId' });
Enrollment.belongsTo(User, { foreignKey: 'userId' });
Course.hasMany(Enrollment, { foreignKey: 'courseId' });
Enrollment.belongsTo(Course, { foreignKey: 'courseId' });

// LectureProgress associations
User.hasMany(LectureProgress, { foreignKey: 'userId' });
LectureProgress.belongsTo(User, { foreignKey: 'userId' });
Lecture.hasMany(LectureProgress, { foreignKey: 'lectureId' });
LectureProgress.belongsTo(Lecture, { foreignKey: 'lectureId' });
Course.hasMany(LectureProgress, { foreignKey: 'courseId' });
LectureProgress.belongsTo(Course, { foreignKey: 'courseId' });

Course.hasMany(ScheduleEvent, { foreignKey: 'courseId', as: 'scheduleEvents' });
ScheduleEvent.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

Enrollment.hasOne(Payment, { foreignKey: 'enrollmentId' });
Payment.belongsTo(Enrollment, { foreignKey: 'enrollmentId' });
User.hasMany(Payment, { foreignKey: 'userId' });
Course.hasMany(Payment, { foreignKey: 'courseId' });

// Quiz/Question/Attempt/Review/Notification/Payment/Cart models define associations with aliases.
// Wire them up here so controller `include: { as: ... }` works reliably.
for (const model of [Payment, Review, Notification, Quiz, Question, Attempt, Cart]) {
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

// AI Enhancement Models Associations
User.hasMany(UserLearningProfile, { foreignKey: 'userId', as: 'learningProfiles' });
UserLearningProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Course.hasMany(UserLearningProfile, { foreignKey: 'courseId', as: 'userProfiles' });
UserLearningProfile.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

User.hasMany(AiRecommendation, { foreignKey: 'userId', as: 'aiRecommendations' });
AiRecommendation.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Course.hasMany(AiRecommendation, { foreignKey: 'courseId', as: 'aiRecommendations' });
AiRecommendation.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

User.hasMany(LearningAnalytics, { foreignKey: 'userId', as: 'learningAnalytics' });
LearningAnalytics.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Course.hasMany(LearningAnalytics, { foreignKey: 'courseId', as: 'learningAnalytics' });
LearningAnalytics.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

Lecture.hasMany(LearningAnalytics, { foreignKey: 'lectureId', as: 'learningEvents' });
LearningAnalytics.belongsTo(Lecture, { foreignKey: 'lectureId', as: 'lecture' });

// Placement Test Associations
User.hasMany(PlacementSession, { foreignKey: 'userId', as: 'placementSessions' });
PlacementSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });

PlacementSession.hasMany(PlacementQuestion, { foreignKey: 'sessionId', as: 'questions' });
PlacementQuestion.belongsTo(PlacementSession, { foreignKey: 'sessionId', as: 'session' });

PlacementSession.hasMany(PlacementResponse, { foreignKey: 'sessionId', as: 'responses' });
PlacementResponse.belongsTo(PlacementSession, { foreignKey: 'sessionId', as: 'session' });

PlacementQuestion.hasMany(PlacementResponse, { foreignKey: 'questionId', as: 'responses' });
PlacementResponse.belongsTo(PlacementQuestion, { foreignKey: 'questionId', as: 'question' });

// Lesson Chat Associations
for (const model of [LessonChat, LessonMessage, ChatParticipant, ChatEscalation, ChatAnalytics]) {
  if (model && typeof model.associate === 'function') {
    model.associate(models);
  }
}

// Course Chat Associations
for (const model of [CourseChat, CourseMessage, CourseChatParticipant, CourseChatEscalation, CourseChatAnalytics]) {
  if (model && typeof model.associate === 'function') {
    model.associate(models);
  }
}

// ChatPermission Associations
User.hasMany(ChatPermission, { foreignKey: 'userId', as: 'chatPermissions' });
ChatPermission.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Course.hasMany(ChatPermission, { foreignKey: 'courseId', as: 'chatPermissions' });
ChatPermission.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

Lecture.hasMany(ChatPermission, { foreignKey: 'lectureId', as: 'chatPermissions' });
ChatPermission.belongsTo(Lecture, { foreignKey: 'lectureId', as: 'lecture' });

const connectDB = async () => {
  await sequelize.authenticate();
  console.log('✅ Database connected');
  
  // Sync database for testing
  if (process.env.NODE_ENV === 'test') {
    await sequelize.sync({ force: true });
    console.log('✅ Test database synced');
  }
};

module.exports = { sequelize, connectDB, models };
