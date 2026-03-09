const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AiAuditLog = sequelize.define('AiAuditLog', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'user_id',
    },
    role: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    endpoint: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    model: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ok',
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    inputTokens: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'input_tokens',
    },
    outputTokens: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'output_tokens',
    },
    cost: {
      type: DataTypes.DECIMAL(12, 6),
      allowNull: true,
    },
    courseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'course_id',
    },
    lectureId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'lecture_id',
    },
  }, {
    tableName: 'ai_audit_logs',
  });

  return AiAuditLog;
};
