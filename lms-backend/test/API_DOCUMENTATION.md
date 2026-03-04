# LMS Backend - API Documentation

## Authentication API

### Base URL
```
http://localhost:5000
```

### Environment Variables (Postman)
- `base_url`: http://localhost:5000
- `auth_token`: JWT token for authenticated requests
- `user_id`: User ID
- `user_email`: User email

*Ví dụ các tài khoản test có thể dùng: **Trịnh Ngọc Thái** (`thai@example.com`) và **Trần Thảo Tiên** (`tien@example.com`).*

---

## 1. Register (Đăng ký)

**Endpoint:** `POST /api/auth/register`

**Description:** Tạo tài khoản mới và gửi email xác nhận

**Request Body:**
```json
{
  "name": "Trịnh Ngọc Thái",
  "username": "thaingocthai",
  "email": "thai@example.com",
  "phone": "+84901234567",
  "password": "password123",
  "role": "student"  // optional: student, teacher, admin
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản",
  "data": {
    "user": {
      "id": 1,
      "name": "Trịnh Ngọc Thái",
      "username": "thaingocthai",
      "email": "thai@example.com",
      "phone": "+84901234567",
      "role": "student",
      "isEmailVerified": false
    }
    ,"verificationCode": "123456"   // mã 6 chữ số gửi trong email
  }
}
```

---

## 2. Verify Email by Link

**Endpoint:** `GET /api/auth/verify-email/:token`

**Description:** Xác nhận email thông qua link từ email

**URL Parameter:**
- `token`: Email verification token (từ email)
  *lưu ý: hiện đây là mã 6 chữ số tự nhiên được gửi vào thư, không phải chuỗi dài*

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email đã được xác nhận thành công. Bạn có thể đăng nhập ngay",
  "data": {
    "user": {
      "id": 1,
      "name": "Trịnh Ngọc Thái",
      "username": "thaingocthai",
      "email": "thai@example.com",
      "phone": "+84901234567",
      "role": "student",
      "isEmailVerified": true
    }
  }
}
```

---

## 3. Verify Email by Code

**Endpoint:** `POST /api/auth/verify-email-code`

**Description:** Xác nhận email bằng token (nếu không muốn click link)

**Request Body:**
```json
{
  "token": "your_verification_token_here"
}
```
*(`token` là mã 6 chữ số bạn nhận được trong email xác nhận, ví dụ `123456`.)*

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email đã được xác nhận thành công",
  "data": {
    "user": {
      "id": 1,
      "name": "Trịnh Ngọc Thái",
      "username": "thaingocthai",
      "email": "thai@example.com",
      "phone": "+84901234567",
      "role": "student",
      "isEmailVerified": true
    }
  }
}
```

---

## 4. Resend Verification Email

**Endpoint:** `POST /api/auth/resend-verification-email`

**Description:** Gửi lại email xác nhận

**Request Body:**
```json
{
  "email": "thai@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email xác nhận đã được gửi lại. Vui lòng kiểm tra email"
}
```

---

## 5. Login (Đăng nhập)

**Endpoint:** `POST /api/auth/login`

**Description:** Đăng nhập và nhận JWT token

**Request Body:**
```json
{
  "username": "thaingocthai",
  "password": "password123"
}
```
*(`email` cũng có thể gửi thay cho `username` nếu muốn)*

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "user": {
      "id": 1,
      "name": "Trịnh Ngọc Thái",
      "username": "thaingocthai",
      "email": "thai@example.com",
      "phone": "+84901234567",
      "role": "student"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 6. Get Current User

**Endpoint:** `GET /api/auth/me`

**Description:** Lấy thông tin user hiện tại (yêu cầu JWT token)

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Trịnh Ngọc Thái",
    "email": "thai@example.com",
    "role": "student",
    "avatar": null,
    "isEmailVerified": true
  }
}
```

---

## 7. Forgot Password (Quên mật khẩu)

**Endpoint:** `POST /api/auth/forgot-password`

**Description:** Yêu cầu đặt lại mật khẩu và gửi email

**Request Body:**
```json
{
  "email": "thai@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra email"
}
```

---

## 8. Reset Password (Đặt lại mật khẩu)

**Endpoint:** `POST /api/auth/reset-password`

**Description:** Đặt lại mật khẩu bằng token

**Request Body:**
```json
{
  "token": "your_reset_password_token_here",
  "password": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập"
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
      "msg": "Email không hợp lệ",
      "param": "email"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Token không hợp lệ"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Email chưa được xác nhận. Vui lòng kiểm tra email"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Không tìm thấy tài khoản"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Email đã được sử dụng"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Lỗi máy chủ",
  "error": "error message"
}
```

---

## Enrollments API (Student)

Tất cả endpoint dưới đây yêu cầu **Bearer token** (đăng nhập với role `student` hoặc `admin`).  
Header: `Authorization: Bearer {{auth_token}}`

### 1. Đăng ký khóa học (Enroll)

**Endpoint:** `POST /api/student/courses/:courseId/enroll`

**Description:** Học viên đăng ký vào một khóa học (khóa phải đã published).

**URL Parameter:** `courseId` – ID khóa học.

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Đăng ký khóa học thành công",
  "data": {
    "enrollment": {
      "id": 1,
      "userId": 2,
      "courseId": 1,
      "status": "enrolled",
      "progressPercent": 0,
      "enrolledAt": "2025-03-01T10:00:00.000Z",
      "Course": { "id": 1, "title": "JavaScript Basics", "slug": "javascript-basics", "price": "0.00" }
    }
  }
}
```

