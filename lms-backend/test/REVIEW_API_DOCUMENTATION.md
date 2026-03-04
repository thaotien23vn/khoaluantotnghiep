# LMS Reviews & Ratings System - API Documentation

## Base URL
```
http://localhost:5000
```

## Authentication
Most review endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

---

## Public Routes

### 1. Get Course Reviews

**Endpoint:** `GET /api/courses/:courseId/reviews`

**Description:** Lấy danh sách đánh giá của khóa học (công khai)

**Query Parameters:**
- `page` (optional): Số trang (default: 1)
- `limit` (optional): Số lượng mỗi trang (default: 10, max: 100)
- `rating` (optional): Lọc theo số sao (1-5)
- `sort` (optional): Sắp xếp (`newest`, `oldest`, `highest`, `lowest`)

**Example:** `GET /api/courses/1/reviews?page=1&limit=5&rating=5&sort=highest`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": 1,
        "userId": 2,
        "courseId": 1,
        "rating": 5,
        "comment": "Khóa học rất hay và chi tiết, giảng viên giải thích dễ hiểu.",
        "createdAt": "2025-03-04T10:00:00.000Z",
        "updatedAt": "2025-03-04T10:00:00.000Z",
        "user": {
          "id": 2,
          "name": "Nguyen Van A",
          "avatar": "https://example.com/avatar.jpg"
        }
      }
    ],
    "statistics": {
      "averageRating": "4.5",
      "totalReviews": 25,
      "distribution": {
        "5": 15,
        "4": 7,
        "3": 2,
        "2": 1,
        "1": 0
      }
    },
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
}
```

---

## Student Routes

### 1. Create Review

**Endpoint:** `POST /api/student/courses/:courseId/reviews`

**Description:** Tạo đánh giá mới cho khóa học

**Requirements:**
- User phải đã đăng ký khóa học
- Mỗi user chỉ được đánh giá 1 lần cho mỗi khóa học

**Request Body:**
```json
{
  "rating": 5,
  "comment": "Khóa học rất hay và chi tiết, giảng viên giải thích dễ hiểu."
}
```

**Validation:**
- `rating`: số nguyên từ 1-5
- `comment`: chuỗi từ 10-1000 ký tự (optional)

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Đánh giá đã được tạo thành công",
  "data": {
    "review": {
      "id": 1,
      "userId": 2,
      "courseId": 1,
      "rating": 5,
      "comment": "Khóa học rất hay và chi tiết, giảng viên giải thích dễ hiểu.",
      "createdAt": "2025-03-04T10:00:00.000Z",
      "updatedAt": "2025-03-04T10:00:00.000Z",
      "user": {
        "id": 2,
        "name": "Nguyen Van A",
        "avatar": null
      }
    }
  }
}
```

---

### 2. Update Review

**Endpoint:** `PUT /api/student/reviews/:reviewId`

**Description:** Cập nhật đánh giá của mình

**Request Body:**
```json
{
  "rating": 4,
  "comment": "Khóa học tốt nhưng có thể cải thiện thêm phần thực hành."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Cập nhật đánh giá thành công",
  "data": {
    "review": {
      "id": 1,
      "userId": 2,
      "courseId": 1,
      "rating": 4,
      "comment": "Khóa học tốt nhưng có thể cải thiện thêm phần thực hành.",
      "updatedAt": "2025-03-04T11:00:00.000Z",
      "user": {
        "id": 2,
        "name": "Nguyen Van A",
        "avatar": null
      }
    }
  }
}
```

---

### 3. Delete Review

**Endpoint:** `DELETE /api/student/reviews/:reviewId`

