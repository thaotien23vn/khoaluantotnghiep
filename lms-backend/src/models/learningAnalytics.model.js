const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LearningAnalytics = sequelize.define('LearningAnalytics', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    courseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'course_id',
    },
    lectureId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'lecture_id',
    },
    chapterId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'chapter_id',
    },
    eventType: {
      type: DataTypes.ENUM('lecture_start', 'lecture_complete', 'quiz_start', 'quiz_complete', 'assignment_submit', 'ai_interaction', 'study_session', 'break'),
      allowNull: false,
      field: 'event_type',
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    maxScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'max_score',
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    difficulty: {
      type: DataTypes.ENUM('easy', 'medium', 'hard'),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    deviceType: {
      type: DataTypes.ENUM('desktop', 'mobile', 'tablet'),
      allowNull: true,
      field: 'device_type',
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'session_id',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  }, {
    tableName: 'learning_analytics',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['course_id'],
      },
      {
        fields: ['lecture_id'],
      },
      {
        fields: ['chapter_id'],
      },
      {
        fields: ['event_type'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['session_id'],
      },
    ],
  });

  return LearningAnalytics;
};
