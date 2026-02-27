const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Question = sequelize.define('Question', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    type: {
      type: DataTypes.STRING,
    },
    content: {
      type: DataTypes.TEXT,
    },
    options: {
      type: DataTypes.JSON,
    },
    correctAnswer: {
      type: DataTypes.JSON,
      field: 'correct_answer',
    },
    points: {
      type: DataTypes.INTEGER,
    },
  }, {
    tableName: 'questions',
  });

  return Question;
};
