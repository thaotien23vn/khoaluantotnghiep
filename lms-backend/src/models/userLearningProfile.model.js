const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserLearningProfile = sequelize.define('UserLearningProfile', {
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
    learningStyle: {
      type: DataTypes.ENUM('visual', 'auditory', 'kinesthetic', 'reading'),
      allowNull: true,
      field: 'learning_style',
    },
    difficultyPreference: {
      type: DataTypes.ENUM('beginner', 'intermediate', 'advanced', 'adaptive'),
      allowNull: false,
      defaultValue: 'adaptive',
      field: 'difficulty_preference',
    },
    averageScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'average_score',
    },
    totalStudyTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_study_time',
    },
    completedLectures: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'completed_lectures',
    },
    totalLectures: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_lectures',
    },
    lastActivityAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_activity_at',
    },
    preferredStudyTime: {
      type: DataTypes.ENUM('morning', 'afternoon', 'evening', 'night'),
      allowNull: true,
      field: 'preferred_study_time',
    },
    weakTopics: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'weak_topics',
    },
    strongTopics: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'strong_topics',
    },
    goals: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    preferences: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    tableName: 'user_learning_profiles',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'course_id'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['course_id'],
      },
    ],
  });

  return UserLearningProfile;
};
