const { DataTypes } = require('sequelize');

/**
 * Admin Action Log Model
 * Lưu trữ lịch sử hành động của admin (audit trail)
 */
module.exports = (sequelize) => {
  const AdminActionLog = sequelize.define(
    'AdminActionLog',
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      adminId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'admin_id',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      targetType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'target_type',
        comment: 'user, course, payment, review, category, etc.',
      },
      targetId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'target_id',
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'create, update, delete, ban, approve, reject, etc.',
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Lưu thêm dữ liệu tùy theo action',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at',
      },
    },
    {
      tableName: 'admin_action_logs',
      timestamps: false,
      indexes: [
        { fields: ['admin_id'] },
        { fields: ['target_type', 'target_id'] },
        { fields: ['action'] },
        { fields: ['created_at'] },
      ],
    }
  );

  AdminActionLog.associate = (models) => {
    AdminActionLog.belongsTo(models.User, {
      foreignKey: 'adminId',
      as: 'admin',
    });
  };

  return AdminActionLog;
};
