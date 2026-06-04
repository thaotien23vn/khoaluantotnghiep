const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, connectDB, models } = require('./index');

async function seedFinalQuizTest() {
  try {
    await connectDB();
    console.log('🚀 Tạo seed kiểm thử Bài thi cuối (final quiz) ...');

    const { User, Course, Quiz, Question, Enrollment, Attempt } = models;

    // 1. Tạo teacher test
    let teacher = await User.findOne({ where: { email: 'test.teacher@lms.com' } });
    if (!teacher) {
      teacher = await User.create({
        email: 'test.teacher@lms.com',
        passwordHash: await bcrypt.hash('teacher123', 10),
        name: 'Teacher Test',
        username: 'test_teacher',
        role: 'teacher',
        isActive: true,
      });
      console.log('✅ Tạo giảng viên test:', teacher.email);
    } else {
      console.log('ℹ️ Dùng giảng viên sẵn có:', teacher.email);
    }

    // 2. Tạo course test
    let course = await Course.findOne({ where: { slug: 'test-final-quiz-course' } });
    if (!course) {
      course = await Course.create({
        title: 'Course Test - Final Quiz Flow',
        slug: 'test-final-quiz-course',
        description: 'Khóa học dùng để kiểm thử luồng bài thi cuối và cấp chứng chỉ.',
        createdBy: teacher.id,
        published: true,
        status: 'published',
      });
      console.log('✅ Tạo course:', course.title);
    } else {
      console.log('ℹ️ Dùng course sẵn có:', course.title);
    }

    // 3. Xoá quiz final cũ nếu có
    const oldFinal = await Quiz.findOne({ where: { courseId: course.id, type: 'final' } });
    if (oldFinal) {
      const oldQuestions = await Question.findAll({ where: { quizId: oldFinal.id } });
      const qids = oldQuestions.map(q=>q.id);
      await Attempt.destroy({ where: { quizId: oldFinal.id } });
      await Question.destroy({ where: { quizId: oldFinal.id } });
      await Quiz.destroy({ where: { id: oldFinal.id } });
      console.log('🧹 Đã xóa final quiz cũ');
    }

    // 4. Tạo final quiz mới
    const finalQuiz = await Quiz.create({
      title: 'Final Quiz - Test Certificate',
      description: 'Bài thi cuối dùng để test cấp chứng chỉ khi đạt.',
      passingScore: 60,
      timeLimit: 15,
      maxScore: 50,
      courseId: course.id,
      status: 'published',
      createdBy: teacher.id,
      type: 'final',
    });
    console.log('✅ Tạo final quiz id=', finalQuiz.id);

    // 5. Tạo 4 câu trắc nghiệm + 1 essay
    await Question.bulkCreate([
      {
        quizId: finalQuiz.id,
        content: 'Q1: Hệ thống có vai trò nào?',
        type: 'multiple_choice',
        options: JSON.stringify(['A. Student','B. Teacher','C. Admin','D. All of the above']),
        correctAnswer: 'D',
        points: 10,
      },
      {
        quizId: finalQuiz.id,
        content: 'Q2: Câu hỏi kiểm thử 2?',
        type: 'multiple_choice',
        options: JSON.stringify(['A','B','C','D']),
        correctAnswer: 'A',
        points: 10,
      },
      {
        quizId: finalQuiz.id,
        content: 'Q3: Câu hỏi kiểm thử 3?',
        type: 'short_answer',
        correctAnswer: 'đáp án mẫu',
        points: 10,
      },
      {
        quizId: finalQuiz.id,
        content: 'Q4: True or False example',
        type: 'true_false',
        correctAnswer: 'true',
        points: 10,
      },
      {
        quizId: finalQuiz.id,
        content: 'Q5: Viết 1 đoạn luận ngắn về trải nghiệm học tập',
        type: 'essay',
        points: 10,
      },
    ]);
    console.log('✅ Tạo 5 câu hỏi (4 auto, 1 essay manual)');

    // 6. Tạo 2 students: one auto-pass, one awaiting manual
    let passStudent = await User.findOne({ where: { email: 'test.student.pass@lms.com' } });
    if (!passStudent) {
      passStudent = await User.create({
        email: 'test.student.pass@lms.com',
        passwordHash: await bcrypt.hash('student123', 10),
        name: 'Student Pass',
        username: 'student_pass',
        role: 'student',
        isActive: true,
      });
      console.log('✅ Tạo học viên pass:', passStudent.email);
    }

    let waitStudent = await User.findOne({ where: { email: 'test.student.wait@lms.com' } });
    if (!waitStudent) {
      waitStudent = await User.create({
        email: 'test.student.wait@lms.com',
        passwordHash: await bcrypt.hash('student123', 10),
        name: 'Student Wait',
        username: 'student_wait',
        role: 'student',
        isActive: true,
      });
      console.log('✅ Tạo học viên chờ chấm:', waitStudent.email);
    }

    // 7. Enroll both students
    await Enrollment.findOrCreate({ where: { userId: passStudent.id, courseId: course.id }, defaults: { userId: passStudent.id, courseId: course.id, status: 'active', enrollmentStatus: 'active', progressPercent: 100 } });
    await Enrollment.findOrCreate({ where: { userId: waitStudent.id, courseId: course.id }, defaults: { userId: waitStudent.id, courseId: course.id, status: 'active', enrollmentStatus: 'active', progressPercent: 100 } });
    console.log('✅ Enroll học viên xong');

    // 8. Create attempts
    // passStudent: answer all auto questions correctly, essay left empty -> because essay causes manual grading, to simulate auto-pass we will give full points for auto questions and set passed=true and certificate will be awarded if passed===true and quiz.type==='final'

    // Find questions to craft answers
    const questions = await Question.findAll({ where: { quizId: finalQuiz.id } });
    const qMap = {};
    questions.forEach(q => { qMap[q.type === 'essay' ? 'essay' : q.id] = q; });

    // Build answers for passStudent: provide correct for 4 auto questions, leave essay blank
    const passAnswers = {};
    for (const q of questions) {
      if (q.type === 'multiple_choice' || q.type === 'true_false' || q.type === 'short_answer') {
        passAnswers[q.id] = q.correctAnswer;
      } else if (q.type === 'essay') {
        passAnswers[q.id] = '';
      }
    }

    // Create Attempt for passStudent (simulate submitted and graded)
    await Attempt.create({
      userId: passStudent.id,
      quizId: finalQuiz.id,
      answers: passAnswers,
      score: 40, // 4 auto questions *10
      percentageScore: 80,
      passed: true,
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
      completedAt: new Date(),
    });
    console.log('✅ Tạo attempt đã đạt (auto) cho', passStudent.email);

    // waitStudent: answer including essay -> should result in passed=null (waiting manual)
    const waitAnswers = {};
    for (const q of questions) {
      if (q.type === 'essay') {
        waitAnswers[q.id] = 'Đây là câu trả lời tự luận cần chấm thủ công.';
      } else {
        // purposely make some correct and some incorrect
        waitAnswers[q.id] = q.type === 'true_false' ? 'false' : (q.correctAnswer || 'A');
      }
    }

    await Attempt.create({
      userId: waitStudent.id,
      quizId: finalQuiz.id,
      answers: waitAnswers,
      score: 30, // partial
      percentageScore: 60,
      passed: null,
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
      completedAt: new Date(),
    });
    console.log('✅ Tạo attempt chờ chấm (essay) cho', waitStudent.email);

    console.log('\n🎉 Seed final-quiz-test hoàn thành!');
    console.log('Tài khoản kiểm thử:');
    console.log(` - Giảng viên: ${teacher.email} / teacher123`);
    console.log(` - Học viên đạt tự động: ${passStudent.email} / student123`);
    console.log(` - Học viên chờ chấm: ${waitStudent.email} / student123`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi seed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

seedFinalQuizTest();
