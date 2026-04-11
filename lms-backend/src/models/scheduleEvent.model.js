const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ScheduleEvent = sequelize.define('ScheduleEvent', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    courseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'course_id',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'lesson | exam | assignment | live',
    },
    startAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'start_at',
    },
    endAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'end_at',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'upcoming',
      comment: 'upcoming | completed | missed | ongoing',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    zoomLink: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'zoom_link',
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'created_by',
    },
    isPersonalNote: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_personal_note',
    },
  }, {
    tableName: 'schedule_events',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return ScheduleEvent;
};
