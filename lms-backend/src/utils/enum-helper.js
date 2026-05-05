/**
 * PostgreSQL ENUM Helper for Sequelize
 * Xử lý vấn đề alter enum trong PostgreSQL khi dùng sequelize.sync({ alter: true })
 * 
 * Vấn đề: PostgreSQL không cho phép cast enum type trực tiếp
 * Giải pháp: Xóa và tạo lại enum types đúng cách trước khi sync
 */

const logger = require('./logger');

/**
 * Lấy danh sách tất cả enum types trong database
 */
async function getEnumTypes(sequelize) {
  const query = `
    SELECT 
      t.typname as enum_name,
      array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    AND t.typname LIKE 'enum_%'
    GROUP BY t.typname
    ORDER BY t.typname;
  `;
  
  const [results] = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT });
  return results || [];
}

/**
 * Xóa enum type cũ và tạo lại với values mới
 * Lưu ý: Chỉ dùng khi column đang là NULL hoặc không có data
 */
async function recreateEnumType(sequelize, enumName, values, tableName, columnName) {
  const transaction = await sequelize.transaction();
  
  try {
    // Kiểm tra xem enum có tồn tại không
    const checkQuery = `
      SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = :enumName AND n.nspname = 'public'
    `;
    const [exists] = await sequelize.query(checkQuery, {
      replacements: { enumName },
      type: sequelize.QueryTypes.SELECT,
      transaction
    });
    
    if (!exists) {
      // Enum chưa tồn tại, tạo mới
      const createQuery = `CREATE TYPE "${enumName}" AS ENUM (${values.map(v => `'${v}'`).join(', ')})`;
      await sequelize.query(createQuery, { transaction });
      logger.info(`Created enum type: ${enumName}`);
    } else {
      logger.info(`Enum type ${enumName} already exists`);
    }
    
    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    logger.error(`Failed to recreate enum ${enumName}:`, error.message);
    throw error;
  }
}

/**
 * Fix enum types cho toàn bộ database trước khi sync
 * Giải pháp chính cho lỗi "cannot cast type course_status to enum_courses_status"
 */
async function fixEnumTypesBeforeSync(sequelize) {
  logger.info('ENUM_HELPER_STARTING');
  
  try {
    // Lấy danh sách enum hiện tại
    const existingEnums = await getEnumTypes(sequelize);
    logger.info(`Found ${existingEnums.length} existing enum types`);
    
    // Đổi tên các enum cũ thành _old để tránh conflict khi sync
    for (const enumType of existingEnums) {
      const oldName = `${enumType.enum_name}_old`;
      
      try {
        // Kiểm tra xem enum cũ đã tồn tại chưa
        const checkOldQuery = `
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = :oldName AND n.nspname = 'public'
        `;
        const [oldExists] = await sequelize.query(checkOldQuery, {
          replacements: { oldName },
          type: sequelize.QueryTypes.SELECT
        });
        
        if (!oldExists) {
          // Đổi tên enum hiện tại thành _old
          await sequelize.query(`ALTER TYPE "${enumType.enum_name}" RENAME TO "${oldName}"`);
          logger.info(`Renamed ${enumType.enum_name} -> ${oldName}`);
        }
      } catch (renameError) {
        // Có thể enum đang được dùng, bỏ qua và để Sequelize xử lý
        logger.warn(`Could not rename ${enumType.enum_name}: ${renameError.message}`);
      }
    }
    
    logger.info('ENUM_HELPER_COMPLETED');
    return true;
  } catch (error) {
    logger.error('ENUM_HELPER_FAILED', { error: error.message });
    // Không throw để cho phép sync tiếp tục
    return false;
  }
}

/**
 * Cleanup enum types _old sau khi sync thành công
 */
async function cleanupOldEnumTypes(sequelize) {
  logger.info('ENUM_CLEANUP_STARTING');
  
  try {
    // Tìm và xóa các enum _old không còn dùng
    const query = `
      SELECT t.typname 
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      AND t.typname LIKE '%_old'
      AND NOT EXISTS (
        SELECT 1 FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        WHERE a.atttypid = t.oid
      )
    `;
    
    const [oldEnums] = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT });
    
    for (const enumType of oldEnums) {
      try {
        await sequelize.query(`DROP TYPE IF EXISTS "${enumType.typname}"`);
        logger.info(`Dropped old enum: ${enumType.typname}`);
      } catch (dropError) {
        logger.warn(`Could not drop ${enumType.typname}: ${dropError.message}`);
      }
    }
    
    logger.info('ENUM_CLEANUP_COMPLETED');
  } catch (error) {
    logger.error('ENUM_CLEANUP_FAILED', { error: error.message });
  }
}

module.exports = {
  getEnumTypes,
  recreateEnumType,
  fixEnumTypesBeforeSync,
  cleanupOldEnumTypes
};
