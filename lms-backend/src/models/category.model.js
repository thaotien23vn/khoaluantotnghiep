const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Category = sequelize.define(
    'Category',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // Tùy chọn: gắn category này với một mục trên menu ngang FE
      // Ví dụ: 'Bứt phá điểm số', 'Combo bứt phá', 'Luyện thi'
      menuSection: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'categories',
    }
  );

  return Category;
};
