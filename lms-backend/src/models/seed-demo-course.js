const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, connectDB, models } = require('./index');

async function seedDemoCourse() {
  try {
    await connectDB();
    console.log('🎯 Tạo khóa học demo...\n');

    const { User, Category, Course, Chapter, Lecture, Quiz, Question, Enrollment, Payment, Attempt, Review, LectureProgress } = models;

    // 0. Xoá dữ liệu demo cũ
    console.log('🧹 Đang xoá dữ liệu demo cũ...\n');
    const oldCourse = await Course.findOne({ where: { slug: 'khoa-hoc-demo-he-thong-lms' } });
    if (oldCourse) {
      const oldQuizzes = await Quiz.findAll({ where: { courseId: oldCourse.id }, attributes: ['id'] });
      const quizIds = oldQuizzes.map(q => q.id);
      const oldChapters = await Chapter.findAll({ where: { courseId: oldCourse.id }, attributes: ['id'] });
      const chapterIds = oldChapters.map(c => c.id);

      await Attempt.destroy({ where: { quizId: quizIds } });
      await LectureProgress.destroy({ where: { courseId: oldCourse.id } });
      await Review.destroy({ where: { courseId: oldCourse.id } });
      await Payment.destroy({ where: { courseId: oldCourse.id } });
      await Question.destroy({ where: { quizId: quizIds } });
      await Enrollment.destroy({ where: { courseId: oldCourse.id } });
      await Quiz.destroy({ where: { courseId: oldCourse.id } });
      await Lecture.destroy({ where: { chapterId: chapterIds } });
      await Chapter.destroy({ where: { courseId: oldCourse.id } });
      await Course.destroy({ where: { id: oldCourse.id } });
      console.log('✅ Đã xoá khóa học demo cũ');
    }

    const oldStudent = await User.findOne({ where: { email: 'demo.student@lms.com' } });
    if (oldStudent) {
      await Payment.destroy({ where: { userId: oldStudent.id } });
      await Enrollment.destroy({ where: { userId: oldStudent.id } });
      await Attempt.destroy({ where: { userId: oldStudent.id } });
      await LectureProgress.destroy({ where: { userId: oldStudent.id } });
      await Review.destroy({ where: { userId: oldStudent.id } });
      await User.destroy({ where: { id: oldStudent.id } });
      console.log('✅ Đã xoá học viên demo cũ');
    }
    console.log('');

    // 1. Tạo giảng viên demo (nếu chưa có)
    let teacher = await User.findOne({ where: { email: 'demo.teacher@lms.com' } });
    if (!teacher) {
      teacher = await User.create({
        email: 'demo.teacher@lms.com',
        passwordHash: await bcrypt.hash('demo123', 10),
        name: 'Giảng viên Demo',
        username: 'demo_teacher',
        role: 'teacher',
        isActive: true,
        phone: '0900000000',
        avatar: '',
      });
      console.log('✅ Giảng viên demo:', teacher.email);
    } else {
      console.log('✅ Dùng giảng viên demo có sẵn:', teacher.email);
    }

    // 2. Tạo category demo (nếu chưa có)
    let category = await Category.findOne({ where: { name: 'Demo & Kiểm thử' } });
    if (!category) {
      category = await Category.create({
        name: 'Demo & Kiểm thử',
        description: 'Danh mục dành cho các khóa học demo và kiểm thử hệ thống.',
        icon: 'Beaker',
        isActive: true,
      });
      console.log('✅ Category demo:', category.name);
    } else {
      console.log('✅ Dùng category demo có sẵn:', category.name);
    }

    // 3. Tạo khóa học
    let course = await Course.findOne({ where: { slug: 'khoa-hoc-demo-he-thong-lms' } });
    if (!course) {
      course = await Course.create({
        title: 'Khóa học Demo - Hướng dẫn sử dụng Hệ thống LMS',
        slug: 'khoa-hoc-demo-he-thong-lms',
        description: 'Khóa học demo đơn giản với 1 chương, 1 bài giảng, 1 quiz chương và 1 bài thi cuối kỳ. Dùng để kiểm thử luồng học tập cơ bản.',
        level: 'beginner',
        price: 500000,
        duration: '1 giờ',
        imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80',
        categoryId: category.id,
        status: 'published',
        published: true,
        createdBy: teacher.id,
        durationType: 'fixed',
        durationValue: 3,
        durationUnit: 'months',
        willLearn: [
          'Hiểu cách đăng ký khóa học',
          'Xem bài giảng và theo dõi tiến độ',
          'Làm quiz chương và bài thi cuối kỳ',
          'Nhận chứng chỉ hoàn thành',
        ],
        requirements: [
          'Người dùng mới muốn làm quen hệ thống',
          'Tester kiểm thử luồng học tập',
        ],
      });
      console.log('✅ Khóa học đã tạo:', course.title);
    } else {
      console.log('✅ Dùng khóa học demo có sẵn:', course.title);
    }

    // 4. Tạo chương
    const chapter = await Chapter.create({
      title: 'Chương 1: Làm quen với Hệ thống',
      description: 'Chương duy nhất của khóa học demo.',
      courseId: course.id,
      order: 1,
    });
    console.log('✅ Chương:', chapter.title);

    // 5. Tạo bài giảng
    const lecture = await Lecture.create({
      title: 'Bài 1: Hướng dẫn sử dụng cơ bản',
      type: 'video',
      duration: 600,
      contentUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      chapterId: chapter.id,
      order: 1,
      isPreview: true,
    });
    console.log('✅ Bài giảng:', lecture.title);

    // 6. Tạo quiz chương (3 câu)
    const chapterQuiz = await Quiz.create({
      title: 'Quiz Chương 1',
      description: 'Kiểm tra kiến thức sau khi xem bài giảng.',
      passingScore: 70,
      timeLimit: 5,
      chapterId: chapter.id,
      courseId: course.id,
      status: 'published',
      createdBy: teacher.id,
      type: 'chapter',
    });

    await Question.bulkCreate([
      {
        quizId: chapterQuiz.id,
        content: 'Câu 1: Để đăng ký khóa học, bạn cần làm gì?',
        type: 'multiple_choice',
        options: JSON.stringify(['A. Đăng nhập tài khoản','B. Thanh toán phí','C. Cả A và B tùy loại khóa','D. Không cần làm gì']),
        correctAnswer: 'C',
        points: 10,
      },
      {
        quizId: chapterQuiz.id,
        content: 'Câu 2: Tiến độ bài học được tính dựa trên yếu tố nào?',
        type: 'multiple_choice',
        options: JSON.stringify(['A. Thời gian xem video','B. Phần trăm video đã xem','C. Số lần click chuột','D. Số bình luận']),
        correctAnswer: 'B',
        points: 10,
      },
      {
        quizId: chapterQuiz.id,
        content: 'Câu 3: Điểm đạt quiz tối thiểu là bao nhiêu?',
        type: 'multiple_choice',
        options: JSON.stringify(['A. 50%','B. 60%','C. 70%','D. 80%']),
        correctAnswer: 'C',
        points: 10,
      },
    ]);
    console.log('✅ Quiz chương: 3 câu hỏi');

    // 7. Tạo bài thi cuối kỳ (5 câu)
    const finalExam = await Quiz.create({
      title: 'Bài thi cuối kỳ - Kiểm tra tổng hợp',
      description: 'Bài thi tổng hợp kiến thức toàn khóa học demo.',
      passingScore: 70,
      timeLimit: 10,
      maxScore: 50,
      maxAttempts: 3,
      chapterId: null,
      courseId: course.id,
      status: 'published',
      createdBy: teacher.id,
      type: 'final',
    });

    await Question.bulkCreate([
      {
        quizId: finalExam.id,
        content: 'Câu 1: Hệ thống LMS này hỗ trợ những vai trò nào?',
        type: 'multiple_choice',
        options: JSON.stringify(['A. Học viên','B. Giảng viên','C. Quản trị viên','D. Tất cả các vai trò trên']),
        correctAnswer: 'D',
        points: 10,
      },
      {
        quizId: finalExam.id,
        content: 'Câu 2: Sau khi hoàn thành 80% khóa học, bạn có thể làm gì?',
        type: 'multiple_choice',
        options: JSON.stringify(['A. Xem tiếp bài giảng','B. Đánh giá khóa học','C. Nhận chứng chỉ','D. Cả B và C']),
        correctAnswer: 'D',
        points: 10,
      },
      {
        quizId: finalExam.id,
        content: 'Câu 3: Chứng chỉ hoàn thành được cấp khi nào?',
        type: 'multiple_choice',
        options: JSON.stringify(['A. Sau khi đăng ký','B. Sau khi xem hết video','C. Sau khi đạt bài thi cuối kỳ','D. Sau 30 ngày']),
        correctAnswer: 'C',
        points: 10,
      },
      {
        quizId: finalExam.id,
        content: 'Câu 4: Forum trong khóa học dùng để làm gì?',
        type: 'multiple_choice',
        options: JSON.stringify(['A. Chat trực tiếp','B. Đặt câu hỏi và thảo luận','C. Xem điểm số','D. Tải tài liệu']),
        correctAnswer: 'B',
        points: 10,
      },
      {
        quizId: finalExam.id,
        content: 'Câu 5: Khóa học miễn phí có cần thanh toán không?',
        type: 'multiple_choice',
        options: JSON.stringify(['A. Có, luôn luôn','B. Không, chỉ cần đăng ký','C. Tùy vào giảng viên','D. Chỉ thanh toán khi lấy chứng chỉ']),
        correctAnswer: 'B',
        points: 10,
      },
    ]);
    console.log('✅ Final Exam: 5 câu hỏi');

    // 8. Tạo học viên demo
    let student = await User.findOne({ where: { email: 'demo.student@lms.com' } });
    if (!student) {
      student = await User.create({
        email: 'demo.student@lms.com',
        passwordHash: await bcrypt.hash('demo123', 10),
        name: 'Học viên Demo',
        username: 'demo_student',
        role: 'student',
        isActive: true,
        phone: '0900000001',
        avatar: '',
      });
      console.log('✅ Học viên demo:', student.email);
    } else {
      console.log('✅ Dùng học viên demo có sẵn:', student.email);
    }

    // 9. Tạo enrollment đã HẾT HẠN (để demo chức năng gia hạn)
    const [expiredEnrollment] = await Enrollment.findOrCreate({
      where: { userId: student.id, courseId: course.id },
      defaults: {
        userId: student.id,
        courseId: course.id,
        status: 'active',
        enrollmentType: 'paid',
        enrollmentStatus: 'expired',
        progressPercent: 65,
        enrolledAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // 120 ngày trước
        expiresAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),   // Hết hạn 30 ngày trước
        gracePeriodEndsAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Grace hết 7 ngày trước
      },
    });
    if (expiredEnrollment.isNewRecord !== false) {
      console.log('✅ Enrollment hết hạn đã tạo');
    } else {
      // Cập nhật lại thành expired nếu đã tồn tại
      await Enrollment.update(
        {
          enrollmentStatus: 'expired',
          expiresAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          gracePeriodEndsAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        { where: { id: expiredEnrollment.id } }
      );
      console.log('✅ Enrollment đã cập nhật thành hết hạn');
    }

    // Tạo payment cho enrollment này
    const existingPayment = await Payment.findOne({
      where: { userId: student.id, courseId: course.id, status: 'completed' },
    });
    if (!existingPayment) {
      await Payment.create({
        userId: student.id,
        courseId: course.id,
        amount: 0,
        currency: 'USD',
        provider: 'mock',
        providerTxn: `DEMO-EXPIRED-${Date.now()}`,
        status: 'completed',
        paymentDetails: { source: 'demo', note: 'expired enrollment demo' },
      });
      console.log('✅ Payment cho enrollment hết hạn');
    }

    // 10. Tạo học viên SẮP THI CUỐI KHÓA (progress 85%, đủ điều kiện làm bài thi)
    let finalStudent = await User.findOne({ where: { email: 'demo.student.final@lms.com' } });
    if (!finalStudent) {
      finalStudent = await User.create({
        email: 'demo.student.final@lms.com',
        passwordHash: await bcrypt.hash('demo123', 10),
        name: 'Học viên Sắp Thi',
        username: 'demo_student_final',
        role: 'student',
        isActive: true,
        phone: '0900000002',
        avatar: '',
      });
      console.log('✅ Học viên sắp thi:', finalStudent.email);
    } else {
      console.log('✅ Dùng học viên sắp thi có sẵn:', finalStudent.email);
    }

    const [finalEnrollment] = await Enrollment.findOrCreate({
      where: { userId: finalStudent.id, courseId: course.id },
      defaults: {
        userId: finalStudent.id,
        courseId: course.id,
        status: 'active',
        enrollmentType: 'paid',
        enrollmentStatus: 'active',
        progressPercent: 100,
        enrolledAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 ngày trước
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),   // Còn 30 ngày
        gracePeriodEndsAt: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
      },
    });
    await Enrollment.update(
      {
        enrollmentStatus: 'active',
        progressPercent: 100,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        gracePeriodEndsAt: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
      },
      { where: { id: finalEnrollment.id } }
    );
    console.log('✅ Enrollment sắp thi: 100% progress, đủ điều kiện làm bài thi cuối kỳ');

    // Tạo lecture progress cho học viên sắp thi
    const finalLectureProgress = await LectureProgress.findOne({
      where: { userId: finalStudent.id, lectureId: lecture.id },
    });
    if (!finalLectureProgress) {
      await LectureProgress.create({
        userId: finalStudent.id,
        courseId: course.id,
        lectureId: lecture.id,
        watchTime: 600, // 10 phút / 10 phút
        completed: true,
        percentWatched: 100,
        lastWatchedAt: new Date(),
      });
      console.log('✅ Lecture progress cho học viên sắp thi');
    }

    // Tạo quiz attempt cho học viên sắp thi (đạt quiz chương)
    const finalQuizAttempt = await Attempt.findOne({
      where: { userId: finalStudent.id, quizId: chapterQuiz.id },
    });
    if (!finalQuizAttempt) {
      await Attempt.create({
        userId: finalStudent.id,
        quizId: chapterQuiz.id,
        score: 30, // 30/30
        maxScore: 30,
        percentage: 100,
        status: 'passed',
        answers: JSON.stringify({}),
        startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
      });
      console.log('✅ Quiz attempt cho học viên sắp thi (đạt 100%)');
    }

    // Payment cho học viên sắp thi
    const finalPayment = await Payment.findOne({
      where: { userId: finalStudent.id, courseId: course.id, status: 'completed' },
    });
    if (!finalPayment) {
      await Payment.create({
        userId: finalStudent.id,
        courseId: course.id,
        amount: 500000,
        currency: 'VND',
        provider: 'mock',
        providerTxn: `DEMO-FINAL-${Date.now()}`,
        status: 'completed',
        paymentDetails: { source: 'demo', note: 'final exam ready student' },
      });
      console.log('✅ Payment cho học viên sắp thi');
    }

    // 11. Tạo học viên ĐANG HỌC (progress 45%, đang học giữa chừng)
    let learningStudent = await User.findOne({ where: { email: 'demo.student.learning@lms.com' } });
    if (!learningStudent) {
      learningStudent = await User.create({
        email: 'demo.student.learning@lms.com',
        passwordHash: await bcrypt.hash('demo123', 10),
        name: 'Học viên Đang Học',
        username: 'demo_student_learning',
        role: 'student',
        isActive: true,
        phone: '0900000003',
        avatar: '',
      });
      console.log('✅ Học viên đang học:', learningStudent.email);
    } else {
      console.log('✅ Dùng học viên đang học có sẵn:', learningStudent.email);
    }

    const [learningEnrollment] = await Enrollment.findOrCreate({
      where: { userId: learningStudent.id, courseId: course.id },
      defaults: {
        userId: learningStudent.id,
        courseId: course.id,
        status: 'active',
        enrollmentType: 'paid',
        enrollmentStatus: 'active',
        progressPercent: 45,
        enrolledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 ngày trước
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),   // Còn 60 ngày
        gracePeriodEndsAt: new Date(Date.now() + 67 * 24 * 60 * 60 * 1000),
      },
    });
    await Enrollment.update(
      {
        enrollmentStatus: 'active',
        progressPercent: 45,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        gracePeriodEndsAt: new Date(Date.now() + 67 * 24 * 60 * 60 * 1000),
      },
      { where: { id: learningEnrollment.id } }
    );
    console.log('✅ Enrollment đang học: 45% progress');

    // Tạo lecture progress cho học viên đang học
    const learningLectureProgress = await LectureProgress.findOne({
      where: { userId: learningStudent.id, lectureId: lecture.id },
    });
    if (!learningLectureProgress) {
      await LectureProgress.create({
        userId: learningStudent.id,
        courseId: course.id,
        lectureId: lecture.id,
        watchTime: 270, // 4.5 phút / 10 phút
        completed: false,
        percentWatched: 45,
        lastWatchedAt: new Date(),
      });
      console.log('✅ Lecture progress cho học viên đang học');
    }

    // Payment cho học viên đang học
    const learningPayment = await Payment.findOne({
      where: { userId: learningStudent.id, courseId: course.id, status: 'completed' },
    });
    if (!learningPayment) {
      await Payment.create({
        userId: learningStudent.id,
        courseId: course.id,
        amount: 500000,
        currency: 'VND',
        provider: 'mock',
        providerTxn: `DEMO-LEARNING-${Date.now()}`,
        status: 'completed',
        paymentDetails: { source: 'demo', note: 'learning student' },
      });
      console.log('✅ Payment cho học viên đang học');
    }

    console.log('\n🎉 Khóa học demo đã sẵn sàng!');
    console.log(`   ID khóa học: ${course.id}`);
    console.log(`   ID giảng viên: ${teacher.id}`);
    console.log(`   Tài khoản giảng viên: ${teacher.email} / demo123`);
    console.log('\n👉 Danh sách tài khoản học viên demo:');
    console.log(`   1. Hết hạn cần gia hạn  : ${student.email} / demo123`);
    console.log(`   2. Sắp thi cuối kỳ      : ${finalStudent.email} / demo123`);
    console.log(`   3. Đang học giữa chừng  : ${learningStudent.email} / demo123`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seedDemoCourse();
