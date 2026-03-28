const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChatEscalation = sequelize.define('ChatEscalation', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    messageId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'message_id',
    },
    chatId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'chat_id',
    },
    status: {
      type: DataTypes.ENUM('ai_failed', 'notified_teacher', 'notified_admin', 'answered', 'expired'),
      defaultValue: 'ai_failed',
    },
    aiConfidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    teacherNotifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'teacher_notified_at',
    },
    adminNotifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'admin_notified_at',
    },
    answeredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'answered_at',
    },
    answeredBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'answered_by',
    },
    escalationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'escalation_reason',
    },
  }, {
    tableName: 'chat_escalations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['message_id'] },
      { fields: ['chat_id'] },
      { fields: ['status'] },
    ],
  });

  ChatEscalation.associate = (models) => {
    ChatEscalation.belongsTo(models.LessonMessage, {
      foreignKey: {
        name: 'messageId',
        allowNull: false,
        onDelete: 'CASCADE',
      },
      as: 'message',
    });
    ChatEscalation.belongsTo(models.LessonChat, {
      foreignKey: {
        name: 'chatId',
        allowNull: false,
        onDelete: 'CASCADE',
      },
      as: 'chat',
    });
  };

  return ChatEscalation;
};
