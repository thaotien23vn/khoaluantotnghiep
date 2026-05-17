const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LearningPath = sequelize.define(
    'LearningPath',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      categoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'category_id',
        references: {
          model: 'categories',
          key: 'id',
        },
        comment: 'Optional: if this path maps to a single CEFR category',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      tableName: 'learning_paths',
      timestamps: true,
    }
  );

  return LearningPath;
};
