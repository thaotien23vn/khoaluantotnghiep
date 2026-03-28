const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChatParticipant = sequelize.define('ChatParticipant', {
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
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    role: {
      type: DataTypes.ENUM('student', 'teacher', 'admin'),
      allowNull: false,
    },
    lastReadAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_read_at',
    },
    lastReadMessageId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'last_read_message_id',
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'joined_at',
    },
    leftAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'left_at',
    },
  }, {
    tableName: 'chat_participants',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['chat_id'] },
      { fields: ['chat_id', 'created_at'] },
      { fields: ['chat_id', 'id'] },
    ],
  });

  ChatParticipant.associate = (models) => {
    ChatParticipant.belongsTo(models.LessonChat, {
      foreignKey: {
        name: 'chatId',
        allowNull: false,
        onDelete: 'CASCADE',
      },
      as: 'chat',
    });
    ChatParticipant.belongsTo(models.User, {
      foreignKey: {
        name: 'userId',
        allowNull: false,
        onDelete: 'CASCADE',
      },
      as: 'user',
    });
  };

  return ChatParticipant;
};
