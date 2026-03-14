# Hướng dẫn Tích hợp API Quản lý Kiểm tra (Quiz) cho Giảng viên

Tài liệu này cung cấp chi tiết kỹ thuật dành cho Frontend để triển khai các tính năng quản lý bài kiểm tra, câu hỏi và xem kết quả dành cho Giảng viên (Teacher).

---

## 1. Cấu hình & Bảo mật (Teacher Roles)

- **Base Path**: `/api/teacher`
- **Quyền truy cập**: Chỉ tài khoản có role `teacher` hoặc `admin` mới có thể gọi các API này.
- **Xác thực**: JWT Token gửi qua header `Authorization: Bearer <token>`.

---

## 2. Quản lý Quiz (CRUD)

### 2.1. Lấy tất cả Quiz trong một khóa học

- **URL**: `GET /api/teacher/courses/:courseId/quizzes`
- **Response**: Trả về danh sách Quiz kèm theo số lượng câu hỏi hiện có.

### 2.2. Tạo Quiz mới

- **URL**: `POST /api/teacher/courses/:courseId/quizzes`
- **Body mẫu**:

```json
{
  "title": "Kiểm tra cuối khóa",
  "description": "Nội dung tổng hợp",
  "maxScore": 100,
  "timeLimit": 90,
  "passingScore": 50,
  "startTime": "2024-03-25T08:00:00.000Z", // Để null nếu không muốn giới hạn
  "endTime": "2024-03-25T10:00:00.000Z", // Để null nếu không muốn giới hạn
  "showResults": true // Cho phép học viên xem đáp án sau khi nộp
}
```

### 2.3. Cập nhật Quiz

- **URL**: `PUT /api/teacher/quizzes/:quizId`
- **Body**: Tương tự như API Tạo mới.

### 2.4. Xóa Quiz

- **URL**: `DELETE /api/teacher/quizzes/:quizId`

### 2.5. Xóa/Reset bài nộp của học viên (Cho làm lại)

Dùng khi giáo viên muốn cho phép một học viên cụ thể được thi lại từ đầu.

- **URL**: `DELETE /api/teacher/attempts/:attemptId`
- **Response**: `{"success": true, "message": "Đã xóa bài nộp thành công..."}`

---

## 3. Quản lý Câu hỏi (Question Management)

### 3.1. Thêm câu hỏi vào Quiz

- **URL**: `POST /api/teacher/quizzes/:quizId/questions`
- **Body mẫu theo từng loại**:

#### A. Trắc nghiệm (multiple_choice):

```json
{
  "type": "multiple_choice",
  "content": "Thủ đô của Việt Nam là gì?",
  "options": ["Hà Nội", "Đà Nẵng", "TP. Hồ Chí Minh"],
  "correctAnswer": "Hà Nội",
  "points": 1,
  "explanation": "Hà Nội là trung tâm hành chính..."
}
```

#### B. Đúng / Sai (true_false):

```json
{
  "type": "true_false",
  "content": "Mặt trời mọc ở hướng Tây?",
  "correctAnswer": "false",
  "points": 1
}
```

#### C. Trả lời ngắn (short_answer):

```json
{
  "type": "short_answer",
  "content": "Viết tên viết tắt của Tổ chức Y tế Thế giới?",
  "correctAnswer": "WHO",
  "points": 2
}
```

### 3.2. Cập nhật/Xóa câu hỏi

- **Cập nhật**: `PUT /api/teacher/questions/:questionId`
- **Xóa**: `DELETE /api/teacher/questions/:questionId`

---

## 4. Quản lý Media (Media Upload)

Dùng cho trường hợp câu hỏi có đính kèm hình ảnh/âm thanh/video.

- **URL**: `POST /api/teacher/media/quiz`
- **Content-Type**: `multipart/form-data`
- **Field name**: `file`
- **Response**: Trả về `url` của file. Giáo viên sẽ chèn URL này vào nội dung (`content`) câu hỏi theo định dạng Markdown hoặc thẻ HTML.

