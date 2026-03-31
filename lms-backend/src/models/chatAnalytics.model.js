const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChatAnalytics = sequelize.define('ChatAnalytics', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    chatId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'chat_id',
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    totalMessages: {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: 0,
      field: 'total_messages',
    },
    studentMessages: {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: 0,
      field: 'student_messages',
    },
    teacherMessages: {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: 0,
      field: 'teacher_messages',
    },
    adminMessages: {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: 0,
      field: 'admin_messages',
    },
    aiResponses: {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: 0,
      field: 'ai_responses',
    },
    uniqueParticipants: {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: 0,
      field: 'unique_participants',
    },
    escalations: {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: 0,
    },
    resolvedQuestions: {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: 0,
      field: 'resolved_questions',
    },
  }, {
    tableName: 'chat_analytics',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['chat_id', 'date'], unique: true },
      { fields: ['chat_id'] },
      { fields: ['date'] },
    ],
  });

  ChatAnalytics.associate = (models) => {
    ChatAnalytics.belongsTo(models.LessonChat, {
      foreignKey: {
        name: 'chatId',
        allowNull: false,
        onDelete: 'CASCADE',
      },
      as: 'chat',
    });
  };

  return ChatAnalytics;
};
