const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PathCourse = sequelize.define(
    'PathCourse',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
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
      courseId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'course_id',
        references: {
          model: 'courses',
          key: 'id',
        },
      },
      orderIndex: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        field: 'order_index',
      },
      isRequired: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_required',
        comment: 'If true, must complete to finish the level',
      },
    },
    {
      tableName: 'path_courses',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['path_id', 'course_id'],
        },
      ],
    }
  );

  return PathCourse;
};
