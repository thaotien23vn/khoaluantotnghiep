require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, models } = require('./src/models');

const DEMO_PASSWORD = 'demo123';

async function cleanupDemoUsers(demoEmails) {
  const {
    User, UserLearningPath, Enrollment, LectureProgress, Attempt, LevelCertificate,
    Notification, LessonMessage, ChatEscalation, ChatParticipant,
    AiMessage, AiConversation, PlacementResponse, PlacementSession,
    LearningAnalytics, UserLearningProfile, AiRecommendation,
    Review, Payment, ScheduleEvent, ForumPost, ForumReport, ForumTopic, Tracking,
  } = models;

  const users = await User.findAll({ where: { email: demoEmails }, attributes: ['id'] });
  const userIds = users.map(u => u.id);
  if (userIds.length === 0) return;

  console.log(`🧹 Xóa dữ liệu ${userIds.length} demo user(s)...`);

  // Chat & messaging
  await ChatParticipant.destroy({ where: { userId: userIds } });
  const lessonMsgs = await LessonMessage.findAll({ where: { senderId: userIds }, attributes: ['id'] });
  const lessonMsgIds = lessonMsgs.map(m => m.id);
  if (lessonMsgIds.length > 0) {
    await ChatEscalation.destroy({ where: { messageId: lessonMsgIds } });
  }
  await LessonMessage.destroy({ where: { senderId: userIds } });

  // AI
  const aiConvs = await AiConversation.findAll({ where: { userId: userIds }, attributes: ['id'] });
  const aiConvIds = aiConvs.map(c => c.id);
  if (aiConvIds.length > 0) await AiMessage.destroy({ where: { conversationId: aiConvIds } });
  await AiConversation.destroy({ where: { userId: userIds } });
  await AiRecommendation.destroy({ where: { userId: userIds } });

  // Placement
  const plSessions = await PlacementSession.findAll({ where: { userId: userIds }, attributes: ['id'] });
  const plSessionIds = plSessions.map(s => s.id);
  if (plSessionIds.length > 0) await PlacementResponse.destroy({ where: { sessionId: plSessionIds } });
  await PlacementSession.destroy({ where: { userId: userIds } });

  // Learning & progress
  await LearningAnalytics.destroy({ where: { userId: userIds } });
  await UserLearningProfile.destroy({ where: { userId: userIds } });
  await LectureProgress.destroy({ where: { userId: userIds } });
  await Attempt.destroy({ where: { userId: userIds } });
  await Tracking.destroy({ where: { userId: userIds } });

  // Enrollments & certificates
  await Enrollment.destroy({ where: { userId: userIds } });
  await UserLearningPath.destroy({ where: { userId: userIds } });
  await LevelCertificate.destroy({ where: { userId: userIds } });

  // Reviews, payments, notifications, schedule, forum
  await Review.destroy({ where: { userId: userIds } });
  await Payment.destroy({ where: { userId: userIds } });
  await Notification.destroy({ where: { userId: userIds } });
  await ScheduleEvent.destroy({ where: { createdBy: userIds } });
  const forumPosts = await ForumPost.findAll({ where: { userId: userIds }, attributes: ['id'] });
  const forumPostIds = forumPosts.map(p => p.id);
  if (forumPostIds.length > 0) {
    await ForumReport.destroy({ where: { postId: forumPostIds } });
  }
  await ForumPost.destroy({ where: { userId: userIds } });
  await ForumTopic.destroy({ where: { userId: userIds } });
  await ForumReport.destroy({ where: { reporterId: userIds } });

  // User
  await User.destroy({ where: { id: userIds } });

  console.log('🧹 Đã reset xong demo users');
}

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

