const { DataTypes } = require('sequelize');

/**
 * LevelCertificate Model
 * 
 * Internal platform certificates of achievement for course path completion.
 * The level field stores the generic difficulty level of the completed path.
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
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Course path level (e.g. beginner, intermediate, advanced)',
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
