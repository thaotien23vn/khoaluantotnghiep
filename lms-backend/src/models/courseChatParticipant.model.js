const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CourseChatParticipant = sequelize.define('CourseChatParticipant', {
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
    isBanned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_banned',
    },
    bannedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'banned_at',
    },
    bannedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'banned_by',
    },
    banReason: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'ban_reason',
    },
  }, {
    tableName: 'course_chat_participants',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['chat_id'] },
      { fields: ['chat_id', 'user_id'], unique: true },
    ],
  });

  CourseChatParticipant.associate = (models) => {
    CourseChatParticipant.belongsTo(models.CourseChat, {
      foreignKey: {
        name: 'chatId',
        allowNull: false,
        onDelete: 'CASCADE',
      },
      as: 'chat',
    });
    CourseChatParticipant.belongsTo(models.User, {
      foreignKey: {
        name: 'userId',
        allowNull: false,
        onDelete: 'CASCADE',
      },
      as: 'user',
    });
  };

  return CourseChatParticipant;
};
