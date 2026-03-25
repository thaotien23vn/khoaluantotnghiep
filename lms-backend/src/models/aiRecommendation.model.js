const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AiRecommendation = sequelize.define('AiRecommendation', {
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
      allowNull: true,
      field: 'course_id',
    },
    type: {
      type: DataTypes.ENUM('lecture', 'quiz', 'exercise', 'study_path', 'review', 'remediation'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    targetId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'target_id',
    },
    targetType: {
      type: DataTypes.ENUM('lecture', 'chapter', 'quiz', 'course'),
      allowNull: true,
      field: 'target_type',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium',
    },
    score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'viewed', 'accepted', 'rejected', 'completed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  }, {
    tableName: 'ai_recommendations',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['course_id'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['priority'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['expires_at'],
      },
    ],
  });

  return AiRecommendation;
};