**Description:** Xóa đánh giá của mình

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Xóa đánh giá thành công"
}
```

---

### 4. Get My Reviews

**Endpoint:** `GET /api/student/reviews`

**Description:** Lấy danh sách đánh giá của user hiện tại

**Query Parameters:**
- `page` (optional): Số trang (default: 1)
- `limit` (optional): Số lượng mỗi trang (default: 10, max: 100)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": 1,
        "userId": 2,
        "courseId": 1,
        "rating": 5,
        "comment": "Khóa học rất hay và chi tiết.",
        "createdAt": "2025-03-04T10:00:00.000Z",
        "course": {
          "id": 1,
          "title": "JavaScript Advanced",
          "slug": "javascript-advanced",
          "price": "99.99"
        }
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

### 5. Get Review Details

**Endpoint:** `GET /api/student/reviews/:reviewId`

**Description:** Xem chi tiết đánh giá (chỉ user tạo hoặc admin)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "review": {
      "id": 1,
      "userId": 2,
      "courseId": 1,
      "rating": 5,
      "comment": "Khóa học rất hay và chi tiết, giảng viên giải thích dễ hiểu.",
      "createdAt": "2025-03-04T10:00:00.000Z",
      "updatedAt": "2025-03-04T10:00:00.000Z",
      "user": {
        "id": 2,
        "name": "Nguyen Van A",
        "email": "a@example.com",
        "avatar": null
      },
      "course": {
        "id": 1,
        "title": "JavaScript Advanced",
        "slug": "javascript-advanced",
        "description": "Khóa học nâng cao về JavaScript",
        "price": "99.99"
      }
    }
  }
}
```

---

## Admin Routes

### 1. Get All Reviews

**Endpoint:** `GET /api/admin/reviews`

**Description:** Lấy tất cả đánh giá (admin)

**Query Parameters:**
- `page` (optional): Số trang (default: 1)
- `limit` (optional): Số lượng mỗi trang (default: 10, max: 100)
- `courseId` (optional): Lọc theo khóa học
- `userId` (optional): Lọc theo user
- `rating` (optional): Lọc theo số sao (1-5)

**Example:** `GET /api/admin/reviews?courseId=1&rating=5&page=1`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": 1,
        "userId": 2,
        "courseId": 1,
        "rating": 5,
        "comment": "Khóa học rất hay và chi tiết.",
        "createdAt": "2025-03-04T10:00:00.000Z",
        "user": {
          "id": 2,
          "name": "Nguyen Van A",
          "email": "a@example.com"
        },
        "course": {
          "id": 1,
          "title": "JavaScript Advanced",
          "slug": "javascript-advanced"
        }
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
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
      "msg": "Đánh giá phải từ 1-5 sao",
      "param": "rating"
    }
  ]
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Bạn cần đăng ký khóa học này để đánh giá"
}
```

```json
{
  "success": false,
  "message": "Bạn không có quyền cập nhật đánh giá này"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Không tìm thấy đánh giá"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Bạn đã đánh giá khóa học này"
}
```

---

## Rating System

### Rating Scale
- **5 sao**: Rất hài lòng - Khóa học xuất sắc
- **4 sao**: Hài lòng - Khóa học tốt
- **3 sao**: Bình thường - Khóa học chấp nhận được
- **2 sao**: Không hài lòng - Khóa học cần cải thiện
- **1 sao**: Rất không hài lòng - Khóa học kém

### Rating Statistics
- **Average Rating**: Điểm trung bình (1 decimal place)
- **Total Reviews**: Tổng số đánh giá
- **Distribution**: Phân bố theo từng mức sao

---

## Business Rules

### Review Creation
- Chỉ user đã đăng ký khóa học mới được đánh giá
- Mỗi user chỉ được đánh giá 1 lần cho mỗi khóa học
- Đánh giá từ 1-5 sao
- Bình luận từ 10-1000 ký tự

### Review Modification
- User chỉ được sửa/xóa đánh giá của mình
- Admin có thể quản lý tất cả đánh giá
- Lịch sử thay đổi được ghi nhận

### Display Logic
- Đánh giá mới nhất hiển thị đầu tiên (default)
- Có thể sắp xếp theo nhiều tiêu chí
- Thống kê được tính toán real-time

---

## Integration Notes

### Course Page Integration
```javascript
// Fetch course reviews with statistics
GET /api/courses/1/reviews?limit=5&sort=newest

// Display rating stars and count
// Show review summary with distribution
// Load more reviews on demand
```

### User Profile Integration
```javascript
// Get user's review history
GET /api/student/reviews

// Display in user profile
// Link to reviewed courses
```

### Admin Panel Integration
```javascript
// Monitor all reviews
GET /api/admin/reviews

// Filter and moderate content
// Export review data for analysis
```

---

## Performance Considerations

- Database indexes on user_id, course_id, rating
- Pagination for large review sets
- Caching for rating statistics
- Lazy loading for review details
- Optimized queries for admin dashboard
