require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, models } = require('./src/models');

const DEMO_PASSWORD = 'demo123';

async function findPathAndCourses(cefrLevel) {
  const { LearningPath, PathCourse, Course, Category, Chapter, Lecture, Quiz } = models;

  // Find LearningPath for this CEFR level
  const path = await LearningPath.findOne({
    where: { isActive: true },
    include: [
      {
        model: Category,
        as: 'category',
        where: { cefrLevel },
        attributes: ['id', 'cefrLevel', 'sortOrder'],
      },
    ],
  });

  if (!path) {
    console.warn(`  ⚠️  Không tìm thấy LearningPath cho ${cefrLevel}`);
    return null;
  }

  // Get courses with their lectures
  const pathCourses = await PathCourse.findAll({
    where: { pathId: path.id },
    include: [
      {
        model: Course,
        as: 'course',
        where: { deletedAt: null },
        required: false,
        include: [
          {
            model: Chapter,
            include: [
              {
                model: Lecture,
                as: 'lectures',
                attributes: ['id', 'title', 'order'],
              },
              {
                model: Quiz,
                as: 'quizzes',
                where: { status: 'published' },
                required: false,
                attributes: ['id', 'title', 'passingScore'],
              },
            ],
          },
        ],
      },
    ],
    order: [['orderIndex', 'ASC']],
  });

  const courses = pathCourses
    .map(pc => pc.course)
    .filter(Boolean)
    .map(c => ({
      id: c.id,
      title: c.title,
      lectures: c.Chapters?.flatMap(ch => ch.lectures || []) || [],
      quizzes: c.Chapters?.flatMap(ch => ch.quizzes || []) || [],
    }));

  return { path, courses };
}

async function createLectureProgress(userId, courseId, lectures, targetPercent) {
  const { LectureProgress } = models;
  if (lectures.length === 0 || targetPercent <= 0) return;

  const count = Math.ceil((lectures.length * targetPercent) / 100);
  const toComplete = lectures.slice(0, count);

  for (const lec of toComplete) {
    await LectureProgress.findOrCreate({
      where: { userId, lectureId: lec.id },
      defaults: {
        userId,
        lectureId: lec.id,
        courseId,
        watchedPercent: 100,
        isCompleted: true,
        completedAt: new Date(),
        lastAccessedAt: new Date(),
      },
    });
  }
}

