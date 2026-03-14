# Hướng dẫn Tích hợp API Kiểm tra (Quiz) cho Học viên

Tài liệu này cung cấp chi tiết kỹ thuật dành cho Frontend để triển khai giao diện làm bài kiểm tra cho học viên, bao gồm các bước từ khi truy cập bài thi, làm bài, nộp bài và xem kết quả.

---

## 1. Tổng quan Luồng công việc (Workflow)

1.  **Lấy lịch sử**: Gọi API lấy danh sách các lần đã làm bài trước đó.
2.  **Bắt đầu bài thi**: Học viên nhấn "Bắt đầu". Frontend gọi API `start`.
3.  **Làm bài**: Hiển thị câu hỏi, đếm ngược thời gian.
4.  **Nộp bài**: Học viên nhấn "Nộp bài" hoặc hết thời gian. Frontend gọi API `submit`.
5.  **Kết quả**: Hiển thị điểm số và đáp án chi tiết.

---

## 2. Chi tiết các API Student

### 2.1. Lấy tất cả Quiz (Dùng cho Dashboard/My Quizzes)
Lấy danh sách toàn bộ các bài kiểm tra từ **tất cả** khóa học mà học viên đã đăng ký.

- **URL**: `GET /api/student/quizzes`
- **Header**: `Authorization: Bearer <token>`
- **Response**: Trả về danh sách quiz kèm theo thông tin `courseTitle` và `userStatus`.

### 2.2. Lấy danh sách Quiz theo khóa học (Get Quizzes by Course)
Học viên gọi API này để biết khóa học có những bài kiểm tra nào.

- **URL**: `GET /api/student/courses/:courseId/quizzes`
- **Header**: `Authorization: Bearer <token>`
- **Response Thành công (200)**:
```json
{
  "success": true,
  "data": {
    "quizzes": [
      {
        "id": 1,
        "title": "Kiểm tra giữa kỳ",
        "description": "Nội dung chương 1-3",
        "maxScore": 100,
        "timeLimit": 45,
        "passingScore": 50,
        "userStatus": {
           "status": "completed", // not_started, in_progress, completed
           "lastScore": 85.00,
           "isPassed": true,
           "attemptCount": 1,
           "latestAttemptId": 10
        }
      }
    ]
  }
}
```

**Các trạng thái (`status`):**
- `not_started`: Học viên chưa bao giờ nhấn bắt đầu.
- `in_progress`: Học viên đang làm bài (đã nhấn bắt đầu nhưng chưa nộp).
- `completed`: Học viên đã nộp bài ít nhất một lần.

### 2.2. Các ràng buộc thời gian & Bảo mật
Khi lấy danh sách Quiz (API 2.1), cần lưu ý các trường:
- `startTime`: Nếu chưa đến giờ này, học viên không thể nhấn "Bắt đầu".
- `endTime`: Nếu quá giờ này, học viên không thể nhấn "Bắt đầu".
- `showResults`:
    - Nếu `false`: Ngay cả khi đã nộp bài, các trường `correctAnswer` và `explanation` sẽ trả về `undefined/null`. Điểm số có thể vẫn hiện nhưng không rõ sai ở đâu.
    - Nếu `true`: Sau khi nộp sẽ hiện đầy đủ đáp án đúng.

### 2.3. Lấy danh sách lần làm bài (Get Attempts)
Hiển thị lịch sử thi của học viên cho một Quiz cụ thể để học viên biết mình đã thi chưa, điểm bao nhiêu.

- **URL**: `GET /api/student/quizzes/:quizId/attempts`
- **Header**: `Authorization: Bearer <token>`
- **Response Thành công (200)**:
```json
{
  "success": true,
  "data": {
    "attempts": [
      {
        "id": 10,
        "score": 85.00,
        "percentageScore": 85.00,
        "passed": true,
        "startedAt": "2024-03-20T10:00:00Z",
        "completedAt": "2024-03-20T10:25:00Z",
        "quiz": {
            "title": "Bài kiểm tra chương 1",
            "maxScore": 100,
            "passingScore": 60
        }
      }
    ]
  }
}
```

### 2.4. Bắt đầu làm bài (Start Attempt)
Khởi tạo một phiên làm bài mới và lấy danh sách câu hỏi.