async function createPlacementSession(userId, level) {
  const { PlacementSession } = models;
  const levelScore = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
  const score = levelScore[level] || 3;
  await PlacementSession.findOrCreate({
    where: { userId, finalCefrLevel: level },
    defaults: {
      userId,
      selfAssessedLevel: level,
      status: 'completed',
      currentCefrLevel: level,
      abilityScore: score,
      questionCount: 20 + Math.floor(Math.random() * 10),
      correctCount: 15 + Math.floor(Math.random() * 8),
      streakCorrect: 5 + Math.floor(Math.random() * 5),
      streakWrong: Math.floor(Math.random() * 3),
      finalCefrLevel: level,
      confidenceScore: 0.7 + Math.random() * 0.25,
      startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      lastActivityAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
  });
}

async function createUserLearningProfile(userId, courseId, progress) {
  const { UserLearningProfile } = models;
  const styles = ['visual', 'auditory', 'kinesthetic', 'reading'];
  const style = styles[Math.floor(Math.random() * styles.length)];
  const studyTime = progress === 100 ? 1200 + Math.floor(Math.random() * 800) : Math.floor((progress / 100) * 1200);
  await UserLearningProfile.findOrCreate({
    where: { userId, courseId },
    defaults: {
      userId,
      courseId,
      learningStyle: style,
      difficultyPreference: 'adaptive',
      averageScore: progress >= 80 ? 75 + Math.random() * 20 : 50 + Math.random() * 25,
      totalStudyTime: studyTime,
      completedLectures: Math.floor((progress / 100) * 10),
      totalLectures: 10,
      lastActivityAt: new Date(),
      preferredStudyTime: ['morning', 'afternoon', 'evening', 'night'][Math.floor(Math.random() * 4)],
      weakTopics: progress < 60 ? JSON.stringify(['grammar', 'vocabulary']) : JSON.stringify([]),
      strongTopics: progress > 70 ? JSON.stringify(['listening', 'speaking']) : JSON.stringify([]),
      goals: JSON.stringify({ weeklyHours: 5, targetLevel: 'B2' }),
      preferences: JSON.stringify({ subtitles: true, speed: 'normal' }),
    },
  });
}

async function createLearningAnalytics(userId, courseId, lectures, progress) {
  const { LearningAnalytics } = models;
  if (progress <= 0 || lectures.length === 0) return;
  const count = Math.ceil((lectures.length * progress) / 100);
  const completedLectures = lectures.slice(0, count);
  for (let i = 0; i < completedLectures.length; i++) {
    const lec = completedLectures[i];
    await LearningAnalytics.create({
      userId,
      courseId,
      lectureId: lec.id,
      eventType: 'lecture_complete',
      duration: 300 + Math.floor(Math.random() * 600),
      score: null,
      maxScore: null,
      attempts: 1,
      difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)],
      deviceType: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
      sessionId: `demo-session-${userId}-${courseId}`,
    });
    if (i % 3 === 0) {
      await LearningAnalytics.create({
        userId,
        courseId,
        lectureId: lec.id,
        eventType: 'quiz_complete',
        duration: 120 + Math.floor(Math.random() * 300),
        score: 70 + Math.floor(Math.random() * 30),
        maxScore: 100,
        attempts: 1 + Math.floor(Math.random() * 2),
        difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)],
        deviceType: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
        sessionId: `demo-session-${userId}-${courseId}`,
      });
    }
  }
}

async function createNotifications(userId, courseTitle) {
  const { Notification } = models;
  const notifs = [
    { type: 'enrollment', title: 'Đăng ký khóa học thành công', message: `Bạn đã đăng ký thành công khóa học ${courseTitle}.` },
    { type: 'study_reminder', title: 'Nhắc nhở học tập', message: 'Đừng quên học bài hôm nay để duy trì tiến độ!' },
    { type: 'course_update', title: 'Khóa học có cập nhật mới', message: `Khóa học ${courseTitle} vừa có bài giảng mới.` },
  ];
  for (const n of notifs) {
    await Notification.create({
      userId,
      type: n.type,
      title: n.title,
      message: n.message,
      payload: {},
      read: Math.random() > 0.5,
    });
  }
}

