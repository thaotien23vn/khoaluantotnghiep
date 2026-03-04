# LMS Notifications System - API Documentation

## Base URL
```
http://localhost:5000
```

## Authentication
All notification endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

---

## Student Routes

### 1. Get User Notifications

**Endpoint:** `GET /api/student/notifications`

**Description:** Lấy danh sách thông báo của user

**Query Parameters:**
- `page` (optional): Số trang (default: 1)
- `limit` (optional): Số lượng mỗi trang (default: 20, max: 100)
- `type` (optional): Lọc theo loại thông báo
- `read` (optional): Lọc theo trạng thái đọc (`true`/`false`)

**Notification Types:**
- `enrollment` - Đăng ký khóa học
- `quiz` - Bài kiểm tra
- `review` - Đánh giá khóa học
- `payment` - Thanh toán
- `course_update` - Cập nhật khóa học
- `certificate` - Chứng chỉ
- `announcement` - Thông báo chung

**Example:** `GET /api/student/notifications?page=1&limit=10&type=quiz&read=false`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": 1,
        "userId": 2,
        "type": "enrollment",
        "title": "Đăng ký khóa học thành công",
        "message": "Bạn đã đăng ký thành công khóa học \"JavaScript Advanced\"",
        "payload": {
          "courseId": 1,
          "courseTitle": "JavaScript Advanced"
        },
        "read": false,
        "createdAt": "2025-03-04T10:00:00.000Z",
        "updatedAt": "2025-03-04T10:00:00.000Z"
      }
    ],
    "unreadCount": 5,
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    }
  }
}
```

---

### 2. Get Unread Count

**Endpoint:** `GET /api/student/notifications/unread-count`

**Description:** Lấy số lượng thông báo chưa đọc

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

---

### 3. Mark as Read

**Endpoint:** `PUT /api/student/notifications/:notificationId/read`

**Description:** Đánh dấu thông báo là đã đọc

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Đã đánh dấu là đã đọc",
  "data": {
    "notification": {
      "id": 1,
      "read": true,
      "updatedAt": "2025-03-04T11:00:00.000Z"
    }
  }
}
```

---

### 4. Mark All as Read

**Endpoint:** `PUT /api/student/notifications/read-all`

**Description:** Đánh dấu tất cả thông báo là đã đọc

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Đã đánh dấu tất cả là đã đọc"
}
```

---

### 5. Delete Notification

**Endpoint:** `DELETE /api/student/notifications/:notificationId`

**Description:** Xóa thông báo

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Xóa thông báo thành công"
}
```

---

## Admin Routes

### 1. Send Notification

**Endpoint:** `POST /api/admin/notifications/send`

**Description:** Gửi thông báo đến nhiều user (Admin)

**Request Body:**
```json
{
  "userIds": [1, 2, 3],
  "type": "announcement",
  "title": "Bảo trì hệ thống",
  "message": "Hệ thống sẽ bảo trì từ 22:00 - 23:00 tối nay",
  "payload": {
    "maintenanceStart": "2025-03-04T22:00:00Z",
    "maintenanceEnd": "2025-03-04T23:00:00Z"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Đã gửi thông báo đến 3 người dùng"
}
```

---

### 2. Get All Notifications

**Endpoint:** `GET /api/admin/notifications`

**Description:** Lấy tất cả thông báo (Admin)

**Query Parameters:**
- `page` (optional): Số trang (default: 1)
- `limit` (optional): Số lượng mỗi trang (default: 20, max: 100)
- `userId` (optional): Lọc theo user ID
- `type` (optional): Lọc theo loại thông báo
- `read` (optional): Lọc theo trạng thái đọc (`true`/`false`)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": 1,
        "userId": 2,
        "type": "enrollment",
        "title": "Đăng ký khóa học thành công",
        "message": "Bạn đã đăng ký thành công khóa học \"JavaScript Advanced\"",
        "read": false,
        "createdAt": "2025-03-04T10:00:00.000Z",
        "user": {
          "id": 2,
          "name": "Nguyen Van A",
          "email": "a@example.com"
        }
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

---

## Notification Types & Payloads

### 1. Enrollment
```json
{
  "type": "enrollment",
  "title": "Đăng ký khóa học thành công",
  "message": "Bạn đã đăng ký thành công khóa học \"JavaScript Advanced\"",
  "payload": {
    "courseId": 1,
    "courseTitle": "JavaScript Advanced"
  }
}
```

