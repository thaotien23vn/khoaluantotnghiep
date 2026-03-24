const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Notification = sequelize.define('Notification', {
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
    type: {
      type: DataTypes.ENUM('enrollment', 'quiz', 'review', 'payment', 'course_update', 'certificate', 'announcement'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    dedupeKey: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'dedupe_key',
      comment: 'Key for deduplication (e.g., quiz_deadline:123:24h)',
    },
    dedupeUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'dedupe_until',
      comment: 'Timestamp until which this dedupeKey is valid',
    },
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'notifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['type']
      },
      {
        fields: ['read']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['user_id', 'dedupe_key'],
        unique: true,
        name: 'notifications_user_dedupe_unique'
      }
    ]
  });

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  };

  return Notification;
};
