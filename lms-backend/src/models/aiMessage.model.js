const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AiMessage = sequelize.define('AiMessage', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    conversationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'conversation_id',
    },
    sender: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tokenUsage: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'token_usage',
    },
  }, {
    tableName: 'ai_messages',
  });

  return AiMessage;
};