async function createReviews(userId, courseId, progress) {
  const { Review } = models;
  if (progress < 100) return;
  const comments = [
    'Khóa học rất hữu ích, giáo viên giảng dạy dễ hiểu và nội dung phong phú.',
    'Nội dung bài học được trình bày rõ ràng, phù hợp với trình độ của tôi.',
    'Rất thích cách học tập trên nền tảng này, sẽ giới thiệu cho bạn bè.',
    'Bài tập và quiz giúp củng cố kiến thức rất tốt.',
  ];
  await Review.findOrCreate({
    where: { userId, courseId },
    defaults: {
      userId,
      courseId,
      rating: 4 + Math.floor(Math.random() * 2),
      comment: comments[Math.floor(Math.random() * comments.length)],
    },
  });
}

async function createPayments(userId, courseId, courseTitle) {
  const { Payment } = models;
  await Payment.findOrCreate({
    where: { userId, courseId, provider: 'vnpay' },
    defaults: {
      userId,
      courseId,
      amount: 299000 + Math.floor(Math.random() * 200000),
      currency: 'VND',
      provider: 'vnpay',
      providerTxn: `DEMO-${Date.now()}-${userId}`,
      status: 'completed',
      paymentDetails: { courseTitle, method: 'VNPAY', demo: true },
    },
  });
}

