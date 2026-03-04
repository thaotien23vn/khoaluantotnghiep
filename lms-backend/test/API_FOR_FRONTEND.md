# LMS Backend - API Reference cho Frontend

**Base URL:** `http://localhost:5000` (hoặc URL production)

**Header chung cho API cần đăng nhập:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

## 1. Health Check

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/health` | GET | - | `{ "status": "OK", "message": "LMS Backend running" }` | 200 |

---

## 2. Auth (Không cần token)

### 2.1 Đăng ký

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/auth/register` | POST | `{ "name": string, "username": string, "email": string, "phone"?: string, "password": string, "role"?: "student" \| "teacher" \| "admin" }` | `{ "success": true, "message": string, "data": { "user": { "id", "name", "username", "email", "phone", "role", "isEmailVerified" }, "verificationCode": string } }` | 201 |
| | | | `{ "success": false, "message": string, "errors"?: array }` | 400 |
| | | | `{ "success": false, "message": "Email/Tên đăng nhập đã được sử dụng" }` | 409 |
| | | | `{ "success": false, "message": string }` | 500 |

### 2.2 Xác nhận email (qua link)

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/auth/verify-email/:token` | GET | - | `{ "success": true, "message": string, "data": { "user": { "id", "name", "email", "role", "isEmailVerified" } } }` | 200 |
| | | | `{ "success": false, "message": "Token không hợp lệ" }` | 404 |
| | | | `{ "success": false, "message": "Token đã hết hạn" }` | 400 |

### 2.3 Xác nhận email (qua mã 6 số)

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/auth/verify-email-code` | POST | `{ "token": string }` | `{ "success": true, "message": string, "data": { "user": { "id", "name", "email", "role", "isEmailVerified" } } }` | 200 |
| | | | `{ "success": false, "message": string }` | 400, 404 |

### 2.4 Gửi lại email xác nhận

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/auth/resend-verification-email` | POST | `{ "email": string }` | `{ "success": true, "message": string }` | 200 |
| | | | `{ "success": false, "message": string }` | 400, 404, 500 |

### 2.5 Đăng nhập

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/auth/login` | POST | `{ "email"?: string, "username"?: string, "password": string }` *(cần email HOẶC username)* | `{ "success": true, "message": string, "data": { "user": { "id", "name", "username", "email", "phone", "role" }, "token": string } }` | 200 |
| | | | `{ "success": false, "message": "Dữ liệu không hợp lệ", "errors"?: array }` | 400 |
| | | | `{ "success": false, "message": "Email/tên đăng nhập hoặc mật khẩu không đúng" }` | 401 |
| | | | `{ "success": false, "message": "Email chưa được xác nhận" }` | 403 |

### 2.6 Quên mật khẩu

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/auth/forgot-password` | POST | `{ "email": string }` | `{ "success": true, "message": string }` | 200 |
| | | | `{ "success": false, "message": "Không tìm thấy tài khoản" }` | 404 |

### 2.7 Đặt lại mật khẩu

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/auth/reset-password` | POST | `{ "token": string, "password": string, "confirmPassword": string }` | `{ "success": true, "message": string }` | 200 |
| | | | `{ "success": false, "message": string }` | 400, 404 |

---

## 3. Auth (Cần token)

### 3.1 Lấy thông tin user hiện tại

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/auth/me` | GET | - | `{ "success": true, "data": { "id", "name", "username", "email", "phone", "role", "avatar", "isEmailVerified" } }` | 200 |
| | | | `{ "success": false, "message": string }` | 401, 404 |

---

## 4. Courses (Public - Không cần token)

### 4.1 Danh sách khóa học đã xuất bản

| Endpoint | Method | Body | Query | Response | Status |
|----------|--------|------|------|----------|--------|
| `/api/courses` | GET | - | `q`?: string (tìm theo tiêu đề) | `{ "success": true, "data": { "courses": [{ "id", "title", "slug", "description", "price", "published", "createdAt", "creator": { "id", "name", "username" } }] } }` | 200 |

### 4.2 Chi tiết khóa học (có chương + bài giảng)

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/courses/:id` | GET | - | `{ "success": true, "data": { "course": { "id", "title", "slug", "description", "price", "published", "creator": {...}, "Chapters": [{ "id", "title", "order", "Lectures": [{ "id", "title", "type", "contentUrl", "duration", "order" }] }] } } }` | 200 |
| | | | `{ "success": false, "message": "Không tìm thấy khóa học" }` | 404 |

