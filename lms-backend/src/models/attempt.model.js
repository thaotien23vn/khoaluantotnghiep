const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Attempt = sequelize.define('Attempt', {
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
    quizId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'quiz_id',
    },
    answers: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    score: {
      type: DataTypes.DECIMAL(5,2),
      defaultValue: 0,
    },
    percentageScore: {
      type: DataTypes.DECIMAL(5,2),
      defaultValue: 0,
      field: 'percentage_score',
    },
    passed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'started_at',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at',
    },
  }, {
    tableName: 'attempts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  Attempt.associate = (models) => {
    Attempt.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    
    Attempt.belongsTo(models.Quiz, {
      foreignKey: 'quizId',
      as: 'quiz',
    });
  };

  return Attempt;
};