async function createAiConversation(userId, courseId, courseTitle) {
  const { AiConversation, AiMessage } = models;
  const [conv] = await AiConversation.findOrCreate({
    where: { userId, courseId, role: 'student' },
    defaults: {
      userId,
      role: 'student',
      courseId,
      lectureId: null,
      title: `Hỏi đáp: ${courseTitle}`,
    },
  });
  const existingMsgs = await AiMessage.count({ where: { conversationId: conv.id } });
  if (existingMsgs === 0) {
    await AiMessage.create({
      conversationId: conv.id,
      sender: 'user',
      content: 'Tôi không hiểu phần ngữ pháp này lắm, bạn có thể giải thích không?',
    });
    await AiMessage.create({
      conversationId: conv.id,
      sender: 'ai',
      content: `Chào bạn! Ngữ pháp trong bài học này tập trung vào cấu trúc thì hiện tại đơn. Bạn có thể nghĩ đơn giản là hành động xảy ra thường xuyên. Nếu cần ví dụ cụ thể, hãy cho tôi biết nhé!`,
    });
  }
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

    // New: learning profile, analytics, reviews, payments, AI chat
    await createUserLearningProfile(user.id, course.id, enrollCfg.progress);
    await createLearningAnalytics(user.id, course.id, course.lectures, enrollCfg.progress);
    await createReviews(user.id, course.id, enrollCfg.progress);
    if (!enrollCfg.expired && !enrollCfg.gracePeriod) {
      await createPayments(user.id, course.id, course.title);
    }
    if (enrollCfg.progress > 0) {
      await createAiConversation(user.id, course.id, course.title);
    }
    if (enrollCfg.progress > 0) {
      await createNotifications(user.id, course.title);
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

  // 6. Placement test session (skip if explicitly disabled)
  if (!demo.noPlacement) {
    await createPlacementSession(user.id, demo.level);
    console.log(`  📝 Placement test: ${demo.level}`);
  } else {
    console.log(`  ⏭️  Bỏ qua placement test (noPlacement=true)`);
  }

  console.log(`  ✅ Done — đăng nhập: ${demo.email} / ${DEMO_PASSWORD}`);
}

async function main() {
  await sequelize.authenticate();
  console.log('✅ DB connected');

  const demos = [
    // ========== A1 ==========
    // 2 học viên chưa làm placement test
    {
      name: 'Học viên A1 Chưa placement (1)',
      email: 'student_a1_noplace1@demo.com',
      level: 'A1',
      noPlacement: true,
      enrollments: [],
    },
    {
      name: 'Học viên A1 Chưa placement (2)',
      email: 'student_a1_noplace2@demo.com',
      level: 'A1',
      noPlacement: true,
      enrollments: [],
    },
    // Học viên xong 4 môn bắt buộc A1, chờ làm final test
    {
      name: 'Học viên A1 Xong 4 môn chờ Final',
      email: 'student_a1_final@demo.com',
      level: 'A1',
      enrollments: [
        { courseIndex: 0, progress: 100 },
        { courseIndex: 1, progress: 100 },
        { courseIndex: 2, progress: 100 },
        { courseIndex: 3, progress: 100 },
      ],
      // Chưa có levelCertificates — sẽ làm final test sau
    },
    // Học viên hết hạn khóa học
    {
      name: 'Học viên A1 Hết hạn',
      email: 'student_a1_expired@demo.com',
      level: 'A1',
      enrollments: [
        { courseIndex: 0, progress: 40, expired: true },
      ],
    },

    // ========== A2 ==========
    {
      name: 'Học viên A2 Đang học',
      email: 'student_a2_half@demo.com',
      level: 'A2',
      enrollments: [
        { courseIndex: 0, progress: 30 },
        { courseIndex: 1, progress: 10 },
      ],
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
      name: 'Học viên A2 Hoàn thành',
      email: 'student_a2_done@demo.com',
      level: 'A2',
      enrollments: [
        { courseIndex: 0, progress: 100 },
        { courseIndex: 1, progress: 100 },
        { courseIndex: 2, progress: 100 },
        { courseIndex: 3, progress: 100 },
      ],
      levelCertificates: ['A2'],
    },

    // ========== B1 ==========
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
      name: 'Học viên B1 Hết hạn',
      email: 'student_b1_expired@demo.com',
      level: 'B1',
      enrollments: [
        { courseIndex: 0, progress: 60, expired: true },
      ],
    },
    {
      name: 'Học viên B1 Grace Period',
      email: 'student_b1_grace@demo.com',
      level: 'B1',
      enrollments: [
        { courseIndex: 0, progress: 60, gracePeriod: true },
      ],
    },
    {
      name: 'Học viên B1 Quiz Failed',
      email: 'student_b1_quizfail@demo.com',
      level: 'B1',
      enrollments: [
        { courseIndex: 0, progress: 80, quizFail: true },
        { courseIndex: 1, progress: 60 },
      ],
    },

    // ========== B2 ==========
    {
      name: 'Học viên B2 Đang học',
      email: 'student_b2_half@demo.com',
      level: 'B2',
      enrollments: [
        { courseIndex: 0, progress: 25 },
        { courseIndex: 1, progress: 10 },
      ],
    },
    {
      name: 'Học viên B2 Hoàn thành',
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
      name: 'Học viên B2 Hết hạn',
      email: 'student_b2_expired@demo.com',
      level: 'B2',
      enrollments: [
        { courseIndex: 0, progress: 30, expired: true },
      ],
    },

    // ========== C1 ==========
    {
      name: 'Học viên C1 Đang học',
      email: 'student_c1_half@demo.com',
      level: 'C1',
      enrollments: [
        { courseIndex: 0, progress: 60 },
        { courseIndex: 1, progress: 10 },
      ],
    },
    {
      name: 'Học viên C1 Hoàn thành',
      email: 'student_c1_done@demo.com',
      level: 'C1',
      enrollments: [
        { courseIndex: 0, progress: 100 },
        { courseIndex: 1, progress: 100 },
        { courseIndex: 2, progress: 100 },
        { courseIndex: 3, progress: 100 },
      ],
      levelCertificates: ['C1'],
    },

    // ========== C2 ==========
    {
      name: 'Học viên C2 Đang học',
      email: 'student_c2_half@demo.com',
      level: 'C2',
      enrollments: [
        { courseIndex: 0, progress: 10 },
      ],
    },
    {
      name: 'Học viên C2 Full CEFR',
      email: 'student_c2_full@demo.com',
      level: 'C2',
      allLevels: true,
      levelCertificates: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    },

    // ========== Edge Cases ==========
    {
      name: 'Chưa có lộ trình',
      email: 'student_no_path@demo.com',
      level: 'A1',
      noPath: true,
      enrollments: [],
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
  ];

  const demoEmails = demos.map(d => d.email);
  await cleanupDemoUsers(demoEmails);

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
