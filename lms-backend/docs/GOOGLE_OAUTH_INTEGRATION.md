# Google OAuth Integration Guide

## Overview
Đã tích hợp Google OAuth vào hệ thống LMS Backend cho phép người dùng đăng ký/đăng nhập bằng tài khoản Google.

## Cài đặt

### 1. Cấu hình Google OAuth Credentials

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project hiện có
3. Bật "Google+ API" hoặc "People API"
4. Đi đến "Credentials" -> "Create Credentials" -> "OAuth client ID"
5. Chọn "Web application"
6. Thêm redirect URI: `http://localhost:5000/api/auth/google/callback`
7. Lưu Client ID và Client Secret

### 2. Cập nhật .env file

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

### 3. Chạy Database Migration

```sql
-- Chạy file migration để thêm trường google_id
-- File: database/migrations/add_google_id_to_users.sql
```

## API Endpoints

### 1. Đăng nhập với Google
```
GET /api/auth/google
```
- Chuyển hướng đến trang đăng nhập Google

### 2. Callback từ Google
```
GET /api/auth/google/callback
```
- Google sẽ redirect về endpoint này sau khi người dùng xác thực
- Endpoint này sẽ xử lý và tạo JWT token, sau đó redirect về frontend

## Flow hoạt động

1. **Đăng nhập lần đầu:**
   - Người dùng click "Login with Google"
   - Chuyển hướng đến Google OAuth
   - Sau khi xác thực, Google redirect về callback
   - Hệ thống tạo user mới với thông tin từ Google
   - Tự động xác nhận email (Google emails đã được verified)
   - Tạo JWT token và redirect về frontend

2. **Đăng nhập lần sau:**
   - Hệ thống tìm user theo googleId
   - Tạo JWT token và redirect về frontend

3. **Link tài khoản Google:**
   - Nếu user đã tồn tại với email giống email Google
   - Hệ thống sẽ link Google account vào user hiện có

## Frontend Integration

### 1. Thêm nút "Login with Google"
```javascript
const loginWithGoogle = () => {
  window.location.href = 'http://localhost:5000/api/auth/google';
};
```

### 2. Xử lý callback
Frontend cần có route để xử lý callback từ Google:
```javascript
// Route: /auth/callback
const handleAuthCallback = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const user = JSON.parse(decodeURIComponent(urlParams.get('user') || '{}'));
  
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Redirect về dashboard
    window.location.href = '/dashboard';
  }
};
```

## Security Notes

- Google OAuth accounts được tự động xác nhận email
- Password hash được set thành 'google_oauth_user' cho tài khoản Google
- User không thể đổi password cho tài khoản Google (nên disable password change)
- Username được tạo theo format: `google_{googleId}`

## Testing

1. Cập nhật .env với Google credentials
2. Chạy database migration
3. Start server: `npm run dev`
4. Truy cập: `http://localhost:5000/api/auth/google`
5. Test với Google account

## Troubleshooting

### Common Issues:

1. **"redirect_uri_mismatch"**: Kiểm tra callback URL trong Google Console
2. **"invalid_client"**: Kiểm tra Client ID và Secret
3. **Database errors**: Chạy migration để thêm google_id column
4. **CORS errors**: Kiểm tra ALLOWED_ORIGINS trong .env
