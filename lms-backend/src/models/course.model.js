const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Course = sequelize.define('Course', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
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
    },
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    level: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Mọi cấp độ',
    },
    price: {
      type: DataTypes.DECIMAL(10,2),
      defaultValue: 0.0,
    },
    published: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Thêm các field để khớp với frontend
    rating: {
      type: DataTypes.DECIMAL(3,2),
      defaultValue: 0.0,
    },
    reviewCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: 0,
    },
    students: {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: 0,
    },
    totalLessons: {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: 0,
    },
    duration: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    willLearn: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    requirements: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    lastUpdated: {
      type: DataTypes.DATE,
      field: 'updated_at',
    },
  }, {
    tableName: 'courses',
  });

  return Course;
};
