# Security Testing Guide

## Overview
File `test-security.sh` là một script tự động để test tất cả tính năng bảo mật và kiểm soát quyền truy cập trong LMS Backend.

## Yêu cầu

### 1. Server đang chạy
```bash
cd d:\khoaluantotnghiep\lms-backend
npm start
```

### 2. Tạo Admin Account
Trước khi chạy test, bạn cần có một admin account trong database:

**Option 1: Tạo thủ công trong database**
```sql
INSERT INTO users (name, username, email, passwordHash, role, isEmailVerified) 
VALUES ('Admin User', 'admin', 'admin@example.com', '$2b$10$...', 'admin', 1);
```

**Option 2: Sử dụng API register**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "username": "admin",
    "email": "admin@example.com",
    "password": "admin123",
    "role": "admin"
  }'
```

Sau đó verify email trong database:
```sql
UPDATE users SET isEmailVerified = 1 WHERE email = 'admin@example.com';
```

## Chạy Test Script

### Trên Windows (Git Bash / WSL)
```bash
# Set environment variables
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=admin123

# Make script executable
chmod +x test-security.sh

# Run tests
./test-security.sh
```

### Trên PowerShell
```powershell
# Set environment variables
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="admin123"

# Run tests
bash test-security.sh
```

## Các Test Cases

### ✅ Authentication Tests
1. **Health Check** - Kiểm tra server status
2. **User Registration** - Đăng ký student account
3. **Email Verification** - Xác minh email với verification code
4. **Login** - Lấy JWT tokens cho tất cả roles
5. **Missing Token** - Test khi không có token
6. **Invalid Token** - Test với token không hợp lệ

### ✅ Authorization Tests
7. **Student Access** - Student truy cập student endpoints
8. **Teacher Denied Admin** - Teacher không thể truy cập admin endpoints
9. **Student Denied Teacher** - Student không thể truy cập teacher endpoints
10. **Admin Access All** - Admin có thể truy cập tất cả endpoints

## Kết quả mong đợi

```
==========================================
LMS Backend - Security Testing Suite
==========================================

[TEST] Health Check Endpoint
---
✓ Server is running

[TEST] Register Student User
---
✓ Student registered (ID: 123)
  Email: student_1234567890@example.com
  Verification Code: 123456

[TEST] Login Admin (bootstrap account required)
---
✓ Admin login successful

[TEST] Email Verification
---
✓ Student email verified

[TEST] Admin creates Teacher user
---
✓ Teacher created by admin
  Email: teacher_1234567891@example.com

[TEST] Login - Get JWT Tokens
---
✓ Student login successful
✓ Teacher login successful

[TEST] Authorization - Student Access
---
✓ Student can access student endpoints

[TEST] Authorization - Teacher Denied Admin Access
---
✓ Teacher correctly denied access to admin endpoint

[TEST] Authorization - Student Denied Teacher Access
---
✓ Student correctly denied access to teacher endpoint

[TEST] Authorization - Admin Access All
---
✓ Admin can access admin endpoints
✓ Admin can access teacher endpoints

[TEST] Authentication - Missing Token
---
✓ Missing token correctly rejected

[TEST] Authentication - Invalid Token
---
✓ Invalid token correctly rejected

==========================================
Security Testing Summary
==========================================
✓ All tests completed!

Key Features Verified:
  ✓ Registration (self-register student only)
  ✓ Admin creates teacher/student accounts
  ✓ Email verification with 6-digit codes
  ✓ JWT token generation
  ✓ Student role access
  ✓ Teacher role access
  ✓ Admin role access
  ✓ Authorization enforcement
  ✓ Token validation

Generated Tokens (for manual testing):
  Student: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Teacher: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Admin:   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
==========================================
```

## Troubleshooting

### Lỗi "Server health check failed"
- Kiểm tra server có đang chạy trên port 5000 không
- Kiểm tra firewall có block port 5000 không

### Lỗi "Admin login failed"
- Đảm bảo admin account tồn tại trong database
- Kiểm tra `isEmailVerified = 1` cho admin account
- Kiểm tra username/password đúng

### Lỗi "Email verification failed"
- Kiểm tra verification code có được generate không
- Kiểm tra API endpoint `/api/auth/verify-email-code`

### Lỗi "Authorization check failed"
- Kiểm tra middleware `authorizeRole` có hoạt động đúng không
- Kiểm tra JWT token có được decode đúng không

## Manual Testing với Generated Tokens

Sau khi chạy script, bạn sẽ có 3 tokens để test manual:

```bash
# Student token
curl -H "Authorization: Bearer <STUDENT_TOKEN>" \
  http://localhost:5000/api/student/enrollments

# Teacher token  
curl -H "Authorization: Bearer <TEACHER_TOKEN>" \
  http://localhost:5000/api/teacher/courses

# Admin token
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  http://localhost:5000/api/admin/users
```

## Security Features Đã Test

1. **Password Hashing** - Mật khẩu được hash với bcrypt
2. **JWT Authentication** - Token-based authentication
3. **Role-Based Access Control** - Student/Teacher/Admin permissions
4. **Email Verification** - 6-digit verification codes
5. **Input Validation** - Express-validator rules
6. **CORS Protection** - Origin validation
7. **Rate Limiting** - Request rate limiting
8. **Authorization Middleware** - Route protection
9. **Token Validation** - JWT signature verification
10. **Error Handling** - Consistent error responses
