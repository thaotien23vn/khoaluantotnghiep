const { DataTypes } = require('sequelize');

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
        comment: 'CEFR level: A1, A2, B1, B2, C1, C2',
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
        comment: 'Unique certificate ID e.g. LEVEL-CERT-B1-123-456789',
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
