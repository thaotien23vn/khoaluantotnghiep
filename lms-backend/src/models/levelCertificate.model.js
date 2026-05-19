const { DataTypes } = require('sequelize');

/**
 * LevelCertificate Model
 * 
 * ⚠️ IMPORTANT NOTE ABOUT CERTIFICATE TYPE:
 * This model stores course path completion certificates - INTERNAL PLATFORM CERTIFICATES OF ACHIEVEMENT.
 * These are NOT official language proficiency certificates recognized internationally (e.g., IELTS, TOEIC).
 * 
 * The system uses CEFR levels (A1-C2) ONLY to classify course content and assess learning progress
 * within the platform's internal curriculum. The certificate verifies that a learner has completed
 * a course path on the platform, not that they have achieved an official language proficiency level.
 * 
 * Certificate Verification:
 * - Verification via certificateId confirms platform course completion only
 * - It does NOT verify official language proficiency
 * - The certificate is issued by the e-learning platform, not by a language certification body
 */
module.exports = (sequelize) => {
  const LevelCertificate = sequelize.define(
    'LevelCertificate',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      level: {
        type: DataTypes.STRING(2),
        allowNull: false,
        comment: 'Course path level: A1, A2, B1, B2, C1, C2 (based on internal curriculum, not official language proficiency)',
      },
      issuedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'issued_at',
      },
      certificateId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'certificate_id',
        comment: 'Unique certificate ID for course completion verification (internal platform certificate, not language proficiency)',
      },
    },
    {
      tableName: 'level_certificates',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'level'],
        },
      ],
    }
  );

  return LevelCertificate;
};
