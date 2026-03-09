const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AiChunk = sequelize.define('AiChunk', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    documentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'document_id',
    },
    courseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'course_id',
    },
    chapterId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'chapter_id',
    },
    lectureId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'lecture_id',
    },
    chunkIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'chunk_index',
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    embeddingJson: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'embedding_json',
    },
    tokenCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'token_count',
    },
  }, {
    tableName: 'ai_chunks',
  });

  return AiChunk;
};
