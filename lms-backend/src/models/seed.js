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

async function createAiBot() {
  const { User } = models;
  const aiBotEmail = 'aibot@lms.com';

  const existing = await User.findOne({ where: { email: aiBotEmail } });
  if (existing) {
    console.log(`  ℹ️  AI Bot đã tồn tại (id=${existing.id})`);
    return existing;
  }

  const passwordHash = bcrypt.hashSync('AIBot_NoLogin_' + Math.random(), 10);
  const bot = await User.create({
    name: 'AI Trợ Giảng',
    email: aiBotEmail,
    passwordHash,
    role: 'admin',
    username: 'aibot',
    isActive: true,
    isEmailVerified: true,
  });
  console.log(`✅ Đã tạo AI Bot user (id=${bot.id})`);
  return bot;
}

async function seedCategoriesAndCourses() {
  const { Category, Course, Chapter, Lecture, Quiz, LearningPath, PathCourse } = models;

  console.log('📚 Đang seed Categories & Courses...');

  const cefrLevels = [
    { name: 'A1 Beginner', sortOrder: 1, cefrLevel: 'A1', desc: 'Mới bắt đầu học tiếng Anh' },
    { name: 'A2 Elementary', sortOrder: 2, cefrLevel: 'A2', desc: 'Cơ bản' },
    { name: 'B1 Intermediate', sortOrder: 3, cefrLevel: 'B1', desc: 'Trung cấp' },
    { name: 'B2 Upper-Intermediate', sortOrder: 4, cefrLevel: 'B2', desc: 'Trung cấp cao' },
    { name: 'C1 Advanced', sortOrder: 5, cefrLevel: 'C1', desc: 'Nâng cao' },
    { name: 'C2 Proficiency', sortOrder: 6, cefrLevel: 'C2', desc: 'Thành thạo' },
  ];

  const skills = ['listening', 'speaking', 'reading', 'writing'];

  // Get or create admin as course creator
  const admin = await models.User.findOne({ where: { role: 'admin' } });
  const createdBy = admin?.id || null;

  for (const level of cefrLevels) {
    // Try find by cefrLevel first
    let category = await Category.findOne({ where: { cefrLevel: level.cefrLevel } });

    // If not found, try patch existing category by name (case-insensitive)
    if (!category) {
      const existingByName = await Category.findOne({
        where: { name: { [require('sequelize').Op.like]: `%${level.cefrLevel}%` } },
      });
      if (existingByName) {
        await existingByName.update({
          sortOrder: level.sortOrder,
          cefrLevel: level.cefrLevel,
        });
        category = existingByName;
        console.log(`  ✓ Updated Category: ${existingByName.name} → ${level.cefrLevel}`);
      }
    }

    // Create if truly not exists
    if (!category) {
      category = await Category.create({
        name: level.name,
        sortOrder: level.sortOrder,
        cefrLevel: level.cefrLevel,
      });
      console.log(`  ✓ Created Category: ${level.name}`);
    }

    // Create learning path for this category
    let path = await LearningPath.findOne({ where: { categoryId: category.id } });
    if (!path) {
      path = await LearningPath.create({
        name: `Lộ trình ${level.name}`,
        slug: `path-${level.cefrLevel.toLowerCase()}`,
        description: level.desc,
        categoryId: category.id,
        isActive: true,
      });
      console.log(`    ✓ LearningPath: ${path.name}`);
    }

    // Create 4 courses per level
    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];
      const skillLabel = skill.charAt(0).toUpperCase() + skill.slice(1);
      const courseTitle = `${level.cefrLevel} ${skillLabel}`;
      const slug = `${level.cefrLevel.toLowerCase()}-${skill}`;

      let course = await Course.findOne({ where: { slug } });
      if (!course) {
        course = await Course.create({
          title: courseTitle,
          slug,
          description: `Khóa học ${skillLabel} cho trình độ ${level.name}. ${level.desc}`,
          imageUrl: `/courses/${skill}.jpg`,
          level: level.cefrLevel.toLowerCase(),
          categoryId: category.id,
          skill,
          price: 0,
          status: 'published',
          published: true,
          createdBy,
          duration: '10 giờ',
          totalLessons: 8,
        });
        console.log(`      ✓ Course: ${courseTitle}`);

        // Create 2 chapters with lectures
        for (let ch = 1; ch <= 2; ch++) {
          const chapter = await Chapter.create({
            title: `Chương ${ch}: ${skillLabel} cơ bản`,
            description: `Nội dung chương ${ch}`,
            courseId: course.id,
            order: ch,
          });

          // 2 lectures per chapter
          for (let lec = 1; lec <= 2; lec++) {
            await Lecture.create({
              title: `Bài ${lec}: ${skillLabel} - Phần ${lec}`,
              type: 'video',
              duration: 600,
              content: `Nội dung bài học ${lec} về ${skillLabel}`,
              chapterId: chapter.id,
              order: lec,
              isPreview: lec === 1,
            });
          }

          // 1 quiz per chapter
          await Quiz.create({
            title: `Quiz Chương ${ch}`,
            description: `Kiểm tra ${skillLabel} chương ${ch}`,
            passingScore: 70,
            timeLimit: 10,
            chapterId: chapter.id,
            courseId: course.id,
            status: 'published',
          });
        }

        // Link course to learning path
        await PathCourse.create({
          pathId: path.id,
          courseId: course.id,
          orderIndex: i,
          isRequired: true,
        });
      }
    }
  }

  console.log('✅ Seed Categories & Courses hoàn tất');
}

async function seed() {
  try {
    await connectDB();

    // Chỉ sync các bảng chưa có (không force)
    await sequelize.sync({ alter: false });

    await cleanupDatabase();
    await createAdmin();
    await createAiBot();
    await seedCategoriesAndCourses();

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
  await createAiBot();

  // Seed categories, learning paths, and 24 courses (idempotent)
  await seedCategoriesAndCourses();
}

module.exports = { seed, autoSeed, cleanupDatabase, createAdmin, createAiBot };
