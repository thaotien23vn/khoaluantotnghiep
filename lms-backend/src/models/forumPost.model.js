const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ForumPost = sequelize.define('ForumPost', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    topicId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'topic_id',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    parentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'parent_id',
    },
    isSolution: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_solution',
    },
    likes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'forum_posts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['topic_id', 'created_at'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['parent_id'],
      },
    ],
  });

  return ForumPost;
};