---

## 5. Admin (Token + role: admin)

### 5.1 Dashboard

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/admin/dashboard` | GET | - | `{ "success": true, "message": string, "data": { "user": {...}, "stats": { "totalUsers", "totalCourses", "totalEnrollments" } } }` | 200 |

### 5.2 Danh sách users

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/admin/users` | GET | - | `{ "success": true, "data": { "users": [{ "id", "name", "role" }] } }` | 200 |

### 5.3 Xóa user

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/admin/users/:id` | DELETE | - | `{ "success": true, "message": string }` | 200 |

---

## 6. Teacher (Token + role: teacher hoặc admin)

### 6.1 Danh sách khóa học (của teacher / tất cả nếu admin)

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/courses` | GET | - | `{ "success": true, "data": { "courses": [{ "id", "title", "slug", "description", "price", "published", "createdBy", "categoryId", "createdAt", "updatedAt" }] } }` | 200 |

### 6.2 Tạo khóa học

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/courses` | POST | `{ "title": string, "description"?: string, "price"?: number, "categoryId"?: number, "published"?: boolean, "level"?: string, "duration"?: string, "willLearn"?: string[], "requirements"?: string[], "tags"?: string[] }` | `{ "success": true, "message": string, "data": { "course": {...} } }` | 201 |
| | | | `{ "success": false, "message": "Tiêu đề khóa học không được để trống" }` | 400 |

### 6.3 Chi tiết khóa học (của teacher)

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/courses/:id` | GET | - | `{ "success": true, "data": { "course": {...} } }` | 200 |
| | | | `{ "success": false, "message": "Không tìm thấy khóa học" }` | 404 |
| | | | `{ "success": false, "message": "Bạn không có quyền truy cập" }` | 403 |

### 6.4 Cập nhật khóa học

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/courses/:id` | PUT | `{ "title"?: string, "description"?: string, "price"?: number, "categoryId"?: number, "published"?: boolean }` | `{ "success": true, "message": string, "data": { "course": {...} } }` | 200 |
| | | | `{ "success": false, "message": string }` | 400, 403, 404 |

### 6.5 Xóa khóa học

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/courses/:id` | DELETE | - | `{ "success": true, "message": string }` | 200 |
| | | | `{ "success": false, "message": string }` | 403, 404 |

### 6.6 Nội dung khóa học (chương + bài giảng)

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/courses/:courseId/chapters` | GET | - | `{ "success": true, "data": { "course": {...}, "chapters": [{ "id", "title", "order", "courseId", "Lectures": [...] }] } }` | 200 |
| | | | `{ "success": false, "message": string }` | 403, 404 |

### 6.7 Tạo chương

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/courses/:courseId/chapters` | POST | `{ "title": string, "order"?: number }` | `{ "success": true, "message": string, "data": { "chapter": { "id", "title", "order", "courseId" } } }` | 201 |
| | | | `{ "success": false, "message": "Tiêu đề chương không được để trống" }` | 400 |
| | | | `{ "success": false, "message": string }` | 403, 404 |

### 6.8 Cập nhật chương

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/chapters/:id` | PUT | `{ "title"?: string, "order"?: number }` | `{ "success": true, "message": string, "data": { "chapter": {...} } }` | 200 |
| | | | `{ "success": false, "message": string }` | 403, 404 |

### 6.9 Xóa chương (và các bài giảng trong chương)

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/chapters/:id` | DELETE | - | `{ "success": true, "message": string }` | 200 |
| | | | `{ "success": false, "message": string }` | 403, 404 |

### 6.10 Tạo bài giảng

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/chapters/:chapterId/lectures` | POST | `{ "title": string, "type": string, "contentUrl"?: string, "duration"?: number, "order"?: number }` | `{ "success": true, "message": string, "data": { "lecture": { "id", "title", "type", "contentUrl", "duration", "order", "chapterId" } } }` | 201 |
| | | | `{ "success": false, "message": "Tiêu đề và loại bài giảng là bắt buộc" }` | 400 |
| | | | `{ "success": false, "message": string }` | 403, 404 |

### 6.11 Cập nhật bài giảng

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/lectures/:id` | PUT | `{ "title"?: string, "type"?: string, "contentUrl"?: string, "duration"?: number, "order"?: number }` | `{ "success": true, "message": string, "data": { "lecture": {...} } }` | 200 |
| | | | `{ "success": false, "message": string }` | 403, 404 |

