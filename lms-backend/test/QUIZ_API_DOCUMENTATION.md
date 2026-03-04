# LMS Quiz System - API Documentation

## Base URL
```
http://localhost:5000
```

## Authentication
All quiz endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

---

## Teacher/Admin Quiz Management

### 1. Create Quiz

**Endpoint:** `POST /api/teacher/courses/:courseId/quizzes`

**Description:** Tạo quiz mới cho khóa học

**Request Body:**
```json
{
  "title": "JavaScript Basics Quiz",
  "description": "Kiểm tra kiến thức cơ bản về JavaScript",
  "maxScore": 100,
  "timeLimit": 60,
  "passingScore": 70
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Tạo quiz thành công",
  "data": {
    "quiz": {
      "id": 1,
      "courseId": 1,
      "title": "JavaScript Basics Quiz",
      "description": "Kiểm tra kiến thức cơ bản về JavaScript",
      "maxScore": 100,
      "timeLimit": 60,
      "passingScore": 70,
      "createdBy": 1
    }
  }
}
```

---

### 2. Get Course Quizzes

**Endpoint:** `GET /api/teacher/courses/:courseId/quizzes`

**Description:** Lấy danh sách quiz của khóa học

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "quizzes": [
      {
        "id": 1,
        "courseId": 1,
        "title": "JavaScript Basics Quiz",
        "maxScore": 100,
        "timeLimit": 60,
        "passingScore": 70,
        "questions": []
      }
    ]
  }
}
```

---

### 3. Add Question

**Endpoint:** `POST /api/teacher/quizzes/:quizId/questions`

**Description:** Thêm câu hỏi vào quiz

**Request Body (Multiple Choice):**
```json
{
  "type": "multiple_choice",
  "content": "Đâu là cách khai báo biến đúng trong JavaScript?",
  "options": ["var x = 5;", "variable x = 5;", "v x = 5;", "declare x = 5;"],
  "correctAnswer": ["var x = 5;"],
  "points": 2,
  "explanation": "var là từ khóa khai báo biến trong JavaScript"
}
```

**Request Body (True/False):**
```json
{
  "type": "true_false",
  "content": "JavaScript là một ngôn ngữ statically typed",
  "options": ["True", "False"],
  "correctAnswer": ["False"],
  "points": 1,
  "explanation": "JavaScript là dynamically typed language"
}
```

**Request Body (Short Answer):**
```json
{
  "type": "short_answer",
  "content": "Kết quả của 2 + 2 là gì?",
  "correctAnswer": "4",
  "points": 1
}
```

**Request Body (Essay):**
```json
{
  "type": "essay",
  "content": "Hãy giải thích sự khác biệt giữa let và const",
  "points": 5
}
```

---

### 4. Get Quiz Statistics

**Endpoint:** `GET /api/teacher/quizzes/:quizId/attempts`

**Description:** Xem thống kê và kết quả của quiz

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "attempts": [
      {
        "id": 1,
        "userId": 2,
        "quizId": 1,
        "score": 85,
        "percentageScore": 85,
        "passed": true,
        "startedAt": "2025-03-04T10:00:00.000Z",
        "completedAt": "2025-03-04T10:45:00.000Z",
        "user": {
          "id": 2,
          "name": "Nguyễn Văn A",
          "email": "a@example.com"
        }
      }
    ],
    "statistics": {
      "totalAttempts": 10,
      "completedAttempts": 8,
      "passedAttempts": 6,
      "passRate": 75,
      "averageScore": 78.5
    }
  }
}
```

---

## Student Quiz Taking

### 1. Start Quiz Attempt

**Endpoint:** `POST /api/student/quizzes/:quizId/start`

