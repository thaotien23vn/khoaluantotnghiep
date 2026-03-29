const db = require('../../models');
const aiGateway = require('../../services/aiGateway.service');
const logger = require('../../utils/logger');

const { Course, Chapter, Lecture, Quiz, Question, Enrollment, User } = db.models;

// Content cleaning utility
function cleanContent(content) {
  if (!content || typeof content !== 'string') return content;
  
  return content
    // Convert escaped characters to actual characters (fix AI response with \\n instead of real newlines)
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    // Remove common AI response prefixes
    .replace(/^(Chào bạn,?\s*)?(với tư cách là|tôi là|tôi rất hào hứng|tôi sẽ giúp|dưới đây là|đây là)[^\n]*\n*/gi, '')
    // Remove markdown code block markers if content is wrapped in them
    .replace(/^```(?:markdown|text)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    // Clean up multiple consecutive newlines
    .replace(/\n{4,}/g, '\n\n\n')
    // Remove trailing spaces
    .replace(/[ \t]+$/gm, '')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Trim
    .trim();
}

class AiTeachingAssistantService {
  /**
   * Generate teaching guide/lesson plan for a lecture
   */
  async generateTeachingGuide(lectureId, teacherId, options = {}) {
    try {
      const {
        classDuration = 60,
        classSize = 30,
        teachingMode = 'offline',
        studentLevel = 'intermediate',
      } = options;

      const lecture = await Lecture.findByPk(lectureId, {
        include: [
          {
            model: Chapter,
            as: 'chapter',
            include: [
              {
                model: Course,
                attributes: ['id', 'title', 'description', 'category'],
              },
            ],
          },
        ],
      });

      if (!lecture) {
        throw {
          status: 404,
          message: 'Không tìm thấy lecture',
          code: 'LECTURE_NOT_FOUND',
        };
      }

      const systemPrompt = `Bạn là một Trợ lý Giảng dạy AI chuyên nghiệp, hỗ trợ giáo viên xây dựng giáo án chất lượng cao.
Nội dung phải THỰC TẾ, ÁP DỤNG ĐƯỢC NGAY trong lớp học.`;

      const prompt = `Tạo GIÁO ÁN CHI TIẾT cho giáo viên:

THÔNG TIN LỚP HỌC:
- Môn: ${lecture.chapter.Course.title}
- Bài: ${lecture.title}
- Thời lượng: ${classDuration} phút
- Sĩ số: ${classSize} học sinh
- Hình thức: ${teachingMode}
- Trình độ: ${studentLevel}

NỘI DUNG BÀI HỌC:
${lecture.content || lecture.aiNotes || 'Chưa có nội dung'}

YÊU CẦU GIÁO ÁN:

## 1. TỔNG QUAN (2 phút)
- Mục tiêu bài học (kiến thức, kỹ năng, thái độ)
- Chuẩn bị của GV: Tài liệu, slides, props
- Chuẩn bị của HS: Kiến thức nền cần có

## 2. TIẾN TRÌNH BÀI HỌC (${classDuration} phút)

| Thời gian | Hoạt động GV | Hoạt động HS | Nội dung/Câu hỏi gợi mở |
|-----------|-------------|-------------|------------------------|
| 0-5 min | ... | ... | Warm-up/Hook |
| 5-15 min | ... | ... | Presentation |
| ... | ... | ... | ... |

### 🔥 WARM-UP (5 phút)
- Hoạt động khởi động cụ thể
- Câu hỏi gợi mở chính xác
- Cách chuyển vào nội dung

### 📖 PRESENTATION (15-20 phút)
- Nội dung trình bày chính
- Ví dụ minh họa
- Câu hỏi kiểm tra hiểu biết giữa giờ

### 🎯 PRACTICE (15-20 phút)
- Hoạt động 1: Pair work - Chi tiết hướng dẫn
- Hoạt động 2: Group work - Phân nhóm, nhiệm vụ
- Giám sát và hỗ trợ: GV đi vòng quanh, lưu ý gì

### 🏆 PRODUCTION (10-15 phút)
- Hoạt động thực hành sản phẩm
- Cách tổ chức presentation/feedback

### 🔚 WRAP-UP (5 phút)
- Tóm tắt bài học
- Giao bài tập về nhà
- Preview bài sau

## 3. XỬ LÝ TÌNH HUỐNG
- HS không hiểu: Làm gì?
- HS nhanh quá: Bổ sung gì?
- HS chậm quá: Hỗ trợ thế nào?
- Mất trật tự: Xử lý ra sao?

## 4. ĐÁNH GIÁ
- Câu hỏi kiểm tra cuối giờ
- Cách đánh giá năng lực HS
- Rubric chấm điểm (nếu có)

## 5. TÀI LIỆU THAM KHẢO
- Links, videos, bài đọc thêm

Format: Markdown rõ ràng, có thể copy-paste vào giáo án.`;

      const aiResponse = await aiGateway.generateText({
        system: systemPrompt,
        prompt,
        maxOutputTokens: 4096,
        timeoutMs: 120000,
      });

      const content = cleanContent(aiResponse.text);

      logger.info('TEACHING_GUIDE_GENERATED', {
        lectureId,
        teacherId,
        courseId: lecture.chapter.Course.id,
      });

      return {
        content,
        metadata: {
          lectureId,
          lectureTitle: lecture.title,
          courseTitle: lecture.chapter.Course.title,
          classDuration,
          classSize,
          teachingMode,
          studentLevel,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      logger.error('TEACHING_GUIDE_GENERATION_FAILED', {
        lectureId,
        teacherId,
        options,
        error: error.message,
      });
      throw {
        status: error.status || 500,
        message: error.message || 'Không thể tạo giáo án',
        code: error.code || 'TEACHING_GUIDE_GENERATION_FAILED',
      };
    }
  }

  /**
   * Generate personalized student feedback suggestions for teacher
   */
  async generateStudentFeedbackSuggestions(courseId, teacherId, options = {}) {
    try {
      const {
        studentId,
        feedbackType = 'general',
        assignmentId,
      } = options;

      const course = await Course.findByPk(courseId);
      if (!course) {
        throw { status: 404, message: 'Không tìm thấy khóa học', code: 'COURSE_NOT_FOUND' };
      }

      let studentInfo = null;
      let progressData = null;

      if (studentId) {
        studentInfo = await User.findByPk(studentId, {
          attributes: ['id', 'firstName', 'lastName', 'email'],
        });
        
        const enrollment = await Enrollment.findOne({
          where: { userId: studentId, courseId },
        });
        
        progressData = enrollment ? {
          progress: enrollment.progress,
          lastAccessed: enrollment.lastAccessedAt,
          completedLectures: enrollment.completedLectures,
        } : null;
      }

      const systemPrompt = `Bạn là Trợ lý Giảng dạy AI, giúp giáo viên viết feedback cho học sinh.
Feedback phải: Cụ thể, mang tính xây dựng, khuyến khích, dễ hiểu.`;

      const prompt = `Tạo GỢI Ý FEEDBACK cho giáo viên:

KHÓA HỌC: ${course.title}
${course.description ? `Mô tả: ${course.description}` : ''}

${studentInfo ? `HỌC SINH: ${studentInfo.firstName} ${studentInfo.lastName}` : 'TẠO MẪU FEEDBACK CHUNG'}
${progressData ? `Tiến độ: ${progressData.progress}% - Đã học ${progressData.completedLectures || 0} bài` : ''}

LOẠI FEEDBACK: ${feedbackType}
${assignmentId ? 'Bài tập cụ thể: Có' : 'Chung về quá trình học'}

## 🎯 FEEDBACK TEMPLATE

### Version 1: Tích cực/Khuyến khích
[Nội dung cụ thể]

### Version 2: Cần cải thiện (nhẹ nhàng)
[Nội dung cụ thể]

### Version 3: Chi tiết/Góp ý sâu
[Nội dung cụ thể]

## 💬 CÂU MỞ ĐẦU GỢI Ý
- 3 cách bắt đầu feedback khác nhau

## 📝 CÂU KẾT THÚC GỢI Ý  
- 3 cách kết thúc tích cực

## ⚠️ LƯU Ý KHI VIẾT
- Những điểm cần tránh
- Từ ngữ không nên dùng

Format: Sẵn sàng copy-paste và chỉnh sửa.`;

      const aiResponse = await aiGateway.generateText({
        system: systemPrompt,
        prompt,
        maxOutputTokens: 2048,
      });

      const content = cleanContent(aiResponse.text);

      return {
        content,
        metadata: {
          courseId,
          courseTitle: course.title,
          studentId: studentInfo?.id,
          studentName: studentInfo ? `${studentInfo.firstName} ${studentInfo.lastName}` : null,
          feedbackType,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      logger.error('STUDENT_FEEDBACK_GENERATION_FAILED', {
        courseId,
        teacherId,
        options,
        error: error.message,
      });
      throw {
        status: error.status || 500,
        message: error.message || 'Không thể tạo gợi ý feedback',
        code: error.code || 'STUDENT_FEEDBACK_GENERATION_FAILED',
      };
    }
  }

  /**
   * Generate quiz/exam for teacher with answer key
   */
  async generateTeacherQuiz(courseId, teacherId, options = {}) {
    try {
      const {
        quizType = 'chapter_test',
        difficulty = 'mixed',
        questionCount = 20,
        includeAnswerKey = true,
        timeLimit = 45,
        chapterIds = [],
      } = options;

      const whereClause = { courseId };
      if (chapterIds.length > 0) {
        whereClause.id = { [require('sequelize').Op.in]: chapterIds };
      }

      const chapters = await Chapter.findAll({
        where: whereClause,
        include: [
          {
            model: Lecture,
            attributes: ['id', 'title', 'content'],
          },
        ],
        order: [['order', 'ASC']],
      });

      const course = await Course.findByPk(courseId, {
        attributes: ['title', 'description'],
      });

      const lecturesContent = chapters.map(ch => ({
        chapterTitle: ch.title,
        lectures: ch.Lectures?.map(l => ({
          title: l.title,
          content: l.content ? l.content.substring(0, 500) : '',
        })) || [],
      }));

      const systemPrompt = `Bạn là Trợ lý Giảng dạy AI, chuyên tạo đề kiểm tra chất lượng cao cho giáo viên.`;

      const prompt = `Tạo ĐỀ KIỂM TRA cho giáo viên:

KHÓA HỌC: ${course.title}
LOẠI ĐỀ: ${quizType}
SỐ CÂU: ${questionCount}
THỜI GIAN: ${timeLimit} phút
ĐỘ KHÓ: ${difficulty}

NỘI DUNG BÀI HỌC:
${JSON.stringify(lecturesContent, null, 2)}

## 📋 THÔNG TIN ĐỀ
- Tên đề: ${course.title} - ${quizType}
- Thời gian: ${timeLimit} phút
- Tổng điểm: 100
- Số câu: ${questionCount}

## 📊 MA TRẬN ĐỀ
| Chương | Nhận biết | Thông hiểu | Vận dụng | Tổng |
|--------|-----------|------------|----------|------|

## ❓ PHẦN I: TRẮC NGHIỆM (${Math.floor(questionCount * 0.6)} câu)

### Câu 1 (Mức độ: Dễ)
**Câu hỏi:** ...
A. ... B. ... C. ... D. ...
**Đáp án:** A
**Giải thích:** ...

## ✏️ PHẦN II: TỰ LUẬN (${Math.floor(questionCount * 0.4)} câu)

### Câu X (Mức độ: ...)
**Đề bài:** ...
**Đáp án tham khảo:**
- Ý chính 1: ...
**Thang điểm:** ...

## 📝 ĐÁP ÁN TỔNG HỢP
- Bảng đáp án nhanh cho giáo viên chấm

Format: Đầy đủ, sẵn sàng in ấn.`;

      const aiResponse = await aiGateway.generateText({
        system: systemPrompt,
        prompt,
        maxOutputTokens: 8192,
        timeoutMs: 120000,
      });

      const content = cleanContent(aiResponse.text);

      logger.info('TEACHER_QUIZ_GENERATED', {
        courseId,
        teacherId,
        quizType,
        questionCount,
      });

      return {
        content,
        metadata: {
          courseId,
          courseTitle: course.title,
          quizType,
          questionCount,
          timeLimit,
          difficulty,
          includeAnswerKey,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      logger.error('TEACHER_QUIZ_GENERATION_FAILED', {
        courseId,
        teacherId,
        options,
        error: error.message,
      });
      throw {
        status: error.status || 500,
        message: error.message || 'Không thể tạo đề kiểm tra',
        code: error.code || 'TEACHER_QUIZ_GENERATION_FAILED',
      };
    }
  }

  /**
   * Generate teaching materials (slides outline, handouts, worksheets)
   */
  async generateTeachingMaterials(lectureId, teacherId, options = {}) {
    try {
      const {
        materialType = 'slides',
        slideCount = 15,
        includeActivities = true,
      } = options;

      const lecture = await Lecture.findByPk(lectureId, {
        include: [
          {
            model: Chapter,
            as: 'chapter',
            include: [
              {
                model: Course,
                attributes: ['title'],
              },
            ],
          },
        ],
      });

      if (!lecture) {
        throw { status: 404, message: 'Không tìm thấy lecture', code: 'LECTURE_NOT_FOUND' };
      }

      const systemPrompt = `Bạn là Trợ lý Giảng dạy AI, tạo tài liệu hỗ trợ giảng dạy chuyên nghiệp.`;

      let materialPrompt = '';
      
      if (materialType === 'slides') {
        materialPrompt = `Tạo OUTLINE SLIDES trình chiếu (${slideCount} slides):

| # | Tiêu đề | Nội dung chính | Ghi chú thiết kế |
|---|---------|---------------|------------------|
1 | Title | ${lecture.title} | Font lớn, hình nền |

### Slide 1: Title
- Tiêu đề: ${lecture.title}
- Phụ đề: ${lecture.chapter.Course.title}

### Slide 2-3: Opening/Hook
- Câu hỏi gợi mở
${includeActivities ? '\n### Slide về Hoạt động\n- Hướng dẫn pair work\n' : ''}

### Slide cuối: Summary + Homework`;
      } else if (materialType === 'handout') {
        materialPrompt = `Tạo HANDOUT cho HS:

**${lecture.title}**

📌 Tóm tắt:
1. ...

📝 Ví dụ minh họa:

✏️ Bài tập ôn tập:

💡 Mẹo ghi nhớ:`;
      } else if (materialType === 'worksheet') {
        materialPrompt = `Tạo WORKSHEET:

**${lecture.title}**

Họ và tên: _________________

### Phần 1: Kiểm tra hiểu biết (5 câu)
1. ___________________________

### Phần 2: Thực hành

Đáp án cho GV:`;
      } else if (materialType === 'cheat_sheet') {
        materialPrompt = `Tạo CHEAT SHEET:

**${lecture.title}**

## 🎯 Công thức/Cấu trúc chính

## 🔑 Từ khóa cần nhớ

## ⚡ Quick Reference`;
      }

      const fullPrompt = `Tạo TÀI LIỆU GIẢNG DẠY cho giáo viên:

BÀI HỌC: ${lecture.title}
KHÓA HỌC: ${lecture.chapter.Course.title}

${materialPrompt}

QUY TẮC:
- Format rõ ràng, dễ copy
- Không có lời chào/thân mật thừa`;

      const aiResponse = await aiGateway.generateText({
        system: systemPrompt,
        prompt: fullPrompt,
        maxOutputTokens: 4096,
      });

      const content = cleanContent(aiResponse.text);

      return {
        content,
        metadata: {
          lectureId,
          lectureTitle: lecture.title,
          courseTitle: lecture.chapter.Course.title,
          materialType,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      logger.error('TEACHING_MATERIALS_GENERATION_FAILED', {
        lectureId,
        teacherId,
        options,
        error: error.message,
      });
      throw {
        status: error.status || 500,
        message: error.message || 'Không thể tạo tài liệu',
        code: error.code || 'TEACHING_MATERIALS_GENERATION_FAILED',
      };
    }
  }

  /**
   * Analyze course difficulty and suggest adjustments
   */
  async analyzeCourseDifficulty(courseId, teacherId) {
    try {
      const course = await Course.findByPk(courseId, {
        include: [
          {
            model: Chapter,
            as: 'chapter',
            include: [
              {
                model: Lecture,
                attributes: ['id', 'title', 'content', 'difficulty'],
              },
            ],
          },
        ],
      });

      if (!course) {
        throw { status: 404, message: 'Không tìm thấy khóa học', code: 'COURSE_NOT_FOUND' };
      }

      const enrollmentStats = await Enrollment.findAll({
        where: { courseId },
        attributes: ['progress', 'completedLectures', 'enrolledAt'],
      });

      const totalStudents = enrollmentStats.length;
      const avgProgress = totalStudents > 0
        ? enrollmentStats.reduce((sum, e) => sum + (e.progress || 0), 0) / totalStudents
        : 0;

      const systemPrompt = `Bạn là Trợ lý Giảng dạy AI, phân tích độ khó khóa học và đề xuất điều chỉnh.`;

      const prompt = `PHÂN TÍCH ĐỘ KHÓ KHÓA HỌC:

KHÓA HỌC: ${course.title}
THỐNG KÊ: ${totalStudents} học viên, tiến độ TB: ${avgProgress.toFixed(1)}%

NỘI DUNG:
${course.Chapters?.map(ch => `Chương: ${ch.title}`).join('\n') || 'Không có dữ liệu'}

## 📊 ĐÁNH GIÁ HIỆN TẠI
- Phân bố độ khó
- Tiến độ học viên
- Điểm nghẽn

## 💡 ĐỀ XUẤT
### Ngắn hạn:
### Dài hạn:

## 🎯 KẾ HOẠCH HÀNH ĐỘNG`;

      const aiResponse = await aiGateway.generateText({
        system: systemPrompt,
        prompt,
        maxOutputTokens: 4096,
      });

      const content = cleanContent(aiResponse.text);

      return {
        content,
        metadata: {
          courseId,
          courseTitle: course.title,
          totalStudents,
          avgProgress: avgProgress.toFixed(1),
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      logger.error('COURSE_DIFFICULTY_ANALYSIS_FAILED', {
        courseId,
        teacherId,
        error: error.message,
      });
      throw {
        status: error.status || 500,
        message: error.message || 'Không thể phân tích độ khó',
        code: error.code || 'COURSE_DIFFICULTY_ANALYSIS_FAILED',
      };
    }
  }
}

module.exports = new AiTeachingAssistantService();
