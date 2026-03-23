const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LectureProgress = sequelize.define('LectureProgress', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    lectureId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'lecture_id',
    },
    courseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'course_id',
    },
    watchedPercent: {
      type: DataTypes.DECIMAL(5, 2),
      field: 'watched_percent',
      defaultValue: 0.0,
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      field: 'is_completed',
      defaultValue: false,
    },
    lastAccessedAt: {
      type: DataTypes.DATE,
      field: 'last_accessed_at',
      defaultValue: DataTypes.NOW,
    },
    completedAt: {
      type: DataTypes.DATE,
      field: 'completed_at',
      allowNull: true,
    },
  }, {
    tableName: 'lecture_progress',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'lecture_id'],
      },
    ],
  });

  return LectureProgress;
};
