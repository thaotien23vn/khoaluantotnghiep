const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Chapter = sequelize.define(
    "Chapter",
    {
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
      order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      tableName: "chapters",
    },
  );

  return Chapter;
};
