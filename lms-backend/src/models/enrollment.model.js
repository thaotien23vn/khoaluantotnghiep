const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Enrollment = sequelize.define('Enrollment', {
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
    status: {
      type: DataTypes.STRING(32),
      defaultValue: 'enrolled',
    },
    progressPercent: {
      type: DataTypes.DECIMAL(5, 2),
      field: 'progress_percent',
      defaultValue: 0.0,
    },
    enrolledAt: {
      type: DataTypes.DATE,
      field: 'enrolled_at',
      defaultValue: DataTypes.NOW,
    },
    // Expiration fields for renewal system
    expiresAt: {
      type: DataTypes.DATE,
      field: 'expires_at',
      allowNull: true,
      comment: 'Course access expiration date',
    },
    gracePeriodEndsAt: {
      type: DataTypes.DATE,
      field: 'grace_period_ends_at',
      allowNull: true,
      comment: 'End of grace period after expiration',
    },
    renewalCount: {
      type: DataTypes.INTEGER,
      field: 'renewal_count',
      defaultValue: 0,
      comment: 'Number of times enrollment has been renewed',
    },
    lastRenewedAt: {
      type: DataTypes.DATE,
      field: 'last_renewed_at',
      allowNull: true,
      comment: 'Last renewal timestamp',
    },
    enrollmentStatus: {
      type: DataTypes.ENUM('active', 'expired', 'grace_period'),
      field: 'enrollment_status',
      defaultValue: 'active',
      comment: 'Current enrollment status',
    },
  }, {
    tableName: 'enrollments',
    timestamps: false,
    indexes: [
      // Prevent duplicate enrollments and race-condition double-inserts
      {
        name: 'enrollments_user_course_unique',
        unique: true,
        fields: ['user_id', 'course_id'],
      },
      // Indexes for expiration queries
      {
        name: 'idx_enrollments_expires_at',
        fields: ['expires_at'],
      },
      {
        name: 'idx_enrollments_enrollment_status',
        fields: ['enrollment_status'],
      },
      {
        name: 'idx_enrollments_grace_period',
        fields: ['grace_period_ends_at'],
      },
    ],
  });

  return Enrollment;
};