**Description:** Bắt đầu làm bài quiz

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Bắt đầu làm bài thành công",
  "data": {
    "attempt": {
      "id": 1,
      "quizId": 1,
      "startedAt": "2025-03-04T10:00:00.000Z",
      "timeLimit": 60
    },
    "quiz": {
      "id": 1,
      "title": "JavaScript Basics Quiz",
      "description": "Kiểm tra kiến thức cơ bản về JavaScript",
      "timeLimit": 60,
      "maxScore": 100,
      "questions": [
        {
          "id": 1,
          "type": "multiple_choice",
          "content": "Đâu là cách khai báo biến đúng trong JavaScript?",
          "options": ["var x = 5;", "variable x = 5;", "v x = 5;", "declare x = 5;"],
          "points": 2
        }
      ]
    }
  }
}
```

---

### 2. Submit Quiz

**Endpoint:** `POST /api/student/attempts/:attemptId/submit`

**Description:** Nộp bài quiz

**Request Body:**
```json
{
  "answers": {
    "1": ["var x = 5;"],
    "2": ["False"],
    "3": "4"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Nộp bài thành công",
  "data": {
    "attempt": {
      "id": 1,
      "score": 85,
      "percentageScore": 85,
      "maxScore": 100,
      "passed": true,
      "completedAt": "2025-03-04T10:45:00.000Z"
    },
    "results": [
      {
        "questionId": 1,
        "userAnswer": ["var x = 5;"],
        "correctAnswer": ["var x = 5;"],
        "isCorrect": true,
        "pointsEarned": 2,
        "maxPoints": 2,
        "explanation": "var là từ khóa khai báo biến trong JavaScript"
      }
    ]
  }
}
```

---

### 3. Get My Attempts

**Endpoint:** `GET /api/student/quizzes/:quizId/attempts`

**Description:** Xem các lần làm bài của học viên

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "attempts": [
      {
        "id": 1,
        "quizId": 1,
        "score": 85,
        "percentageScore": 85,
        "passed": true,
        "startedAt": "2025-03-04T10:00:00.000Z",
        "completedAt": "2025-03-04T10:45:00.000Z",
        "quiz": {
          "id": 1,
          "title": "JavaScript Basics Quiz",
          "maxScore": 100,
          "passingScore": 70,
          "timeLimit": 60
        }
      }
    ]
  }
}
```

---

### 4. Get Attempt Details

**Endpoint:** `GET /api/student/attempts/:attemptId`

**Description:** Xem chi tiết lần làm bài

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "attempt": {
      "id": 1,
      "score": 85,
      "percentageScore": 85,
      "passed": true,
      "startedAt": "2025-03-04T10:00:00.000Z",
      "completedAt": "2025-03-04T10:45:00.000Z",
      "answers": {
        "1": ["var x = 5;"],
        "2": ["False"],
        "3": "4"
      }
    },
    "quiz": {
      "id": 1,
      "title": "JavaScript Basics Quiz",
      "questions": [
        {
          "id": 1,
          "type": "multiple_choice",
          "content": "Đâu là cách khai báo biến đúng trong JavaScript?",
          "options": ["var x = 5;", "variable x = 5;", "v x = 5;", "declare x = 5;"],
          "points": 2,
          "correctAnswer": ["var x = 5;"],
          "explanation": "var là từ khóa khai báo biến trong JavaScript"
        }
      ]
    }
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Dữ liệu không hợp lệ",
  "errors": [
    {
      "msg": "Tiêu đề quiz không được để trống",
      "param": "title"
    }
  ]
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Bạn không có quyền tạo quiz cho khóa học này"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Không tìm thấy quiz"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Bạn đang có một lần làm bài chưa hoàn thành"
}
```

---

## Question Types

### 1. Multiple Choice
- `type`: "multiple_choice"
- `options`: Array of strings (min 2 options)
- `correctAnswer`: Array of strings (selected correct options)
- `points`: Number (default: 1)

### 2. True/False
- `type`: "true_false"
- `options`: ["True", "False"]
- `correctAnswer`: Array with one string
- `points`: Number (default: 1)

### 3. Short Answer
- `type`: "short_answer"
- `correctAnswer`: String (case-insensitive comparison)
- `points`: Number (default: 1)

### 4. Essay
- `type`: "essay"
- `correctAnswer`: Not required (manual grading)
- `points`: Number (default: 1)

---

## Notes

- Quiz time limit is in minutes
- Students can only have one active attempt at a time
- Essay questions require manual grading by teacher
- All timestamps are in UTC
- Score calculation is automatic for non-essay questions
- Passing is determined by percentage score vs passingScore
