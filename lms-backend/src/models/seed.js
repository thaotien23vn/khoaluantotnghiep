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

  const categoriesData = [
    { name: 'Lập trình Web', sortOrder: 1, desc: 'HTML, CSS, JavaScript, React, Node.js và các framework hiện đại', icon: 'Globe' },
    { name: 'Khoa học Dữ liệu', sortOrder: 2, desc: 'Python, Machine Learning, AI, Phân tích dữ liệu', icon: 'Database' },
    { name: 'Thiết kế & UX/UI', sortOrder: 3, desc: 'Figma, Adobe XD, nguyên tắc thiết kế, trải nghiệm người dùng', icon: 'Palette' },
    { name: 'Marketing Digital', sortOrder: 4, desc: 'SEO, Content Marketing, Social Media, Google Ads', icon: 'TrendingUp' },
    { name: 'Kinh doanh & Khởi nghiệp', sortOrder: 5, desc: 'Quản trị doanh nghiệp, lập kế hoạch, tài chính cơ bản', icon: 'Briefcase' },
    { name: 'Ngoại ngữ', sortOrder: 6, desc: 'Tiếng Anh, tiếng Nhật, tiếng Hàn và các ngôn ngữ khác', icon: 'Languages' },
    { name: 'Kỹ năng mềm', sortOrder: 7, desc: 'Giao tiếp, thuyết trình, làm việc nhóm, quản lý thời gian', icon: 'Users' },
    { name: 'CNTT & Bảo mật', sortOrder: 8, desc: 'Mạng máy tính, bảo mật, DevOps, Cloud Computing', icon: 'Shield' },
  ];

  // Get or create admin as course creator
  const admin = await models.User.findOne({ where: { role: 'admin' } });
  const createdBy = admin?.id || null;

  for (let catIndex = 0; catIndex < categoriesData.length; catIndex++) {
    const catData = categoriesData[catIndex];

    let category = await Category.findOne({ where: { name: catData.name } });
    if (!category) {
      category = await Category.create({
        name: catData.name,
        description: catData.desc,
        icon: catData.icon,
        sortOrder: catData.sortOrder,
        isActive: true,
      });
      console.log(`  ✓ Created Category: ${catData.name}`);
    } else {
      await category.update({
        description: catData.desc,
        icon: catData.icon,
        sortOrder: catData.sortOrder,
        isActive: true,
      });
      console.log(`  ✓ Updated Category: ${catData.name}`);
    }

    // Create learning path for this category
    let path = await LearningPath.findOne({ where: { categoryId: category.id } });
    if (!path) {
      path = await LearningPath.create({
        name: `Lộ trình ${catData.name}`,
        slug: `path-${catData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        description: catData.desc,
        categoryId: category.id,
        isActive: true,
      });
      console.log(`    ✓ LearningPath: ${path.name}`);
    }

    // Create 3 courses per category with generic names
    const courseTitles = [
      { title: `Nhập môn ${catData.name}`, level: 'beginner' },
      { title: `${catData.name} nâng cao`, level: 'intermediate' },
      { title: `Chuyên gia ${catData.name}`, level: 'advanced' },
    ];

    for (let i = 0; i < courseTitles.length; i++) {
      const courseInfo = courseTitles[i];
      const slug = `${category.id}-${courseInfo.level}-${i + 1}`;

      let course = await Course.findOne({ where: { slug } });
      if (!course) {
        course = await Course.create({
          title: courseInfo.title,
          slug,
          description: `Khóa học ${courseInfo.title} thuộc lĩnh vực ${catData.name}. ${catData.desc}`,
          imageUrl: `/courses/default.jpg`,
          level: courseInfo.level,
          categoryId: category.id,
          price: 0,
          status: 'published',
          published: true,
          createdBy,
          duration: '12 giờ',
          totalLessons: 10,
        });
        console.log(`      ✓ Course: ${courseInfo.title}`);

        // Create 2 chapters with lectures
        for (let ch = 1; ch <= 2; ch++) {
          const chapter = await Chapter.create({
            title: `Chương ${ch}: Kiến thức cơ bản`,
            description: `Nội dung chương ${ch} - ${courseInfo.title}`,
            courseId: course.id,
            order: ch,
          });

          // 2 lectures per chapter
          for (let lec = 1; lec <= 2; lec++) {
            await Lecture.create({
              title: `Bài ${lec}: ${courseInfo.title} - Phần ${lec}`,
              type: 'video',
              duration: 600,
              content: `Nội dung bài học ${lec} về ${courseInfo.title}`,
              chapterId: chapter.id,
              order: lec,
              isPreview: lec === 1,
            });
          }

          // 1 quiz per chapter
          await Quiz.create({
            title: `Quiz Chương ${ch}`,
            description: `Kiểm tra kiến thức chương ${ch} - ${courseInfo.title}`,
            passingScore: 70,
            timeLimit: 10,
            chapterId: chapter.id,
            courseId: course.id,
            status: 'published',
            createdBy,
          });
        }
      } else {
        // Update existing course to ensure correct category
        if (course.categoryId !== category.id) {
          await course.update({ categoryId: category.id });
        }
      }

      // Link course to learning path (idempotent)
      if (course) {
        const existingPathCourse = await PathCourse.findOne({
          where: { pathId: path.id, courseId: course.id },
        });
        if (!existingPathCourse) {
          await PathCourse.create({
            pathId: path.id,
            courseId: course.id,
            orderIndex: i,
            isRequired: true,
          });
          console.log(`      ✓ PathCourse: ${courseInfo.title} -> ${path.name}`);
        }
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
