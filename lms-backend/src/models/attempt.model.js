const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Attempt = sequelize.define('Attempt', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    answers: {
      type: DataTypes.JSON,
    },
    score: {
      type: DataTypes.DECIMAL(5,2),
    },
    completedAt: {
      type: DataTypes.DATE,
      field: 'completed_at',
    },
  }, {
    tableName: 'attempts',
    timestamps: false,
  });

  return Attempt;
};
