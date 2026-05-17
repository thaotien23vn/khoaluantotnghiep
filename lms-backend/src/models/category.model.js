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
      sortOrder: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment: 'Order for CEFR levels: A1=1, A2=2, B1=3, B2=4, C1=5, C2=6',
      },
      cefrLevel: {
        type: DataTypes.ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2'),
        allowNull: true,
        comment: 'CEFR level mapping for learning path',
      },
    },
    {
      tableName: 'categories',
    }
  );

  return Category;
};
