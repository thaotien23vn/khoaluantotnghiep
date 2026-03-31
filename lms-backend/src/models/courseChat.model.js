const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CourseChat = sequelize.define('CourseChat', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    courseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'course_id',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Course Discussion',
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
    isEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_enabled',
    },
    mutedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'muted_until',
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
    deletedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'deleted_by',
    },
  }, {
    tableName: 'course_chats',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['course_id'], unique: true },
    ],
  });

  CourseChat.associate = (models) => {
    CourseChat.belongsTo(models.Course, {
      foreignKey: {
        name: 'courseId',
        allowNull: false,
        onDelete: 'CASCADE',
      },
      as: 'course',
    });
    CourseChat.hasMany(models.CourseMessage, {
      foreignKey: {
        name: 'chatId',
        onDelete: 'CASCADE',
      },
      as: 'messages',
    });
    CourseChat.hasMany(models.CourseChatParticipant, {
      foreignKey: {
        name: 'chatId',
        onDelete: 'CASCADE',
      },
      as: 'participants',
    });
  };

  return CourseChat;
};