**Lỗi thường gặp:**
- `404` – Không tìm thấy khóa học.
- `400` – Khóa học chưa xuất bản.
- `409` – Đã đăng ký khóa này rồi.

---

### 2. Hủy đăng ký (Unenroll)

**Endpoint:** `DELETE /api/student/courses/:courseId/enroll`

**Description:** Học viên hủy đăng ký khóa học.

**URL Parameter:** `courseId` – ID khóa học.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Đã hủy đăng ký khóa học"
}
```

**Lỗi:** `404` – Chưa đăng ký khóa này.

---

### 3. Danh sách khóa đã đăng ký

**Endpoint:** `GET /api/student/enrollments`

**Description:** Lấy danh sách tất cả khóa học mà học viên đã đăng ký (có thông tin khóa + creator).

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Danh sách khóa học của bạn",
  "data": {
    "enrollments": [
      {
        "id": 1,
        "userId": 2,
        "courseId": 1,
        "status": "enrolled",
        "progressPercent": 75,
        "enrolledAt": "2025-03-01T10:00:00.000Z",
        "Course": {
          "id": 1,
          "title": "JavaScript Basics",
          "slug": "javascript-basics",
          "description": "...",
          "price": "0.00",
          "published": true,
          "creator": { "id": 1, "name": "GV A", "username": "gva" }
        }
      }
    ]
  }
}
```

---

### 4. Chi tiết đăng ký một khóa

**Endpoint:** `GET /api/student/enrollments/course/:courseId`

**Description:** Xem chi tiết đăng ký (và tiến độ) của một khóa cụ thể.

**URL Parameter:** `courseId` – ID khóa học.

**Response (200 OK):** Trả về một `enrollment` kèm thông tin `Course` và `creator`.  
**Lỗi:** `404` – Chưa đăng ký khóa này.

---

### 5. Cập nhật tiến độ

**Endpoint:** `PUT /api/student/progress/:courseId`

**Description:** Cập nhật phần trăm hoàn thành khóa học (0–100).

**URL Parameter:** `courseId` – ID khóa học.

**Request Body:**
```json
{
  "progressPercent": 75
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Cập nhật tiến độ thành công",
  "data": { "enrollment": { "id": 1, "progressPercent": 75, ... } }
}
```

**Lỗi:** `400` – progressPercent không hợp lệ; `404` – Chưa đăng ký khóa này.

---

## How to Use with Postman

1. **Import Collection**: 
   - Open Postman
   - Click "Import" → chọn file `LMS_Auth_API.postman_collection.json`

2. **Biến collection (Variables)**:
   - `base_url`: `http://localhost:5000`
   - `auth_token`: được gán tự động sau khi gọi **Login**
   - `course_id`: ID khóa học (ví dụ `1`) – dùng cho folder **Enrollments**

3. **Test Auth**:  
   Register → Verify Email by Code → Login → Get Current User

4. **Test Enrollments** (cần token student):
   - Đăng nhập bằng tài khoản **student** (Login).
   - (Tùy chọn) Tạo khóa học đã **published** bằng tài khoản teacher, hoặc dùng khóa có sẵn.
   - Trong collection, mở folder **Enrollments**.
   - Sửa biến `course_id` = ID khóa học muốn test (ví dụ `1`).
   - Gọi lần lượt:
     1. **Enroll in course** → 201, có `data.enrollment`.
     2. **Get my enrollments** → danh sách có khóa vừa đăng ký.
     3. **Get enrollment by course** → chi tiết đăng ký + tiến độ.
     4. **Update progress** → body `{"progressPercent": 75}` → 200.
     5. **Unenroll** → 200; gọi lại **Get my enrollments** để xác nhận đã bỏ khóa.
   - Gọi **Enroll in course** hai lần cho cùng `course_id` → lần 2 trả về **409** (đã đăng ký rồi).

---

## Email Configuration

### For Gmail (Gmail App Password)
1. Enable 2-Step Verification
2. Generate App Password
3. Update `.env`:
   ```
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_password
   ```

### For Other Email Providers
Update `.env` with appropriate SMTP settings:
```
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your_email
EMAIL_PASSWORD=your_password
```

---

## Notes

- Email verification token expires in 24 hours
- Reset password token expires in 1 hour
- JWT token expires in 7 days (configurable)
- All passwords are hashed using bcryptjs
