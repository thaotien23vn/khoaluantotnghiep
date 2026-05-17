const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserLearningPath = sequelize.define(
    'UserLearningPath',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      pathId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'path_id',
        references: {
          model: 'learning_paths',
          key: 'id',
        },
      },
      currentLevel: {
        type: DataTypes.ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2'),
        allowNull: true,
        field: 'current_level',
        comment: 'CEFR level assigned after placement test',
      },
      overallProgress: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.0,
        field: 'overall_progress',
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'started_at',
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'completed_at',
      },
      status: {
        type: DataTypes.ENUM('active', 'completed', 'paused'),
        defaultValue: 'active',
      },
    },
    {
      tableName: 'user_learning_paths',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'path_id'],
        },
      ],
    }
  );

  return UserLearningPath;
};
