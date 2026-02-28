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

## How to Use with Postman

1. **Import Collection**: 
   - Open Postman
   - Click "Import" -> Select `LMS_Auth_API.postman_collection.json`

2. **Set Environment Variables**:
   - Click "Manage Environments"
   - Edit the environment and set:
     - `base_url`: http://localhost:5000
     - `auth_token`: (will be auto-filled after login)

3. **Test Flow**:
   - Register -> Verify Email -> Login -> Get Current User

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
