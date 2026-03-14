const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ForumTopic = sequelize.define('ForumTopic', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('global', 'course', 'lecture'),
      allowNull: false,
      defaultValue: 'global',
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
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    views: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    postCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'post_count',
    },
    isPinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_pinned',
    },
    isLocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_locked',
    },
  }, {
    tableName: 'forum_topics',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['type', 'created_at'],
      },
      {
        fields: ['course_id'],
      },
      {
        fields: ['lecture_id'],
      },
      {
        fields: ['user_id'],
      },
    ],
  });

  return ForumTopic;
};