### 6.12 Xóa bài giảng

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/lectures/:id` | DELETE | - | `{ "success": true, "message": string }` | 200 |
| | | | `{ "success": false, "message": string }` | 403, 404 |

---

## 7. Student (Token + role: student hoặc admin)

### 7.1 Đăng ký khóa học

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/student/courses/:courseId/enroll` | POST | - | `{ "success": true, "message": string, "data": { "enrollment": { "id", "userId", "courseId", "status", "progressPercent", "enrolledAt", "Course": { "id", "title", "slug", "price" } } } }` | 201 |
| | | | `{ "success": false, "message": "Không tìm thấy khóa học" }` | 404 |
| | | | `{ "success": false, "message": "Khóa học chưa được xuất bản" }` | 400 |
| | | | `{ "success": false, "message": "Bạn đã đăng ký khóa học này rồi", "data": { "enrollmentId" } }` | 409 |

### 7.2 Hủy đăng ký khóa học

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/student/courses/:courseId/enroll` | DELETE | - | `{ "success": true, "message": string }` | 200 |
| | | | `{ "success": false, "message": "Bạn chưa đăng ký khóa học này" }` | 404 |

### 7.3 Danh sách khóa đã đăng ký

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/student/enrollments` | GET | - | `{ "success": true, "message": string, "data": { "enrollments": [{ "id", "userId", "courseId", "status", "progressPercent", "enrolledAt", "Course": { "id", "title", "slug", "description", "price", "published", "creator": { "id", "name", "username" } } }] } }` | 200 |

### 7.4 Chi tiết đăng ký một khóa (tiến độ)

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/student/enrollments/course/:courseId` | GET | - | `{ "success": true, "data": { "enrollment": { "id", "userId", "courseId", "status", "progressPercent", "enrolledAt", "Course": { "id", "title", "slug", "description", "price", "creator": {...} } } } }` | 200 |
| | | | `{ "success": false, "message": "Bạn chưa đăng ký khóa học này" }` | 404 |

### 7.5 Cập nhật tiến độ

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/student/progress/:courseId` | PUT | `{ "progressPercent": number }` *(0–100)* | `{ "success": true, "message": string, "data": { "enrollment": {...} } }` | 200 |
| | | | `{ "success": false, "message": "Tiến độ phải là số từ 0 đến 100" }` | 400 |
| | | | `{ "success": false, "message": "Bạn chưa đăng ký khóa học này" }` | 404 |

### 7.6 Nộp bài tập *(mock – chưa tích hợp DB)*

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/student/submit-assignment` | POST | *(tùy FE)* | `{ "success": true, "message": string, "data": { "submissionId", "status", "submittedAt" } }` | 200 |

---

## 8. Reviews API

### 8.1 Lấy danh sách đánh giá của khóa học *(Public)*

| Endpoint | Method | Query | Response | Status |
|----------|--------|-------|----------|--------|
| `/api/courses/:courseId/reviews` | GET | `page?: number`, `limit?: number`, `rating?: 1-5`, `sort?: newest|oldest|highest|lowest` | `{ "success": true, "data": { "reviews": [{ "id", "userId", "courseId", "rating", "comment", "createdAt", "User": { "id", "name", "avatar" } }], "statistics": { "averageRating", "totalReviews", "distribution": { "5": number, "4": number, "3": number, "2": number, "1": number } }, "pagination": { "total", "page", "limit", "totalPages" } } }` | 200 |

### 8.2 Tạo đánh giá khóa học *(Student/Admin)*

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/student/courses/:courseId/reviews` | POST | `{ "rating": 1-5, "comment": string (10-1000 chars) }` | `{ "success": true, "message": string, "data": { "review": { "id", "userId", "courseId", "rating", "comment", "createdAt", "User": { "id", "name", "avatar" } } } }` | 201 |
| | | | `{ "success": false, "message": "Bạn cần đăng ký khóa học này để đánh giá" }` | 403 |
| | | | `{ "success": false, "message": "Bạn đã đánh giá khóa học này" }` | 409 |

