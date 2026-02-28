# 🔐 LMS Backend - Security & Authorization Testing Guide

## Overview
Your LMS backend now includes comprehensive security features and role-based authorization. This document explains all security features and provides step-by-step testing instructions.

---

## 1. ✅ Security Features Implemented

### 1.1 Authentication & Authorization
- ✅ **JWT Token-based Authentication**: Secure stateless session management
- ✅ **Role-Based Access Control (RBAC)**: Three roles - `student`, `teacher`, `admin`
- ✅ **Password Hashing**: bcryptjs with 10 salt rounds
- ✅ **Email Verification**: 6-digit numeric codes
- ✅ **Password Reset**: With secure token expiration

### 1.2 Protection Against Attacks
- ✅ **Helmet**: Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- ✅ **CORS**: Cross-Origin Resource Sharing protection
- ✅ **Rate Limiting**: Prevents brute force attacks
  - General API: 100 requests per 15 minutes
  - Login: 5 attempts per 15 minutes
  - Email Verification: 3 attempts per hour
  - Password Reset: 3 attempts per hour
- ✅ **Input Sanitization**: Removes dangerous characters to prevent XSS/SQL injection
- ✅ **HTTPS Ready**: Recommend using HTTPS in production

### 1.3 Rate Limiting Details

| Endpoint | Limit | Time Window |
|----------|-------|-------------|
| `/api/auth/register` | 5 attempts | 15 minutes |
| `/api/auth/login` | 5 attempts | 15 minutes |
| `/api/auth/verify-email*` | 3 attempts | 1 hour |
| `/api/auth/forgot-password` | 3 attempts | 1 hour |
| `/api/auth/reset-password` | 3 attempts | 1 hour |
| All `/api/*` endpoints | 100 requests | 15 minutes |

---

## 2. 🧪 Testing Instructions

### Prerequisites
- Server running: `npm start`
- Postman or similar API testing tool
- Have registered test users with different roles

### Step 1: Register Test Users

**Endpoint**: `POST /api/auth/register`

Register users with different roles for testing:

#### User 1 - Student
```json
{
  "name": "Trần Thảo Tiên",
  "username": "thangtien",
  "email": "thangtien@example.com",
  "phone": "+84912345678",
  "password": "password123",
  "role": "student"
}
```

#### User 2 - Teacher
```json
{
  "name": "Trịnh Ngọc Thái",
  "username": "thaitrinh",
  "email": "thaitrinh@example.com",
  "phone": "+84987654321",
  "password": "password123",
  "role": "teacher"
}
```

#### User 3 - Admin
```json
{
  "name": "Admin User",
  "username": "admin",
  "email": "admin@example.com",
  "phone": "+84911111111",
  "password": "password123",
  "role": "admin"
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản",
  "data": {
    "user": {
      "id": 1,
      "name": "Trần Thảo Tiên",
      "username": "thangtien",
      "email": "thangtien@example.com",
      "phone": "+84912345678",
      "role": "student",
      "isEmailVerified": false
    },
    "verificationCode": "123456"  // Use this code
  }
}
```

---

### Step 2: Verify Email

Use the `verificationCode` from registration response:

**Endpoint**: `POST /api/auth/verify-email-code`

```json
{
  "email": "thangtien@example.com",
  "token": "123456"
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Email xác nhận thành công",
  "data": {
    "user": {
      "id": 1,
      "isEmailVerified": true
    }
  }
}
```

---

### Step 3: Login and Get JWT Token

**Endpoint**: `POST /api/auth/login`

```json
{
  "username": "thangtien",
  "password": "password123"
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "user": {
      "id": 1,
      "name": "Trần Thảo Tiên",
      "email": "thangtien@example.com",
      "role": "student"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Save this token** - you'll need it for testing protected endpoints.

---

### Step 4: Test Protected Endpoints - Student Access

**Scenario**: Student trying to access student-only endpoints

#### Request: Get Student Enrollments
```
GET /api/student/enrollments
Authorization: Bearer <student_jwt_token>
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Danh sách khóa học của bạn",
  "data": {
    "enrollments": [
      { "id": 1, "courseName": "JavaScript Basics", "progress": 75 },
      { "id": 2, "courseName": "React Advanced", "progress": 50 }
    ]
  }
}
```

---

### Step 5: Test Authorization - Student Access to Teacher Endpoint

**Scenario**: Student trying to access teacher-only endpoint (should fail)

#### Request: Try to Create Course (Teacher only)
```
POST /api/teacher/courses
Authorization: Bearer <student_jwt_token>
Content-Type: application/json

{
  "name": "Hacker Course"
}
```

**Expected Response** (403 Forbidden):
```json
{
  "success": false,
  "message": "Bạn không có quyền truy cập. Yêu cầu role: teacher,admin"
}
```

---

### Step 6: Test Authorization - Teacher Access

Login as teacher and try the same endpoint:

#### Request: Create Course (Teacher)
```
POST /api/teacher/courses
Authorization: Bearer <teacher_jwt_token>
Content-Type: application/json