---

## 5. Thống kê & Chấm bài

### 5.1. Xem danh sách bài nộp và Xếp hạng

- **URL**: `GET /api/teacher/quizzes/:quizId/attempts`
- **Response**: Trả về 3 phần dữ liệu quan trọng:
  - `statistics`: Các con số tổng quát (Tỷ lệ đạt, điểm trung bình).
  - `attempts`: Danh sách chi tiết **tất cả** lần làm bài của mọi học viên.
  - `ranking`: Bảng xếp hạng học viên dựa trên **điểm cao nhất** của mỗi người.
    _Dữ liệu gồm: rank, userName, highestScore, passed, completedAt._

### 5.2. Xem chi tiết một bài làm (Teacher View)

Dùng khi giảng viên muốn xem chi tiết học viên đó đã chọn đáp án nào trong một lần thi cụ thể.

- **URL**: `GET /api/teacher/attempts/:attemptId`
- **Response mẫu**:
```json
{
  "success": true,
  "data": {
    "attempt": {
      "id": 39,
      "user": {
        "id": 10,
        "name": "Nguyễn Văn A",
        "email": "student_a@gmail.com"
      },
      "score": "15.00",
      "percentageScore": "75.00",
      "passed": true,
      "startedAt": "2024-03-11T16:00:00Z",
      "completedAt": "2024-03-11T16:15:00Z"
    },
    "quiz": {
      "id": 1,
      "title": "Kiểm tra giữa kỳ",
      "questions": [...] 
    },
    "results": [
      {
        "questionId": 101,
        "userAnswer": "Hà Nội",
        "correctAnswer": "Hà Nội",
        "isCorrect": true,
        "pointsEarned": 10,
        "maxPoints": 10,
        "explanation": "Hà Nội là thủ đô..."
      }
    ]
  }
}
```

---

### 5.3. Thống kê Chi tiết Dashboard (Detailed Statistics)

Cung cấp dữ liệu cho các Card tổng quát, Biểu đồ phân phối điểm, Bảng xếp hạng học viên và Gợi ý AI.

- **URL**: `GET /api/teacher/statistics`
- **Query Params**: `courseId` (Optional - Lọc theo khóa học cụ thể)
- **Response mẫu**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "activeStudents": 15,
      "averageProgress": 65.5,
      "totalCourses": 3,
      "averageScore": 72.8,
      "trends": {
        "activeStudents": "+5%",
        "averageProgress": "+2.1%",
        "totalCourses": "+0",
        "averageScore": "+1.5%"
      }
    },
    "scoreDistribution": [
      { "range": "0-20%", "count": 2, "label": "Cần cải thiện" },
      { "range": "81-100%", "count": 8, "label": "Xuất sắc" }
    ],
    "ranking": [
      {
        "rank": 1,
        "studentName": "Nguyễn Văn A",
        "highestScore": 95,
        "courseProgress": 100,
        "achievement": "Xuất sắc"
      }
    ],
    "aiSuggestions": [
      {
        "type": "improvement",
        "title": "Cần bổ sung bài tập",
        "description": "Dựa trên tỷ lệ nộp bài, học viên đang có xu hướng chậm lại ở chương 3.",
        "action": "THÊM BÀI TẬP"
      }
    ]
  }
}
```

---

## 6. Lưu ý quan trọng cho Frontend Giảng viên

1.  **Cấu hình thời gian**: Khi gửi `startTime` và `endTime`, hãy đảm bảo sử dụng định dạng ISO String (`new Date().toISOString()`).
2.  **Toggle bảo mật**: Nút gạt `showResults` nên có tooltip giải thích: _"Nếu tắt, học viên sẽ không nhìn thấy đáp án đúng sau khi nộp bài để tránh lộ đề"_.
3.  **Preview**: Nên có màn hình Preview bài thi để giảng viên xem lại tổng thể trước khi công bố bài thi.
