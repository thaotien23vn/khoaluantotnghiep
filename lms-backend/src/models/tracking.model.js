const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TrackingActivity = sequelize.define(
    'TrackingActivity',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
        // page_view, cookie_consent_granted, cookie_consent_denied, click, scroll, etc.
      },
      page: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      referrer: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      sessionId: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'tracking_activities',
      timestamps: true,
      updatedAt: false,
      indexes: [
        { fields: ['userId'] },
        { fields: ['action'] },
        { fields: ['createdAt'] },
        { fields: ['sessionId'] },
        { fields: ['ipAddress'] },
      ],
    }
  );

  TrackingActivity.associate = (models) => {
    TrackingActivity.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  };

  return TrackingActivity;
};