async function createQuizAttempts(userId, course, targetPercent) {
  const { Attempt } = models;
  if (course.quizzes.length === 0 || targetPercent < 100) return;

  // For 100% completion, pass all quizzes
  for (const quiz of course.quizzes) {
    await Attempt.findOrCreate({
      where: { userId, quizId: quiz.id },
      defaults: {
        userId,
        quizId: quiz.id,
        answers: [],
        score: quiz.passingScore || 70,
        percentageScore: 100,
        passed: true,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }
}

async function createLevelCertificates(userId, level) {
  const { LevelCertificate } = models;
  const certificateId = `LEVEL-CERT-${level}-${userId}-${Date.now()}`;
  await LevelCertificate.findOrCreate({
    where: { userId, level },
    defaults: {
      userId,
      level,
      certificateId,
      issuedAt: new Date(),
    },
  });
}

async function createQuizFailedAttempt(userId, course) {
  const { Attempt } = models;
  if (course.quizzes.length === 0) return;
  // Fail the first quiz only
  const quiz = course.quizzes[0];
  await Attempt.findOrCreate({
    where: { userId, quizId: quiz.id },
    defaults: {
      userId,
      quizId: quiz.id,
      answers: [],
      score: 30, // below passing
      percentageScore: 30,
      passed: false,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });
}

async function createDemoUser(demo) {
  const { User, UserLearningPath, Enrollment } = models;

  console.log(`\n👤 Tạo ${demo.email} (Level: ${demo.level})`);

  // 1. Create user
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const [user] = await User.findOrCreate({
    where: { email: demo.email },
    defaults: {
      name: demo.name,
      email: demo.email,
      passwordHash,
      role: demo.role || 'student',
      username: demo.email.split('@')[0],
      isActive: true,
      isEmailVerified: true,
    },
  });

  // 2. Find path & courses
  const targetLevels = demo.allLevels ? ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] : [demo.level];
  let path = null;
  const allCourses = [];

  for (const lvl of targetLevels) {
    const data = await findPathAndCourses(lvl);
    if (data) {
      if (lvl === demo.level) path = data.path;
      allCourses.push(...data.courses);
    }
  }

  if (!path && allCourses.length > 0) {
    const fallback = await findPathAndCourses(demo.level);
    if (fallback) path = fallback.path;
  }
  if (!path) return;
  const courses = allCourses;

  // 3. Create or update UserLearningPath (skip if demo.noPath)
  if (!demo.noPath) {
    await UserLearningPath.findOrCreate({
      where: { userId: user.id },
      defaults: {
        userId: user.id,
        pathId: path.id,
        currentLevel: demo.level,
        status: 'active',
      },
    });
  }

  // 4. Create enrollments + progress
  const enrollCfgs = demo.allLevels
    ? allCourses.map((_, i) => ({ courseIndex: i, progress: 100 }))
    : demo.enrollments;

  for (const enrollCfg of enrollCfgs) {
    const course = courses[enrollCfg.courseIndex];
    if (!course) {
      console.warn(`  ⚠️  Không có course index ${enrollCfg.courseIndex}`);
      continue;
    }

    const [enrollment] = await Enrollment.findOrCreate({
      where: { userId: user.id, courseId: course.id },
      defaults: {
        userId: user.id,
        courseId: course.id,
        status: enrollCfg.expired ? 'expired' : 'active',
        enrollmentType: 'free',
        progressPercent: enrollCfg.progress,
        enrolledAt: new Date(),
        expiresAt: enrollCfg.expired ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) :
                    enrollCfg.gracePeriod ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) : null,
        gracePeriodEndsAt: enrollCfg.gracePeriod ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) : null,
      },
    });

    // Update progress if already exists
    if (enrollment.progressPercent !== enrollCfg.progress) {
      await enrollment.update({ progressPercent: enrollCfg.progress });
    }

    // Create lecture progress
    await createLectureProgress(user.id, course.id, course.lectures, enrollCfg.progress);
    // Create quiz attempts for 100% courses
    await createQuizAttempts(user.id, course, enrollCfg.progress);
    // Create failed quiz attempt if specified
    if (enrollCfg.quizFail) {
      await createQuizFailedAttempt(user.id, course);
      console.log(`  ❌ Quiz failed for ${course.title}`);
    }
    console.log(`  ✓ ${course.title}: ${enrollCfg.progress}%`);
  }

  // 5. Create level certificates if specified
  if (demo.levelCertificates) {
    for (const certLevel of demo.levelCertificates) {
      await createLevelCertificates(user.id, certLevel);
      console.log(`  🏆 Level Certificate ${certLevel} created`);
    }
  }

  console.log(`  ✅ Done — đăng nhập: ${demo.email} / ${DEMO_PASSWORD}`);
}