### 8.3 Cập nhật đánh giá *(Student/Admin)*

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/student/reviews/:reviewId` | PUT | `{ "rating": 1-5, "comment": string (10-1000 chars) }` | `{ "success": true, "message": string, "data": { "review": {...} } }` | 200 |
| | | | `{ "success": false, "message": "Bạn không có quyền cập nhật đánh giá này" }` | 403 |

### 8.4 Xóa đánh giá *(Student/Admin)*

| Endpoint | Method | Response | Status |
|----------|--------|----------|--------|
| `/api/student/reviews/:reviewId` | DELETE | `{ "success": true, "message": string }` | 200 |
| | | `{ "success": false, "message": "Bạn không có quyền xóa đánh giá này" }` | 403 |

### 8.5 Lấy đánh giá của user *(Student/Admin)*

| Endpoint | Method | Query | Response | Status |
|----------|--------|-------|----------|--------|
| `/api/student/reviews` | GET | `page?: number`, `limit?: number` | `{ "success": true, "data": { "reviews": [{ "id", "userId", "courseId", "rating", "comment", "createdAt", "Course": { "id", "title", "slug", "price" } }], "pagination": { "total", "page", "limit", "totalPages" } } }` | 200 |

---

## 9. Notifications API

### 9.1 Lấy danh sách thông báo *(User)*

| Endpoint | Method | Query | Response | Status |
|----------|--------|-------|----------|--------|
| `/api/notifications` | GET | `page?: number`, `limit?: number` | `{ "success": true, "data": { "notifications": [{ "id", "userId", "type", "title", "message", "isRead", "payload": {}, "createdAt" }] } }` | 200 |

### 9.2 Lấy số thông báo chưa đọc *(User)*

| Endpoint | Method | Response | Status |
|----------|--------|----------|--------|
| `/api/notifications/unread-count` | GET | `{ "success": true, "data": { "unreadCount": number } }` | 200 |

### 9.3 Đánh dấu đã đọc thông báo *(User)*

| Endpoint | Method | Response | Status |
|----------|--------|----------|--------|
| `/api/notifications/:notificationId/read` | PUT | `{ "success": true, "message": string }` | 200 |

### 9.4 Đánh dấu tất cả đã đọc *(User)*

| Endpoint | Method | Response | Status |
|----------|--------|----------|--------|
| `/api/notifications/read-all` | PUT | `{ "success": true, "message": string }` | 200 |

### 9.5 Xóa thông báo *(User)*

| Endpoint | Method | Response | Status |
|----------|--------|----------|--------|
| `/api/notifications/:notificationId` | DELETE | `{ "success": true, "message": string }` | 200 |

### 9.6 Gửi thông báo *(Admin)*

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/notifications/send` | POST | `{ "userIds": number[], "type": string, "title": string, "message": string, "payload": {} }` | `{ "success": true, "message": string }` | 200 |

---

## 10. Payments API

### 10.1 Xử lý thanh toán *(Student/Admin)*

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/student/payments/process` | POST | `{ "courseId": number, "paymentMethod": string, "paymentDetails": {} }` | `{ "success": true, "message": string, "data": { "payment": { "id", "userId", "courseId", "amount", "status", "paymentMethod", "transactionId", "createdAt" } } }` | 201 |

### 10.2 Xác minh thanh toán *(Student/Admin)*

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/student/payments/verify` | POST | `{ "paymentId": number, "verificationData": {} }` | `{ "success": true, "message": string, "data": { "payment": {...} } }` | 200 |

### 10.3 Lấy danh sách thanh toán *(Student/Admin)*

| Endpoint | Method | Query | Response | Status |
|----------|--------|-------|----------|--------|
| `/api/student/payments` | GET | `page?: number`, `limit?: number` | `{ "success": true, "data": { "payments": [{ "id", "userId", "courseId", "amount", "status", "paymentMethod", "transactionId", "createdAt", "Course": { "id", "title", "slug" } }], "pagination": { "total", "page", "limit", "totalPages" } } }` | 200 |

### 10.4 Chi tiết thanh toán *(Student/Admin)*

| Endpoint | Method | Response | Status |
|----------|--------|----------|--------|
| `/api/student/payments/:paymentId` | GET | `{ "success": true, "data": { "payment": {...} } }` | 200 |

---

## 11. Quizzes API

