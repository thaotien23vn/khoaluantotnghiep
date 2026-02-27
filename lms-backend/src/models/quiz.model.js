const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Quiz = sequelize.define('Quiz', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    maxScore: {
      type: DataTypes.INTEGER,
      field: 'max_score',
    },
    timeLimit: {
      type: DataTypes.INTEGER,
      field: 'time_limit',
    },
  }, {
    tableName: 'quizzes',
  });

  return Quiz;
};