async function main() {
  await sequelize.authenticate();
  console.log('✅ DB connected');

  const demos = [
    {
      name: 'Học viên A1 Mới',
      email: 'student_a1@demo.com',
      level: 'A1',
      enrollments: [{ courseIndex: 0, progress: 0 }],
    },
    {
      name: 'Học viên B1 Đang học',
      email: 'student_b1_half@demo.com',
      level: 'B1',
      enrollments: [
        { courseIndex: 0, progress: 50 },
        { courseIndex: 1, progress: 30 },
      ],
    },
    {
      name: 'Học viên B1 Hoàn thành',
      email: 'student_b1_done@demo.com',
      level: 'B1',
      enrollments: [
        { courseIndex: 0, progress: 100 },
        { courseIndex: 1, progress: 100 },
        { courseIndex: 2, progress: 100 },
        { courseIndex: 3, progress: 100 },
      ],
    },
    {
      name: 'Học viên B1 Hoàn thành 2',
      email: 'student_b1_done2@demo.com',
      level: 'B1',
      enrollments: [
        { courseIndex: 0, progress: 100 },
        { courseIndex: 1, progress: 100 },
        { courseIndex: 2, progress: 100 },
        { courseIndex: 3, progress: 100 },
      ],
    },
    {
      name: 'Học viên B1 Hoàn thành + Cert',
      email: 'student_b1_cert@demo.com',
      level: 'B1',
      enrollments: [
        { courseIndex: 0, progress: 100 },
        { courseIndex: 1, progress: 100 },
        { courseIndex: 2, progress: 100 },
        { courseIndex: 3, progress: 100 },
      ],
      levelCertificates: ['B1'],
    },
    {
      name: 'Học viên B2',
      email: 'student_b2@demo.com',
      level: 'B2',
      enrollments: [{ courseIndex: 0, progress: 25 }],
    },
    {
      name: 'Học viên C1',
      email: 'student_c1@demo.com',
      level: 'C1',
      enrollments: [
        { courseIndex: 0, progress: 60 },
        { courseIndex: 1, progress: 10 },
      ],
    },
    {
      name: 'Học viên Hết hạn',
      email: 'student_expired@demo.com',
      level: 'A1',
      enrollments: [
        { courseIndex: 0, progress: 40, expired: true },
      ],
    },
    {
      name: 'Chưa có lộ trình',
      email: 'student_no_path@demo.com',
      level: 'A1',
      noPath: true,
      enrollments: [],
    },
    {
      name: 'Học viên A2 Sẵn sàng lên B1',
      email: 'student_a2_ready@demo.com',
      level: 'A2',
      enrollments: [
        { courseIndex: 0, progress: 100 },
        { courseIndex: 1, progress: 100 },
        { courseIndex: 2, progress: 100 },
        { courseIndex: 3, progress: 70 },
      ],
    },
    {
      name: 'Học viên B1 Sẵn sàng lên B2',
      email: 'student_b1_ready@demo.com',
      level: 'B1',
      enrollments: [
        { courseIndex: 0, progress: 100 },
        { courseIndex: 1, progress: 100 },
        { courseIndex: 2, progress: 100 },
        { courseIndex: 3, progress: 80 },
      ],
    },
    {
      name: 'Học viên Grace Period',
      email: 'student_grace@demo.com',
      level: 'A1',
      enrollments: [
        { courseIndex: 0, progress: 60, gracePeriod: true },
      ],
    },
    {
      name: 'Học viên A1 Hoàn thành + Cert',
      email: 'student_a1_done@demo.com',
      level: 'A1',
      enrollments: [
        { courseIndex: 0, progress: 100 },
        { courseIndex: 1, progress: 100 },
        { courseIndex: 2, progress: 100 },
        { courseIndex: 3, progress: 100 },
      ],
      levelCertificates: ['A1'],
    },
    {
      name: 'Học viên B2 Hoàn thành + Cert',
      email: 'student_b2_done@demo.com',
      level: 'B2',
      enrollments: [
        { courseIndex: 0, progress: 100 },
        { courseIndex: 1, progress: 100 },
        { courseIndex: 2, progress: 100 },
        { courseIndex: 3, progress: 100 },
      ],
      levelCertificates: ['B2'],
    },
    {
      name: 'Học viên Full CEFR',
      email: 'student_c2_done@demo.com',
      level: 'C2',
      allLevels: true,
      levelCertificates: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    },
    {
      name: 'Học viên Nhiều chứng chỉ',
      email: 'student_multi_cert@demo.com',
      level: 'B1',
      enrollments: [
        { courseIndex: 0, progress: 100 },
        { courseIndex: 1, progress: 100 },
      ],
      levelCertificates: ['A1', 'A2', 'B1'],
    },
    {
      name: 'Học viên Quiz Failed',
      email: 'student_quiz_fail@demo.com',
      level: 'B1',
      enrollments: [
        { courseIndex: 0, progress: 80, quizFail: true },
        { courseIndex: 1, progress: 60 },
      ],
    },
  ];

  for (const demo of demos) {
    await createDemoUser(demo);
  }

  // Sync enrollment counts to course.students for accurate display
  console.log('\n🔄 Đồng bộ số học viên cho các khóa học...');
  const { Course, Enrollment } = models;
  const allCourses = await Course.findAll();
  for (const course of allCourses) {
    const count = await Enrollment.count({ where: { courseId: course.id } });
    if (count !== course.students) {
      await course.update({ students: count });
      console.log(`  ✓ ${course.title}: ${count} học viên`);
    }
  }

  console.log('\n🎉 TẠO DEMO STUDENTS HOÀN TẤT');
  console.log('Dùng thông tin đăng nhập bên trên để test.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
