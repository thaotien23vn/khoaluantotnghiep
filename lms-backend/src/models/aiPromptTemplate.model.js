const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AiPromptTemplate = sequelize.define('AiPromptTemplate', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    template: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    createdByAdminId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'created_by_admin_id',
    },
  }, {
    tableName: 'ai_prompt_templates',
  });

  return AiPromptTemplate;
};
