const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Payment = sequelize.define('Payment', {
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
    courseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'course_id',
    },
    amount: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
    },
    provider: {
      type: DataTypes.ENUM('stripe', 'paypal', 'bank_transfer', 'mock'),
      allowNull: false,
    },
    providerTxn: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'provider_txn',
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
      defaultValue: 'pending',
    },
    paymentDetails: {
      type: DataTypes.JSON,
      defaultValue: {},
      field: 'payment_details',
    },
  }, {
    tableName: 'payments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  Payment.associate = (models) => {
    Payment.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    
    Payment.belongsTo(models.Course, {
      foreignKey: 'courseId',
      as: 'course',
    });
  };

  return Payment;
};
