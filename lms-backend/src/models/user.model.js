const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'password_hash',
    },
    role: {
      type: DataTypes.ENUM('student', 'teacher', 'admin'),
      allowNull: false,
      defaultValue: 'student',
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    avatar: {
      type: DataTypes.STRING,
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_email_verified',
    },
    emailVerificationToken: {
      type: DataTypes.STRING,
      field: 'email_verification_token',
    },
    emailVerificationTokenExpires: {
      type: DataTypes.DATE,
      field: 'email_verification_token_expires',
    },
    resetPasswordToken: {
      type: DataTypes.STRING,
      field: 'reset_password_token',
    },
    resetPasswordTokenExpires: {
      type: DataTypes.DATE,
      field: 'reset_password_token_expires',
    },

    chatBannedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'chat_banned_until',
    },
    chatBanReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'chat_ban_reason',
    },
  }, {
    tableName: 'users',
  });

  return User;
};
