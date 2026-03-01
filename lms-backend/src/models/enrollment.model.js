const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Enrollment = sequelize.define('Enrollment', {
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
    courseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'course_id',
    },
    status: {
      type: DataTypes.STRING(32),
      defaultValue: 'enrolled',
    },
    progressPercent: {
      type: DataTypes.DECIMAL(5, 2),
      field: 'progress_percent',
      defaultValue: 0.0,
    },
    enrolledAt: {
      type: DataTypes.DATE,
      field: 'enrolled_at',
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'enrollments',
    timestamps: false,
    // Optional: add unique index in DB manually: UNIQUE (user_id, course_id)
  });

  return Enrollment;
};
