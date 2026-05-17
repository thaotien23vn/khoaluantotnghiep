require('dotenv').config();
const { sequelize } = require('./index');

const MIGRATION_VERSION = 1;

async function runMigrations() {
  console.log('🔧 Running DB migrations...');

  const [results] = await sequelize.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'learning_paths'
    )`,
    { type: sequelize.QueryTypes.SELECT }
  );

  const learningPathExists = results.exists;

  if (!learningPathExists) {
    console.log('  Creating learning_paths table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "learning_paths" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "slug" VARCHAR(255) NOT NULL UNIQUE,
        "description" TEXT,
        "category_id" INTEGER REFERENCES "categories"("id"),
        "is_active" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);

    console.log('  Creating path_courses table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "path_courses" (
        "id" SERIAL PRIMARY KEY,
        "path_id" INTEGER NOT NULL REFERENCES "learning_paths"("id") ON DELETE CASCADE,
        "course_id" INTEGER NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
        "order_index" INTEGER NOT NULL DEFAULT 0,
        "is_required" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        UNIQUE ("path_id", "course_id")
      )
    `);

    console.log('  Creating user_learning_paths table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "user_learning_paths" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "path_id" INTEGER NOT NULL REFERENCES "learning_paths"("id") ON DELETE CASCADE,
        "current_level" VARCHAR(2) CHECK ("current_level" IN ('A1','A2','B1','B2','C1','C2')),
        "overall_progress" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
        "started_at" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "status" VARCHAR(20) DEFAULT 'active' CHECK ("status" IN ('active','completed','paused')),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        UNIQUE ("user_id", "path_id")
      )
    `);
  }

  // Always try to create level_certificates independently
  const [levelCertExists] = await sequelize.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'level_certificates'
    )`,
    { type: sequelize.QueryTypes.SELECT }
  );
  if (!levelCertExists.exists) {
    console.log('  Creating level_certificates table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "level_certificates" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "level" VARCHAR(2) NOT NULL CHECK ("level" IN ('A1','A2','B1','B2','C1','C2')),
        "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "certificate_id" VARCHAR(255) NOT NULL UNIQUE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        UNIQUE ("user_id", "level")
      )
    `);
  } else {
    console.log('  level_certificates already exists');
  }

  // Add columns if not exist
  const addColumnIfNotExists = async (table, column, type) => {
    const [cols] = await sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = '${table}' AND column_name = '${column}'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    if (!cols || cols.length === 0) {
      console.log(`  Adding ${column} to ${table}...`);
      await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
    }
  };

  await addColumnIfNotExists('categories', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfNotExists('categories', 'cefr_level', 'VARCHAR(2)');
  await addColumnIfNotExists('courses', 'skill', 'VARCHAR(20)');
  await addColumnIfNotExists('courses', 'deleted_at', 'TIMESTAMP WITH TIME ZONE');

  // Seed path_courses for existing courses (idempotent)
  console.log('  Seeding path_courses...');
  try {
    const seedPathCourses = await sequelize.query(`
      INSERT INTO path_courses (path_id, course_id, order_index, is_required, created_at, updated_at)
      SELECT lp.id, c.id,
        ROW_NUMBER() OVER (PARTITION BY lp.id ORDER BY c.id) - 1,
        true, NOW(), NOW()
      FROM learning_paths lp
      JOIN categories cat ON cat.id = lp.category_id
      JOIN courses c ON c."categoryId" = cat.id
      WHERE c."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM path_courses pc
          WHERE pc.path_id = lp.id AND pc.course_id = c.id
        )
      RETURNING path_id, course_id
    `);
    console.log(`    ✓ Linked ${seedPathCourses[0]?.length || 0} courses to paths`);
  } catch (seedErr) {
    console.warn('  ⚠️  path_courses seed skipped:', seedErr.message);
  }

  console.log('✅ Migrations complete');
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
