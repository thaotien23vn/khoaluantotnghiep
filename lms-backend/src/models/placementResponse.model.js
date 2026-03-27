const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const PlacementResponse = sequelize.define(
    "PlacementResponse",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      sessionId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "session_id",
      },
      questionId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "question_id",
      },
      answer: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isCorrect: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        field: "is_correct",
      },
      timeSpentSeconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "time_spent_seconds",
      },
      answeredAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "answered_at",
      },
    },
    {
      tableName: "placement_responses",
      timestamps: false,
    }
  );

  return PlacementResponse;
};
