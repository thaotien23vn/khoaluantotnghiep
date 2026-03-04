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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    maxScore: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
      field: 'max_score',
    },
    timeLimit: {
      type: DataTypes.INTEGER,
      defaultValue: 60, // minutes
      field: 'time_limit',
    },
    passingScore: {
      type: DataTypes.INTEGER,
      defaultValue: 60,
      field: 'passing_score',
    },
    courseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'course_id',
    },
    createdBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'created_by',
    },
  }, {
    tableName: 'quizzes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  Quiz.associate = (models) => {
    Quiz.belongsTo(models.Course, {
      foreignKey: 'courseId',
      as: 'course',
    });
    
    Quiz.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'creator',
    });
    
    Quiz.hasMany(models.Question, {
      foreignKey: 'quizId',
      as: 'questions',
    });
    
    Quiz.hasMany(models.Attempt, {
      foreignKey: 'quizId',
      as: 'attempts',
    });
  };

  return Quiz;
};
