const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const PlacementSession = sequelize.define(
    "PlacementSession",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "user_id",
        comment: "Null if guest user",
      },
      targetCourseId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "target_course_id",
      },
      selfAssessedLevel: {
        type: DataTypes.ENUM("A1", "A2", "B1", "B2", "C1", "C2", "unknown"),
        defaultValue: "unknown",
        field: "self_assessed_level",
      },
      status: {
        type: DataTypes.ENUM("in_progress", "completed", "abandoned"),
        defaultValue: "in_progress",
      },
      currentCefrLevel: {
        type: DataTypes.ENUM("A1", "A2", "B1", "B2", "C1", "C2"),
        defaultValue: "B1",
        field: "current_cefr_level",
      },
      abilityScore: {
        type: DataTypes.FLOAT,
        defaultValue: 3.0, // Start at B1 level (score 3)
        field: "ability_score",
        comment: "Continuous ability score for adaptive algorithm (1-6 scale)",
      },
      questionCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: "question_count",
      },
      correctCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: "correct_count",
      },
      streakCorrect: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: "streak_correct",
        comment: "Consecutive correct answers for adaptive logic",
      },
      streakWrong: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: "streak_wrong",
        comment: "Consecutive wrong answers for adaptive logic",
      },
      finalCefrLevel: {
        type: DataTypes.ENUM("A1", "A2", "B1", "B2", "C1", "C2"),
        allowNull: true,
        field: "final_cefr_level",
      },
      confidenceScore: {
        type: DataTypes.FLOAT,
        allowNull: true,
        field: "confidence_score",
      },
      startedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "started_at",
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "completed_at",
      },
      lastActivityAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: "last_activity_at",
      },
      isRetake: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "is_retake",
        comment: "Whether this is a retake session",
      },
      previousSessionId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "previous_session_id",
        comment: "Link to previous session if retake",
      },
      retakeCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: "retake_count",
        comment: "Number of times user has retaken",
      },
    },
    {
      tableName: "placement_sessions",
      timestamps: true,
      updatedAt: "updated_at",
      createdAt: "created_at",
    }
  );

  return PlacementSession;
};
