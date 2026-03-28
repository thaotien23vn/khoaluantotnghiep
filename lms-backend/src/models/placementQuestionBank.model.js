const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const PlacementQuestionBank = sequelize.define(
    "PlacementQuestionBank",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
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
        type: DataTypes.ENUM("multiple_choice", "fill_blank", "matching", "listening", "sentence_ordering", "true_false"),
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
      usageCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: "usage_count",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: "is_active",
      },
      // Các trường mới cho quiz thường
      sourceType: {
        type: DataTypes.ENUM("placement", "quiz"),
        defaultValue: "placement",
        field: "source_type",
      },
      courseId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "course_id",
      },
      lectureId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "lecture_id",
      },
    },
    {
      tableName: "placement_question_bank",
      timestamps: true,
      updatedAt: "updated_at",
      createdAt: "created_at",
    }
  );

  return PlacementQuestionBank;
};
