const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CourseChatEscalation = sequelize.define('CourseChatEscalation', {
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
      type: DataTypes.ENUM('ai_failed', 'notified_teacher', 'notified_admin', 'answered'),
      defaultValue: 'ai_failed',
    },
    aiConfidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'ai_confidence',
    },
    escalationReason: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'escalation_reason',
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
  }, {
    tableName: 'course_chat_escalations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['chat_id'] },
      { fields: ['message_id'] },
      { fields: ['status'] },
    ],
  });

  CourseChatEscalation.associate = (models) => {
    CourseChatEscalation.belongsTo(models.CourseChat, {
      foreignKey: {
        name: 'chatId',
        allowNull: false,
        onDelete: 'CASCADE',
      },
      as: 'chat',
    });
    CourseChatEscalation.belongsTo(models.CourseMessage, {
      foreignKey: {
        name: 'messageId',
        allowNull: false,
        onDelete: 'CASCADE',
      },
      as: 'message',
    });
  };

  return CourseChatEscalation;
};
