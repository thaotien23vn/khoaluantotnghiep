require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, connectDB, models } = require('./index');

const CLEANUP_ON_START = process.env.CLEANUP_DB === 'true' || process.env.CLEANUP_DB === '1';
const CREATE_ADMIN = process.env.CREATE_ADMIN !== 'false'; // default true

async function cleanupDatabase() {
  if (!CLEANUP_ON_START) {
    console.log('ℹ️  Bỏ qua dọn dẹp DB (CLEANUP_DB=false)');
    return;
  }

  console.log('🧹 Đang dọn dẹp database...');
  
  // Xóa dữ liệu tất cả bảng (giữ nguyên cấu trúc)
  const tables = [
    'ai_audit_logs',
    'ai_messages',
    'ai_conversations',
    'ai_chunks',
    'ai_documents',
    'ai_prompt_templates',
    'ai_role_policies',
    'ai_settings',
    'forum_reports',
    'forum_posts',
    'forum_topics',
    'schedule_events',
    'attempts',
    'questions',
    'quizzes',
    'payments',
    'enrollments',
    'reviews',
    'notifications',
    'lectures',
    'chapters',
    'courses',
    'categories',
    'users',
  ];

  for (const table of tables) {
    try {
      await sequelize.query(`TRUNCATE TABLE "${table}" CASCADE`);
      console.log(`  ✓ Đã xóa: ${table}`);
    } catch (err) {
      // Bảng có thể chưa tồn tại, bỏ qua
      console.log(`  ⚠️  ${table}: ${err.message}`);
    }
  }
  
  console.log('✅ Dọn dẹp hoàn tất');
}

async function createAdmin() {
  if (!CREATE_ADMIN) {
    console.log('ℹ️  Bỏ qua tạo admin (CREATE_ADMIN=false)');
    return;
  }

  const { User } = models;
  
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@lms.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
  const adminName = process.env.ADMIN_NAME || 'Administrator';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';

  console.log('👤 Kiểm tra admin user...');
  
  // Kiểm tra admin đã tồn tại chưa
  const existingAdmin = await User.findOne({
    where: { email: adminEmail }
  });

  if (existingAdmin) {
    console.log(`  ℹ️  Admin đã tồn tại: ${adminEmail}`);
    
    // Cập nhật role thành admin nếu chưa phải
    if (existingAdmin.role !== 'admin') {
      await existingAdmin.update({ role: 'admin' });
      console.log('  ✓ Đã cập nhật role thành admin');
    }
    return;
  }

  // Tạo admin mới
  const passwordHash = bcrypt.hashSync(adminPassword, 10);
  
  await User.create({
    name: adminName,
    email: adminEmail,
    passwordHash: passwordHash,
    role: 'admin',
    username: adminUsername,
    isActive: true,
    isEmailVerified: true,
  });

  console.log('✅ Đã tạo admin user:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Username: ${adminUsername}`);
  console.log(`   Role: admin`);
}

async function seed() {
  try {
    await connectDB();
    
    // Chỉ sync các bảng chưa có (không force)
    await sequelize.sync({ alter: false });
    
    await cleanupDatabase();
    await createAdmin();
    
    console.log('\n🎉 Seed hoàn tất!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed thất bại:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Chạy nếu file được gọi trực tiếp
if (require.main === module) {
  seed();
}

async function autoSeed() {
  // Luôn tạo admin nếu chưa có (không cần biến env)
  // Chỉ dọn dẹp khi CLEANUP_DB=true
  const shouldCleanup = process.env.CLEANUP_DB === 'true' || process.env.CLEANUP_DB === '1';
  
  if (shouldCleanup) {
    await cleanupDatabase();
  }
  
  // Luôn tạo admin nếu chưa có
  await createAdmin();
}

module.exports = { seed, autoSeed, cleanupDatabase, createAdmin };