{
  "name": "Advanced JavaScript"
}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Tạo khóa học thành công",
  "data": {
    "courseId": 3,
    "name": "Advanced JavaScript"
  }
}
```

---

### Step 7: Test Admin Endpoints

Login as admin user:

#### Request: Get All Users (Admin only)
```
GET /api/admin/users
Authorization: Bearer <admin_jwt_token>
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Danh sách tất cả người dùng",
  "data": {
    "users": [
      { "id": 1, "name": "Trần Thảo Tiên", "role": "teacher" },
      { "id": 2, "name": "Trịnh Ngọc Thái", "role": "student" }
    ]
  }
}
```

#### Try with Student Token (Should Fail):
```
GET /api/admin/users
Authorization: Bearer <student_jwt_token>
```

**Expected Response** (403 Forbidden):
```json
{
  "success": false,
  "message": "Bạn không có quyền truy cập. Yêu cầu role: admin"
}
```

---

### Step 8: Test Rate Limiting

**Scenario**: Try to login 6 times quickly (limit is 5)

```bash
# Run this script to test rate limiting
for i in {1..7}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "username": "thangtien",
      "password": "password123"
    }'; echo "\nRequest #$i"
  sleep 1
done
```

**After 5th request**, you'll get:
```json
{
  "success": false,
  "message": "Quá nhiều lần đăng nhập không thành công, vui lòng thử lại sau 15 phút"
}
```

---

### Step 9: Test Missing/Invalid Token

#### Request without token:
```
GET /api/student/enrollments
```

**Expected Response** (401 Unauthorized):
```json
{
  "success": false,
  "message": "Token không được cung cấp"
}
```

#### Request with invalid token:
```
GET /api/student/enrollments
Authorization: Bearer invalid_token_xyz
```

**Expected Response** (401 Unauthorized):
```json
{
  "success": false,
  "message": "Token không hợp lệ",
  "error": "jwt malformed"
}
```

---

### Step 10: Test Input Sanitization (XSS Prevention)

**Scenario**: Try to register with XSS payload

```json
{
  "name": "<script>alert('xss')</script>",
  "username": "testuser<>",
  "email": "test@example.com",
  "phone": "+84912345678",
  "password": "password123",
  "role": "student"
}
```

**Result**: Dangerous characters are stripped:
```
Original:  <script>alert('xss')</script>
Sanitized: scriptalertxssscript
```

---

## 3. 📋 Protected Endpoint Reference

### Admin Endpoints
- `GET /api/admin/dashboard` - View admin dashboard
- `GET /api/admin/users` - List all users
- `DELETE /api/admin/users/:id` - Delete a user

### Teacher Endpoints
- `GET /api/teacher/courses` - List teacher's courses
- `POST /api/teacher/courses` - Create new course

### Student Endpoints
- `GET /api/student/enrollments` - List student's enrollments
- `GET /api/student/progress/:courseId` - Check course progress
- `POST /api/student/submit-assignment` - Submit assignment

### Note
Admins have access to all three types of endpoints (admin + teacher + student)

---

## 4. 🛡️ Security Checklist

### Before Production Deployment

- [ ] Set `process.env.NODE_ENV = 'production'`
- [ ] Enable HTTPS/SSL
- [ ] Update CORS origin:
  ```javascript
  // .env
  ALLOWED_ORIGINS=https://yourdomain.com
  ```
- [ ] Use strong JWT_SECRET (not `13062003`):
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Configure database with secure credentials
- [ ] Set up SMTP for real email sending
- [ ] Enable HTTPS_ONLY cookies if using cookies
- [ ] Add database field encryption for sensitive data
- [ ] Implement request logging and monitoring
- [ ] Set up rate limiting with Redis for distributed systems
- [ ] Regular security audits and dependency updates

---

## 5. 📊 Middleware Stack Overview

```
Request Flow:
   ↓
1. helmet() - Security headers
   ↓
2. cors() - Cross-origin protection
   ↓
3. express.json() - Parse JSON body
   ↓
4. validateInput - Sanitize input (XSS prevention)
   ↓
5. apiLimiter - Rate limiting check
   ↓
6. authMiddleware (specific routes)
   ↓
7. authorizeRole (specific routes)
   ↓
8. Controller Logic
   ↓
Response
```

---

## 6. 🔄 Role Hierarchy

```
Admin
├── Can access: admin, teacher, student endpoints
└── Can perform: all operations

Teacher
├── Can access: teacher, student endpoints
└── Can perform: create/manage courses, view enrollments

Student
├── Can access: student endpoints
└── Can perform: view enrollments, submit assignments
```

---

## 7. ⏱️ Token Expiration

- **JWT Token**: 7 days (set in `.env` as `JWT_EXPIRES_IN=7d`)
- **Email Verification Code**: 24 hours
- **Password Reset Token**: 1 hour

---

## 8. 🚀 Quick Test with Postman

Import the Postman collection and follow this order:
1. Register (choose a role)
2. Verify Email
3. Login
4. Test protected endpoints based on role
5. Try unauthorized access (should fail)

---

## 9. 📝 Error Messages Reference

| Status | Error | Meaning |
|--------|-------|---------|
| 400 | Dữ liệu không hợp lệ | Invalid input |
| 401 | Token không được cung cấp | No token provided |
| 401 | Token không hợp lệ | Invalid token |
| 403 | Bạn không có quyền truy cập | Insufficient permissions |
| 409 | Email/Username đã được sử dụng | Duplicate user |
| 429 | Quá nhiều yêu cầu | Rate limited |
| 500 | Lỗi máy chủ | Server error |

---

## 10. 🎯 Next Steps

1. **Test all endpoints** using the testing guide above
2. **Configure email** in `.env` for real email verification
3. **Update JWT_SECRET** with a strong random value
4. **Implement database logging** for security auditing
5. **Add 2FA (Two-Factor Authentication)** if needed
6. **Set up monitoring** for suspicious activities

---

**Last Updated**: February 2026
**Version**: 1.0 - Complete Security Implementation
