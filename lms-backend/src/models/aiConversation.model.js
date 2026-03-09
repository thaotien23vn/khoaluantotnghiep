const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AiConversation = sequelize.define('AiConversation', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    courseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'course_id',
    },
    lectureId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'lecture_id',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'ai_conversations',
  });

  return AiConversation;
};
