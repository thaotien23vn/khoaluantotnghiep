const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LessonMessage = sequelize.define('LessonMessage', {
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
    senderId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'sender_id',
    },
    senderType: {
      type: DataTypes.ENUM('student', 'teacher', 'admin', 'ai'),
      allowNull: false,
      field: 'sender_type',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    parentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'parent_id',
    },
    status: {
      type: DataTypes.ENUM('active', 'answered', 'resolved'),
      defaultValue: 'active',
    },
    answeredBy: {
      type: DataTypes.ENUM('ai', 'teacher', 'admin'),
      allowNull: true,
      field: 'answered_by',
    },
    aiConfidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'ai_confidence',
    },
    aiContext: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'ai_context',
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'edited_at',
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_deleted',
    },
  }, {
    tableName: 'lesson_messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['chat_id'] },
      { fields: ['chat_id', 'created_at'] },
      { fields: ['chat_id', 'id'] },
      { fields: ['parent_id'] },
      { fields: ['sender_id'] },
      { fields: ['status'] },
    ],
  });

  LessonMessage.associate = (models) => {
    LessonMessage.belongsTo(models.LessonChat, {
      foreignKey: {
        name: 'chatId',
        allowNull: false,
        onDelete: 'CASCADE',
      },
      as: 'chat',
    });
    LessonMessage.belongsTo(models.User, {
      foreignKey: {
        name: 'senderId',
        allowNull: false,
      },
      as: 'sender',
    });
    LessonMessage.belongsTo(models.LessonMessage, {
      foreignKey: 'parentId',
      as: 'parent',
    });
    LessonMessage.hasMany(models.LessonMessage, {
      foreignKey: 'parentId',
      as: 'replies',
    });
  };

  return LessonMessage;
};
