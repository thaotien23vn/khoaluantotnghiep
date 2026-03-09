const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AiRolePolicy = sequelize.define('AiRolePolicy', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    dailyLimit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50,
      field: 'daily_limit',
    },
    maxOutputTokens: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1024,
      field: 'max_output_tokens',
    },
    ragTopK: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      field: 'rag_top_k',
    },
  }, {
    tableName: 'ai_role_policies',
  });

  return AiRolePolicy;
};
