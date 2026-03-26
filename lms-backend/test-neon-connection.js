// Test script to verify Neon PostgreSQL connection
require('dotenv').config();

const { Sequelize } = require('sequelize');

async function testConnection() {
  console.log('🧪 Testing Neon PostgreSQL connection...\n');

  // Check environment
  console.log('📋 Environment:');
  console.log('  DATABASE_URL exists:', !!process.env.DATABASE_URL);
  console.log('  DATABASE_URL value:', process.env.DATABASE_URL ? 
    process.env.DATABASE_URL.replace(/:([^@]+)@/, ':****@') : 'Not set');
  console.log('  NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('  Old DB_HOST:', process.env.DB_HOST || 'Not set');

  if (!process.env.DATABASE_URL) {
    console.error('\n❌ DATABASE_URL is not set!');
    console.log('   Please add DATABASE_URL to your .env file:\n');
    console.log('   DATABASE_URL=postgresql://neondb_owner:npg_NSethQR6yn3U@ep-green-leaf-a1mz4y0g-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');
    process.exit(1);
  }

  // Create fresh connection using DATABASE_URL
  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });

  try {
    // Test connection
    console.log('\n🔌 Connecting to Neon PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Connected successfully!\n');

    // Test query
    console.log('📊 Running test query...');
    const [results] = await sequelize.query('SELECT version() as version');
    console.log('  PostgreSQL Version:', results[0].version);

    // Check tables
    console.log('\n📦 Checking tables...');
    const tables = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    if (tables.length === 0) {
      console.log('  ⚠️ No tables found - database is empty');
      console.log('     Run: npm run db:sync để tạo tables');
    } else {
      console.log(`  ✅ Found ${tables.length} tables:`);
      tables.forEach(t => console.log(`    - ${t.table_name}`));
    }

    console.log('\n✅ Neon PostgreSQL connection test passed!');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    if (error.original) {
      console.error('  Original error:', error.original.message);
    }
    process.exit(1);
  }
}

testConnection();
