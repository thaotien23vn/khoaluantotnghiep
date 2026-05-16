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
    enrollmentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'enrollment_id',
      comment: 'Link to enrollment record (for direct enrollment flow)',
    },
    amount: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'VND',
    },
    provider: {
      type: DataTypes.ENUM('stripe', 'paypal', 'bank_transfer', 'mock', 'vnpay'),
      allowNull: false,
    },
    providerTxn: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'provider_txn',
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled', 'refunded'),
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
    underscored: true,
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

    Payment.belongsTo(models.Enrollment, {
      foreignKey: 'enrollmentId',
      as: 'enrollment',
    });
  };

  return Payment;
};
