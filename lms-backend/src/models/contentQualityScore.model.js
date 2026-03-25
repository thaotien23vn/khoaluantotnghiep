const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContentQualityScore = sequelize.define('ContentQualityScore', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    contentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'content_id',
    },
    contentType: {
      type: DataTypes.ENUM('lecture', 'quiz', 'assignment', 'course'),
      allowNull: false,
      field: 'content_type',
    },
    overallScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      field: 'overall_score',
    },
    clarityScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'clarity_score',
    },
    completenessScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'completeness_score',
    },
    engagementScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'engagement_score',
    },
    difficultyScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'difficulty_score',
    },
    technicalAccuracyScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'technical_accuracy_score',
    },
    pedagogicalScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'pedagogical_score',
    },
    studentFeedbackScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'student_feedback_score',
    },
    completionRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'completion_rate',
    },
    averageTimeSpent: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'average_time_spent',
    },
    issues: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    suggestions: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    lastAnalyzedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_analyzed_at',
    },
    analysisVersion: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '1.0',
      field: 'analysis_version',
    },
  }, {
    tableName: 'content_quality_scores',
    indexes: [
      {
        unique: true,
        fields: ['content_id', 'content_type'],
      },
      {
        fields: ['content_type'],
      },
      {
        fields: ['overall_score'],
      },
      {
        fields: ['last_analyzed_at'],
      },
    ],
  });

  return ContentQualityScore;
};
