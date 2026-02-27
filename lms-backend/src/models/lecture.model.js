const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Lecture = sequelize.define('Lecture', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    contentUrl: {
      type: DataTypes.STRING,
      field: 'content_url',
    },
    duration: {
      type: DataTypes.INTEGER,
      comment: 'Duration in seconds',
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'lectures',
  });

  return Lecture;
};
