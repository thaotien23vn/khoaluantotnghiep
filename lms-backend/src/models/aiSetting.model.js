const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AiSetting = sequelize.define('AiSetting', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'gemini',
    },
    model: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'gemini-1.5-flash',
    },
  }, {
    tableName: 'ai_settings',
  });

  return AiSetting;
};
