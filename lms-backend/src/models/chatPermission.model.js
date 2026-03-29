const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const ChatPermission = sequelize.define(
    "ChatPermission",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "user_id",
        comment: "Null = áp dụng cho toàn bộ role/course",
      },
      courseId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "course_id",
        comment: "Null = áp dụng cho toàn bộ hệ thống",
      },
      lectureId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "lecture_id",
        comment: "Null = áp dụng cho cả course",
      },
      role: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "student, teacher - null = áp dụng cho tất cả roles",
      },
      canChat: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "can_chat",
      },
      mutedUntil: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "muted_until",
      },
      mutedBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "muted_by",
      },
      muteReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "mute_reason",
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_deleted",
      },
      deletedBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "deleted_by",
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "deleted_at",
      },
    },
    {
      tableName: "chat_permissions",
      indexes: [
        { fields: ['user_id'] },
        { fields: ['course_id'] },
        { fields: ['lecture_id'] },
        { fields: ['role'] },
        { fields: ['can_chat'] },
        { fields: ['muted_until'] },
      ],
    },
  );

  return ChatPermission;
};
