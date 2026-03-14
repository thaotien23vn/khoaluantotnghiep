# Hướng dẫn tích hợp API Khóa học (Course) chi tiết cho Frontend

Tài liệu này cung cấp hướng dẫn đầy đủ nhất để tích hợp hệ thống Khóa học, nội dung bài học, đăng ký và đánh giá.

---

## 1. Thông tin chung & Xác thực

- **Base URL**: `/api`
- **Xác thực**: Gửi Token JWT qua header `Authorization: Bearer <token>`.
- **Media Upload**: Sử dụng `multipart/form-data` cho các API có tệp đính kèm (Ảnh bìa, Video, Tài liệu).

---

## 2. Luồng Học viên (Student Workflow)

### 2.1 Khám phá Khóa học (Public)

Dùng để hiển thị danh sách và tìm kiếm khóa học mà không cần đăng nhập.

- **Lấy danh sách khóa học**: `GET /api/courses`
  - **Query Params**:
    - `q`: Tìm kiếm theo từ khóa (tiêu đề).
    - `categoryId`: Lọc theo ID danh mục.
    - `level`: Lọc theo cấp độ (`beginner`, `intermediate`, `advanced`).
    - `minPrice`, `maxPrice`: Lọc theo khoảng giá.
    - `sort`: Tiêu chí sắp xếp (`newest`, `oldest`, `price_asc`, `price_desc`, `rating_desc`, `students_desc`).
    - `page`, `limit`: Phân trang (mặc định page=1, limit=20).
- **Chi tiết khóa học**: `GET /api/courses/:id`
  - Trả về toàn bộ thông tin khóa học, giảng viên, và **đề cương bài giảng (Curriculum)**.
  - **Lưu ý**: Các bài giảng có `isPreview: true` sẽ có sẵn `videoUrl` để học viên xem thử.
- **Lấy danh mục (Categories)**: `GET /api/categories` (Để hiển thị menu lọc khóa học).

### 2.2 Đăng ký & Học tập (Private)

Cần đăng nhập với quyền `student`.

- **Đăng ký khóa học**: `POST /api/student/courses/:courseId/enroll`
- **Hủy ghi danh**: `DELETE /api/student/courses/:courseId/enroll`
- **Cập nhật tiến độ học tập**: `PUT /api/student/progress/:courseId`
  - **Body**: `{ "progressPercent": 45 }` (Giá trị từ 0-100).
- **Xem chương trình học đã đăng ký**: `GET /api/student/enrollments`
  - Trả về danh sách các khóa học học viên đã tham gia kèm % tiến độ.
- **Chi tiết đăng ký của một khóa**: `GET /api/student/enrollments/course/:courseId`
- **Lịch học/Sự kiện**: `GET /api/student/schedule`

### 2.3 Đánh giá (Reviews)

- **Lấy danh sách đánh giá**: `GET /api/courses/:courseId/reviews` (Public).
- **Gửi đánh giá mới**: `POST /api/student/courses/:courseId/reviews`
  - **Body**: `{ "rating": 5, "comment": "Khóa học rất hay!" }` (Rating từ 1-5).
- **Sửa/Xóa đánh giá**: `PUT /api/student/reviews/:reviewId` hoặc `DELETE`.

---

## 3. Luồng Giảng viên (Teacher Management)

### 3.1 Quản lý Khóa học (CRUD)

- **Lấy danh sách khóa học của tôi**: `GET /api/teacher/courses`
- **Tạo khóa học mới**: `POST /api/teacher/courses`
  - **Dữ liệu**: `title`, `description`, `price`, `categoryId`, `level`, `willLearn` (mảng), `requirements` (mảng), `tags`.
- **Cập nhật thông tin**: `PUT /api/teacher/courses/:id`
- **Xuất bản/Draft**: `PUT /api/teacher/courses/:id/publish` (Body: `{ "published": true }`)

### 3.2 Quản lý Nội dung (Chapters & Lectures)

- **Xem toàn bộ đề cương quản trị**: `GET /api/teacher/courses/:courseId/chapters`
- **Quản lý Chương (Chapter)**: `POST /api/teacher/courses/:courseId/chapters`, `PUT`, `DELETE`.
- **Quản lý Bài giảng (Lecture)**:
  - **Tạo mới**: `POST /api/teacher/chapters/:chapterId/lectures` (Dùng `formData` cho file).
  - **Các trường**: `title`, `description`, `type` (video, document, quiz, text), `content`, `duration`, `isPreview`, `attachments` (Mảng file đính kèm).

### 3.3 Quản lý Học viên & Sự kiện

- **Danh sách học viên của khóa học**: `GET /api/teacher/courses/:courseId/enrollments`
- **Quản lý Lịch (Schedule)**: `POST /api/teacher/courses/:courseId/schedule-events`, `PUT`, `DELETE`.

---

## 4. Cấu trúc dữ liệu mẫu (Data Structure)

### Khóa học (Course Object)

```json
{
  "id": "10",
  "title": "Mastering React 18",
  "teacher": "Nguyễn Văn A",
  "teacherAvatar": "url_anh_dai_dien",
  "price": 0,
  "level": "intermediate",
  "students": 1500,
  "rating": 4.8,
  "reviewCount": 120,
  "duration": "15 giờ",
  "willLearn": ["Hooks", "Context API", "Redux"],
  "curriculum": [
    {
      "id": "1",
      "title": "Giới thiệu",
      "lessons": [
        {
          "id": "101",
          "title": "Cài đặt môi trường",
          "content": "Hướng dẫn chi tiết bằng văn bản/HTML...",
          "duration": "10 phút",
          "isPreview": true,
          "attachments": [
            {
              "id": "at1773151589631",
              "type": "image",
              "title": "Tài liệu IMAGE",
              "url": "https://res.cloudinary.com/..."
            },
            {
              "id": "at1773151615836",
              "type": "pdf",
              "title": "Tài liệu PDF",
              "url": "https://res.cloudinary.com/..."
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 5. Lưu ý kỹ thuật (Quan trọng)

### 5.1 Xử lý nội dung HTML (Rich Text)

Backend đã được cấu hình để cho phép lưu trữ đầy đủ các ký tự đặc biệt (`<`, `>`, `"`, `'`) cho các trường nội dung như `content` (bài giảng) và `description`.

- **Khi Chỉnh sửa (Edit Mode)**:
  - Frontend chỉ cần gán trực tiếp chuỗi mã HTML nhận từ API vào Editor (Quill, CKEditor, v.v.).
  - Ví dụ: Dữ liệu nhận về là `<p><strong>Chào bạn!</strong></p>`, khi đưa vào Editor nó sẽ hiển thị đúng định dạng.
- **Khi Hiển thị (View Mode)**:
  - Sử dụng `dangerouslySetInnerHTML` (React) hoặc tương đương.
  - **Lưu ý bảo mật**: Luôn sử dụng thư viện **DOMPurify** để làm sạch dữ liệu trước khi render để chống XSS.

### 5.2 Upload Media

- Sử dụng `multipart/form-data` với trường tên là `file` cho các tệp bài giảng.

---

## 6. Các mã lỗi cần chú ý (Error Handling)

- `403 Forbidden`: Không có quyền (ví dụ: học viên chưa đăng ký khóa học cố truy cập bài giảng).
- `409 Conflict`: Đã thực hiện hành động này trước đó (ví dụ: đã đăng ký).
- `401 Unauthorized`: Token không hợp lệ hoặc hết hạn.
- `400 Bad Request`: Thiếu dữ liệu hoặc sai định dạng.
