# Course Duration Workflow Tests

## Tổng quan

Các test file này kiểm tra luồng làm việc đầy đủ của hệ thống khóa học với các trường duration (thời hạn).

## Test Files

### 1. `course-workflow-duration.test.js`
**Integration Test** - Test luồng hoàn chỉnh:
```
Teacher tạo khóa học với duration
    ↓
Teacher gửi yêu cầu review
    ↓
Admin phê duyệt khóa học
    ↓
Student ghi danh
    ↓
Student xem nội dung khóa học (có video URL)
    ↓
Teacher cập nhật duration
```

### 2. `course-service-duration.test.js`
**Unit Test** - Test các methods trong course service:
- `createCourse()` - Tạo khóa học với duration fields
- `updateCourse()` - Cập nhật duration settings
- `getCourseContentForOwner()` - Lấy content với duration
- `getEnrolledCourseContent()` - Lấy content cho student đã enroll

## Chạy Tests

### Chạy tất cả tests:
```bash
cd lms-backend
npm test
```

### Chạy test cụ thể:
```bash
# Integration test
npm test -- course-workflow-duration.test.js

# Unit test
npm test -- course-service-duration.test.js
```

### Chạy với coverage:
```bash
npm test -- --coverage
```

### Chạy trong watch mode (phát triển):
```bash
npm test -- --watch
```

## Yêu cầu

1. **Database**: Test cần database chạy (hoặc mock)
2. **Environment Variables**: Copy từ `.env.test` nếu có
3. **Auth Tokens**: Integration test cần accounts:
   - Teacher account
   - Admin account  
   - Student account

## Kiểm tra thủ công (không cần Jest)

Nếu không muốn chạy Jest, có thể test thủ công qua Postman/cURL:

### 1. Tạo khóa học (Teacher)
```bash
curl -X POST http://localhost:5000/teacher/courses \
  -H "Authorization: Bearer <teacher_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Course",
    "durationType": "fixed",
    "durationValue": 6,
    "durationUnit": "months",
    "renewalDiscountPercent": 20,
    "gracePeriodDays": 7
  }'
```

### 2. Lấy content cho student enrolled
```bash
curl -X GET http://localhost:5000/student/enrolled-courses/1/content \
  -H "Authorization: Bearer <student_token>"
```

## Kết quả mong đợi

| Test | Expected |
|------|----------|
| Tạo course với duration | ✅ 201, response có duration fields |
| Gửi review | ✅ 200, status → pending_review |
| Admin approve | ✅ 200, status → published |
| Student enroll | ✅ 201, expiresAt được tính từ duration |
| Student xem content | ✅ 200, có videoUrl |
| Non-enrolled access | ❌ 403 Forbidden |

## Troubleshooting

### Lỗi "Cannot find module"
```bash
npm install
```

### Lỗi database connection
```bash
# Kiểm tra DB chạy
# Hoặc mock DB trong test
```

### Test timeout
Tăng timeout trong `jest.config.js`:
```javascript
testTimeout: 30000 // 30 seconds
```