### 2. Quiz Completion
```json
{
  "type": "quiz",
  "title": "Hoàn thành bài kiểm tra",
  "message": "Chúc mừng! Bạn đã hoàn thành bài kiểm tra \"JavaScript Basics\" với điểm 85",
  "payload": {
    "quizId": 1,
    "quizTitle": "JavaScript Basics",
    "courseId": 1,
    "courseTitle": "JavaScript Advanced",
    "score": 85,
    "passed": true
  }
}
```

### 3. Course Review
```json
{
  "type": "review",
  "title": "Đánh giá mới cho khóa học",
  "message": "Nguyen Van A đã đánh giá 5 sao cho khóa học \"JavaScript Advanced\"",
  "payload": {
    "courseId": 1,
    "courseTitle": "JavaScript Advanced",
    "reviewId": 1,
    "rating": 5,
    "reviewerName": "Nguyen Van A"
  }
}
```

### 4. Payment
```json
{
  "type": "payment",
  "title": "Thanh toán thành công",
  "message": "Thanh toán 99.99 USD cho khóa học \"JavaScript Advanced\" đã được xác nhận",
  "payload": {
    "courseId": 1,
    "courseTitle": "JavaScript Advanced",
    "amount": 99.99
  }
}
```

### 5. Course Update
```json
{
  "type": "course_update",
  "title": "Bài giảng mới",
  "message": "Khóa học \"JavaScript Advanced\" có bài giảng mới: Async Programming",
  "payload": {
    "courseId": 1,
    "courseTitle": "JavaScript Advanced",
    "updateType": "new_lecture",
    "updateContent": "Async Programming"
  }
}
```

### 6. Certificate
```json
{
  "type": "certificate",
  "title": "Chứng chỉ hoàn thành",
  "message": "Chúc mừng! Bạn đã nhận được chứng chỉ hoàn thành khóa học \"JavaScript Advanced\"",
  "payload": {
    "courseId": 1,
    "courseTitle": "JavaScript Advanced"
  }
}
```

---

## Automatic Notification Triggers

### Enrollment Events
- User enrolls in course → `enrollment` notification
- Payment completed → `payment` notification

### Quiz Events
- Quiz completed → `quiz` notification
- Quiz passed/failed → different messages

### Review Events
- New review posted → `review` notification to teacher

### Course Updates
- New lecture added → `course_update` notification
- New chapter added → `course_update` notification
- Course announcement → `course_update` notification

### Achievement Events
- Course completed → `certificate` notification
- Milestone reached → `announcement` notification

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Dữ liệu không hợp lệ",
  "errors": [
    {
      "msg": "Tiêu đề không được để trống",
      "param": "title"
    }
  ]
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Bạn không có quyền cập nhật thông báo này"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Không tìm thấy thông báo"
}
```

---

## Frontend Integration Examples

### Notification Bell Component
```javascript
// Fetch unread count
const { data } = await api.get('/api/student/notifications/unread-count');
setUnreadCount(data.unreadCount);

// Fetch notifications when clicked
const { data } = await api.get('/api/student/notifications?limit=10&read=false');
setNotifications(data.notifications);
```

### Notification List Component
```javascript
// Load notifications with pagination
const loadNotifications = async (page = 1) => {
  const { data } = await api.get(`/api/student/notifications?page=${page}&limit=20`);
  setNotifications(data.notifications);
  setPagination(data.pagination);
  setUnreadCount(data.unreadCount);
};

// Mark as read
const markAsRead = async (notificationId) => {
  await api.put(`/api/student/notifications/${notificationId}/read`);
  // Update local state
};
```

### Real-time Updates (Future)
```javascript
// WebSocket connection for real-time notifications
const ws = new WebSocket('ws://localhost:5000/notifications');
ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  setNotifications(prev => [notification, ...prev]);
  setUnreadCount(prev => prev + 1);
};
```

---

## Performance Considerations

- Database indexes on user_id, type, read, created_at
- Pagination for large notification sets
- Unread count caching
- Bulk operations for admin notifications
- Soft delete for audit trail
- Archive old notifications periodically

---

## Security Considerations

- User can only access their own notifications
- Admin can access all notifications
- Input sanitization for notification content
- Rate limiting on notification endpoints
- Audit trail for admin actions
