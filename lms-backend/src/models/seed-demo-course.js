const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, connectDB, models } = require('./index');

async function seedDemoCourse() {
  try {
    await connectDB();
    console.log('🎯 Tạo khóa học demo...\n');

    const { User, Category, Course, Chapter, Lecture, Quiz, Question } = models;

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
    const course = await Course.create({
      title: 'Khóa học Demo - Hướng dẫn sử dụng Hệ thống LMS',
      slug: 'khoa-hoc-demo-he-thong-lms',
      description: 'Khóa học demo đơn giản với 1 chương, 1 bài giảng, 1 quiz chương và 1 bài thi cuối kỳ. Dùng để kiểm thử luồng học tập cơ bản.',
      level: 'beginner',
      price: 0,
      duration: '1 giờ',
      imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80',
      categoryId: category.id,
      status: 'published',
      published: true,
      createdBy: teacher.id,
      willLearn: JSON.stringify([
        'Hiểu cách đăng ký khóa học',
        'Xem bài giảng và theo dõi tiến độ',
        'Làm quiz chương và bài thi cuối kỳ',
        'Nhận chứng chỉ hoàn thành',
      ]),
      requirements: JSON.stringify([
        'Người dùng mới muốn làm quen hệ thống',
        'Tester kiểm thử luồng học tập',
      ]),
    });
    console.log('✅ Khóa học:', course.title);

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
      contentUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
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

    console.log('\n🎉 Khóa học demo đã sẵn sàng!');
    console.log(`   ID khóa học: ${course.id}`);
    console.log(`   ID giảng viên: ${teacher.id}`);
    console.log(`   Tài khoản giảng viên: ${teacher.email} / demo123`);
    console.log('\n👉 Bạn có thể đăng nhập bằng tài khoản student đã có và đăng ký khóa học này để kiểm thử.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seedDemoCourse();