### 11.1 Tạo quiz *(Teacher/Admin)*

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/courses/:courseId/quizzes` | POST | `{ "title": string, "maxScore": number, "timeLimit": number, "passingScore": number }` | `{ "success": true, "message": string, "data": { "quiz": { "id", "title", "maxScore", "timeLimit", "passingScore", "courseId", "createdBy" } } }` | 201 |

### 11.2 Lấy danh sách quiz của khóa học *(Teacher/Admin)*

| Endpoint | Method | Response | Status |
|----------|--------|----------|--------|
| `/api/teacher/courses/:courseId/quizzes` | GET | `{ "success": true, "data": { "quizzes": [{ "id", "title", "maxScore", "timeLimit", "passingScore", "courseId", "createdBy", "createdAt" }] } }` | 200 |

### 11.3 Chi tiết quiz *(Teacher/Admin)*

| Endpoint | Method | Response | Status |
|----------|--------|----------|--------|
| `/api/teacher/quizzes/:quizId` | GET | `{ "success": true, "data": { "quiz": {...} } }` | 200 |

### 11.4 Cập nhật quiz *(Teacher/Admin)*

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/quizzes/:quizId` | PUT | `{ "title": string, "maxScore": number, "timeLimit": number, "passingScore": number }` | `{ "success": true, "message": string, "data": { "quiz": {...} } }` | 200 |

### 11.5 Xóa quiz *(Teacher/Admin)*

| Endpoint | Method | Response | Status |
|----------|--------|----------|--------|
| `/api/teacher/quizzes/:quizId` | DELETE | `{ "success": true, "message": string }` | 200 |

### 11.6 Thêm câu hỏi vào quiz *(Teacher/Admin)*

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/teacher/quizzes/:quizId/questions` | POST | `{ "type": "multiple_choice|true_false|short_answer|essay", "content": string, "points": number, "options": string[] (if multiple_choice), "correctAnswer": string (if multiple_choice) }` | `{ "success": true, "message": string, "data": { "question": { "id", "type", "content", "points", "quizId", "options", "correctAnswer" } } }` | 201 |

### 11.7 Lấy thống kê attempts *(Teacher/Admin)*

| Endpoint | Method | Response | Status |
|----------|--------|----------|--------|
| `/api/teacher/quizzes/:quizId/attempts` | GET | `{ "success": true, "data": { "attempts": [{ "id", "userId", "quizId", "score", "status", "startedAt", "submittedAt", "User": { "id", "name", "email" } }] } }` | 200 |

### 11.8 Bắt đầu làm bài *(Student)*

| Endpoint | Method | Response | Status |
|----------|--------|----------|--------|
| `/api/student/quizzes/:quizId/start` | POST | `{ "success": true, "message": string, "data": { "attempt": { "id", "userId", "quizId", "status", "startedAt", "expiresAt" } } }` | 201 |

### 11.9 Nộp bài *(Student)*

| Endpoint | Method | Body | Response | Status |
|----------|--------|------|----------|--------|
| `/api/student/attempts/:attemptId/submit` | POST | `{ "answers": { "questionId": "answer" } }` | `{ "success": true, "message": string, "data": { "attempt": { "id", "score", "status", "submittedAt" } } }` | 200 |

### 11.10 Lấy lịch sử làm bài *(Student)*

| Endpoint | Method | Response | Status |
|----------|--------|----------|--------|
| `/api/student/quizzes/:quizId/attempts` | GET | `{ "success": true, "data": { "attempts": [{ "id", "score", "status", "startedAt", "submittedAt" }] } }` | 200 |

---

## 12. Lỗi chung

| Status | Response |
|--------|----------|
| 401 | `{ "success": false, "message": "Token không hợp lệ / hết hạn" }` |
| 403 | `{ "success": false, "message": "Không có quyền truy cập" }` |
| 404 | `{ "success": false, "message": "Endpoint không tồn tại" }` |
| 500 | `{ "success": false, "message": "Lỗi máy chủ", "error"?: string }` |

---

## 13. Ghi chú cho FE

1. **Token:** Lưu `data.token` từ `/api/auth/login`, gửi trong header `Authorization: Bearer <token>` cho mọi API cần đăng nhập.
2. **Role:** `student`, `teacher`, `admin` – mỗi nhóm có endpoint riêng (admin dùng chung teacher + student).
3. **CORS:** Backend cho phép origin mặc định `http://localhost:3000`; production cần cấu hình `ALLOWED_ORIGINS`.
4. **Rate limit:** Auth có giới hạn request; nếu vượt quá sẽ trả về 429.
5. **Reviews:** User chỉ có thể đánh giá khóa học đã đăng ký và chỉ đánh giá được 1 lần.
6. **Quizzes:** Hỗ trợ nhiều loại câu hỏi: multiple_choice, true_false, short_answer, essay.
7. **Payments:** Hiện tại đang dùng mock payment method, production cần tích hợp gateway thực tế.
8. **Notifications:** Auto-generated cho các events quan trọng (enrollment, payment, quiz completion).