- **URL**: `POST /api/student/quizzes/:quizId/start`
- **Header**: `Authorization: Bearer <token>`
- **Response Thành công (201)**:
```json
{
  "success": true,
  "data": {
    "attempt": {
      "id": 15,
      "quizId": 1,
      "startedAt": "2024-03-21T08:00:00Z",
      "timeLimit": 60
    },
    "quiz": {
      "id": 1,
      "title": "Kiểm tra cuối khóa",
      "timeLimit": 60,
      "questions": [
        {
          "id": 101,
          "type": "multiple_choice",
          "content": "2 + 2 = ?",
          "options": ["3", "4", "5"],
          "points": 10
        }
      ]
    }
  }
}
```
- **Lưu ý**: Các trường `correctAnswer` và `explanation` sẽ bị Backend lược bỏ để đảm bảo tính minh bạch trong khi thi.
- **Xử lý "Auto Resume"**: Nếu học viên đang làm dở, gọi API này sẽ trả về code 200 kèm `attemptId` và danh sách câu hỏi cũ để làm tiếp.

### 2.5. Nộp bài thi (Submit Attempt)
Gửi toàn bộ đáp án lên hệ thống để chấm điểm tự động.

- **URL**: `POST /api/student/attempts/:attemptId/submit`
- **Header**: `Authorization: Bearer <token>`
- **Body (JSON)**:
```json
{
  "answers": {
    "101": "4",
    "102": "true",
    "103": "Nội dung bài luận..."
  }
}
```
- **Response Thành công (200)**:
```json
{
  "success": true,
  "data": {
    "attempt": {
      "id": 15,
      "score": 90.00,
      "percentageScore": 90.00,
      "maxScore": 100,
      "passed": true,
      "completedAt": "...",
      "summary": {
         "totalQuestions": 10,
         "correctCount": 9,
         "incorrectCount": 1,
         "manualGradingCount": 0
      }
    },
    "quiz": {
      "id": 1,
      "title": "Kiểm tra giữa kỳ",
      "description": "Nội dung chương 1-3"
    },
    "results": [
      {
        "questionId": 101,
        "userAnswer": "4",
        "correctAnswer": "4",
        "isCorrect": true,
        "pointsEarned": 10,
        "explanation": "Phép cộng cơ bản"
      }
    ]
  }
}
```

### 2.6. Xem lại chi tiết bài làm (Get Attempt Detail)
Dùng để hiển thị lại bài làm đã nộp (để học viên xem lỗi sai).

- **URL**: `GET /api/student/attempts/:attemptId`
- **Response**: Trả về thông tin tương tự API nộp bài nhưng đầy đủ cấu trúc Quiz + Câu hỏi + Đáp án của người dùng + Đáp án đúng.

---

## 3. Quy định về các loại câu hỏi (UI Implementation)

| Loại (Type) | Giao diện đề xuất | Giá trị Answers gửi lên (Value) |
| :--- | :--- | :--- |
| `multiple_choice` | Danh sách Radio buttons (Chọn 1) | String (VD: `"A"`) |
| `true_false` | 2 Radio buttons (Đúng/Sai) | String (`"true"` hoặc `"false"`) |
| `short_answer` | Ô Input text | String (VD: `"Hà Nội"`) |
| `essay` | Ô Textarea lớn | String nội dung bài viết |

---

## 4. Các lưu ý quan trọng cho Frontend (Tips)

1.  **Đếm ngược thời gian**:
    - Dựa vào `startedAt` và `timeLimit` từ API Start để tính toán thời gian còn lại.
    - Không nên dựa hoàn toàn vào đồng hồ client vì người dùng có thể chỉnh giờ máy tính.
2.  **Tự động nộp bài**: 
    - Khi đồng hồ về 0, Frontend nên tự động gọi API `submit` với các đáp án hiện có để bảo vệ quyền lợi học viên.
3.  **Trạng thái Loading**: 
    - Quá trình chấm điểm có thể mất 1-2 giây, cần hiển thị loading khi nhấn Nộp bài.
4.  **Câu hỏi Essay (Tự luận)**:
    - Backend mặc định chấm 0 điểm cho Essay. Điểm số cuối cùng sẽ thay đổi sau khi Giáo viên chấm bài theo cách thủ công. FE nên hiển thị thông báo "Đang chờ giáo viên chấm" cho loại câu hỏi này.
5.  **Ngăn chặn thoát trang**:
    - Nên sử dụng `window.onbeforeunload` để cảnh báo nếu người dùng vô tình đóng tab hoặc tải lại trang khi đang làm bài.

---

## 5. Các mã lỗi thường gặp (Error Codes)

- `400 Bad Request`: Dữ liệu không hợp lệ.
- `401 Unauthorized`: Token hết hạn.
- `403 Forbidden`: 
  - Chưa đăng ký học.
  - **Mới**: Bài thi chưa đến giờ bắt đầu (`startTime`).
  - **Mới**: Bài thi đã hết giờ thực hiện (`endTime`).
- `404 Not Found`: Không tìm thấy Resource.
- `500 Server Error`: Lỗi máy chủ.
