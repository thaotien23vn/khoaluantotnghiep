const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Enrollment = sequelize.define('Enrollment', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'enrolled',
    },
    progressPercent: {
      type: DataTypes.DECIMAL(5,2),
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
  });

  return Enrollment;
};
