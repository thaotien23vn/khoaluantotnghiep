const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Question = sequelize.define('Question', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    quizId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'quiz_id',
    },
    type: {
      type: DataTypes.ENUM('multiple_choice', 'true_false', 'short_answer', 'essay'),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    options: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    correctAnswer: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'correct_answer',
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'questions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  Question.associate = (models) => {
    Question.belongsTo(models.Quiz, {
      foreignKey: 'quizId',
      as: 'quiz',
    });
  };

  return Question;
};
