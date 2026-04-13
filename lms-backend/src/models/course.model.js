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
      type: DataTypes.ENUM('beginner', 'elementary', 'intermediate', 'upper-intermediate', 'advanced', 'proficiency', 'all-levels'),
      allowNull: true,
      defaultValue: 'all-levels',
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id',
      },
    },
    price: {
      type: DataTypes.DECIMAL(10,2),
      defaultValue: 0.0,
    },
    published: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    status: {
      type: DataTypes.ENUM('draft', 'pending_review', 'published', 'rejected'),
      defaultValue: 'draft',
    },
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    aiGenerated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    generationStatus: {
      type: DataTypes.ENUM('draft', 'generating_outline', 'outline_ready', 'generating_content', 'completed', 'failed'),
      defaultValue: 'draft',
    },
    generationConfig: {
      type: DataTypes.JSON,
      allowNull: true,
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
