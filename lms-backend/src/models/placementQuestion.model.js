const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const PlacementQuestion = sequelize.define(
    "PlacementQuestion",
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
      questionIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "question_index",
      },
      cefrLevel: {
        type: DataTypes.ENUM("A1", "A2", "B1", "B2", "C1", "C2"),
        allowNull: false,
        field: "cefr_level",
      },
      skillType: {
        type: DataTypes.ENUM("grammar", "vocabulary", "reading", "listening"),
        defaultValue: "grammar",
        field: "skill_type",
      },
      questionType: {
        type: DataTypes.ENUM("multiple_choice", "fill_blank", "matching", "listening", "sentence_ordering"),
        defaultValue: "multiple_choice",
        field: "question_type",
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      options: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "Array of options for multiple choice",
      },
      correctAnswer: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: "correct_answer",
      },
      explanation: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      aiGenerated: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "ai_generated",
      },
      aiPrompt: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "ai_prompt",
      },
      aiRawResponse: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "ai_raw_response",
      },
      timeLimitSeconds: {
        type: DataTypes.INTEGER,
        defaultValue: 60,
        field: "time_limit_seconds",
      },
    },
    {
      tableName: "placement_questions",
      timestamps: true,
      updatedAt: "updated_at",
      createdAt: "created_at",
    }
  );

  return PlacementQuestion;
};
