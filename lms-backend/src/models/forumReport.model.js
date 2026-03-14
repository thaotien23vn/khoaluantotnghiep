const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ForumReport = sequelize.define('ForumReport', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    topicId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'topic_id',
    },
    postId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'post_id',
    },
    reporterId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'reporter_id',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'resolved', 'dismissed'),
      allowNull: false,
      defaultValue: 'pending',
    },
  }, {
    tableName: 'forum_reports',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['status', 'created_at'],
      },
      {
        fields: ['reporter_id'],
      },
      {
        fields: ['topic_id'],
      },
      {
        fields: ['post_id'],
      },
    ],
  });

  return ForumReport;
};
