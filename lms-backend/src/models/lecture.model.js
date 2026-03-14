const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Lecture = sequelize.define(
    "Lecture",
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
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      contentUrl: {
        type: DataTypes.STRING,
        field: "content_url",
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      aiNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "ai_notes",
      },
      duration: {
        type: DataTypes.INTEGER,
        comment: "Duration in seconds",
      },
      isPreview: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_preview",
      },
      attachments: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      tableName: "lectures",
    },
  );

  return Lecture;
};
