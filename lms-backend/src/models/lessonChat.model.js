const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LessonChat = sequelize.define('LessonChat', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    lessonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'lesson_id',
    },
    courseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'course_id',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
    aiEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'ai_enabled',
    },
  }, {
    tableName: 'lesson_chats',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['lesson_id'], unique: true },
      { fields: ['course_id'] },
    ],
  });

  LessonChat.associate = (models) => {
    LessonChat.belongsTo(models.Lecture, {
      foreignKey: {
        name: 'lessonId',
        allowNull: false,
        onDelete: 'CASCADE',
      },
      as: 'lesson',
    });
    LessonChat.belongsTo(models.Course, {
      foreignKey: {
        name: 'courseId',
        allowNull: false,
        onDelete: 'CASCADE',
      },
      as: 'course',
    });
    LessonChat.hasMany(models.LessonMessage, {
      foreignKey: {
        name: 'chatId',
        onDelete: 'CASCADE',
      },
      as: 'messages',
    });
    LessonChat.hasMany(models.ChatParticipant, {
      foreignKey: {
        name: 'chatId',
        onDelete: 'CASCADE',
      },
      as: 'participants',
    });
  };

  return LessonChat;
};
