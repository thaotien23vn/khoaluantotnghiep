# Luồng Nghiệp Vụ: Hệ Thống Quản Lý Khóa Học Trực Tuyến

> Mô tả toàn bộ luồng nghiệp vụ sau khi loại bỏ giỏ hàng, chuyển sang mô hình Trung tâm Đào tạo Online có tính phí.

---

## 1. Tổng Quan Kiến Trúc Nghiệp Vụ

Hệ thống phục vụ **Trường học / Trung tâm / Tổ chức** muốn cung cấp khóa học trực tuyến. Sinh viên **đăng ký học** từng khóa riêng lẻ (không có giỏ hàng). Sau khi đăng ký, hệ thống kiểm tra:

- Khóa **miễn phí** → active ngay, vào học luôn.
- Khóa **tính phí** → tạo hóa đơn học phí → thanh toán → active.

Sinh viên có thể **học song song** nhiều khóa. Khóa học có thể có **điều kiện tiên quyết** (prerequisite), nhưng không ép buộc tuần tự toàn bộ hệ thống.

---

## 2. Phân Quyền Người Dùng

| Vai trò | Mô tả |
|---------|-------|
| **Admin** | Quản lý toàn hệ thống, duyệt khóa học, quản lý user, xem báo cáo |
| **CourseManager** | Quản lý danh mục khóa học, phê duyệt khóa học từ Teacher, quản lý nội dung |
| **Teacher** | Tạo, chỉnh sửa, upload bài giảng/video, tạo bài kiểm tra, xem tiến độ học viên |
| **Student** | Tìm kiếm khóa học, đăng ký học, học bài giảng, làm bài kiểm tra, xem chứng chỉ |

---

## 3. Luồng Teacher Tạo Khóa Học

```
Teacher đăng nhập
    ↓
Vào "Tạo khóa học mới"
    ↓
Nhập: tiêu đề, mô tả, ảnh, level, category
    ↓
Chọn: miễn phí / có phí (nhập giá)
    ↓
Chọn: prerequisite course (tùy chọn, vd: phải xong A1 mới học A2)
    ↓
Thêm bài giảng (video upload, PDF, text)
    ↓
Thêm bài kiểm tra (quiz) tùy chọn
    ↓
Gửi duyệt
    ↓
CourseManager / Admin duyệt
    ↓
Khóa học published → Student có thể thấy
```

**Lưu ý:**
- Khóa học ở trạng thái `draft` → chỉ Teacher xem được.
- Sau khi gửi duyệt → `pending_review`.
- CourseManager/Admin duyệt → `published`.
- Từ chối → `rejected` + lý do.

---

## 4. Luồng Student Đăng Ký Khóa Học (Không Giỏ Hàng)

```
Student xem danh sách khóa học / tìm kiếm / lọc theo level
    ↓
Click vào khóa học → Xem chi tiết (mô tả, bài giảng preview, giá)
    ↓
Nhấn nút "Đăng ký học"
    ↓
BE kiểm tra điều kiện:
├── Đã đăng ký khóa này chưa? → 409 "Bạn đã đăng ký"
├── Prerequisite đã hoàn thành chưa? → 403 "Cần hoàn thành khóa X trước"
├── Khóa đã published chưa? → 400 "Khóa học chưa mở"
└── Đủ điều kiện → Tiếp tục
    ↓
Phân nhánh:
├── Giá = 0 (miễn phí):
│   └── Tạo Enrollment (status: active, enrollmentType: free)
│   └── Trả về "Đăng ký thành công" → Chuyển vào học luôn
│
└── Giá > 0 (tính phí):
    └── Tạo Enrollment (status: pending_payment, enrollmentType: paid)
    └── Tạo Payment (status: pending, amount = course.price)
    └── Trả về "Chờ thanh toán" → Chuyển trang thanh toán (VNPay / Stripe / QR)
```

**State của Enrollment:**
```
pending_payment ──[thanh toán thành công]──► active ──[hết hạn]──► expired
     │                                              │
     │                                              └──[hủy]──► cancelled
     └──[hủy đăng ký / quá hạn thanh toán]──► cancelled

free course: bỏ qua pending_payment, tạo luôn active
```

---

## 5. Luồng Thanh Toán Học Phí

```
Student ở trang "Xác nhận đóng học phí"
    ↓
Hiển thị: tên khóa, giá, phương thức thanh toán (VNPay / Stripe)
    ↓
Student chọn phương thức → Nhấn "Thanh toán"
    ↓
BE tạo giao dịch VNPay / Stripe Session
    ↓
Chuyển sang cổng thanh toán (VNPay app / Stripe checkout)
    ↓
Student hoàn tất thanh toán
    ↓
Callback từ VNPay / Stripe về BE
    ↓
BE xác nhận giao dịch:
├── Thanh toán thành công:
│   ├── Payment.status = 'completed'
│   ├── Enrollment.status = 'active'
│   ├── Enrollment.paymentStatus = 'paid'
│   └── Trả về FE "Thanh toán thành công, khóa học đã kích hoạt"
│
└── Thanh toán thất bại / hủy:
    ├── Payment.status = 'failed' / 'cancelled'
    └── Enrollment vẫn giữ 'pending_payment' (cho phép thử lại)
```

**Quan trọng:**
- Không có giỏ hàng. Mỗi lần thanh toán cho **1 khóa duy nhất**.
- Payment là **hóa đơn học phí**, không phải đơn hàng thương mại.
- Enrollment được tạo **trước** thanh toán, chỉ active **sau** khi thanh toán thành công.

---

## 6. Luồng Học Khóa Học

```
Student vào "Khóa học của tôi"
    ↓
Danh sách các Enrollment có status = 'active'
    ↓
Chọn khóa học → Vào trang học
    ↓
Xem danh sách bài giảng (lectures)
    ↓
Click bài giảng → Xem video / đọc tài liệu
    ↓
BE ghi nhận tiến độ:
├── LectureProgress: đánh dấu bài đã xem
└── Enrollment.progressPercent: tính lại % hoàn thành
    ↓
Student có thể:
├── Để lại comment/thảo luận trong bài giảng
├── Làm bài kiểm tra (nếu có)
└── Quay lại học bài khác
```

**Tính tiến độ:**
- `progressPercent` = (số bài giảng đã xem / tổng số bài giảng) × 100
- Cập nhật real-time hoặc mỗi khi complete 1 lecture.

---

## 7. Luồng Làm Bài Kiểm Tra

```
Student vào bài kiểm tra trong khóa học
    ↓
BE kiểm tra: Enrollment.status = 'active'?
    ↓
Nếu đã làm trước:
├── Cho phép xem lại đáp án (read-only)
└── Hoặc cho phép làm lại (nếu Teacher cho phép retake)
    ↓
Student làm bài → Nộp
    ↓
BE chấm điểm tự động (quiz trắc nghiệm)
    ↓
Lưu Attempt: score, đáp án, thời gian làm
    ↓
Hiển thị kết quả: điểm, đúng/sai, giải thích
```

**Bài kiểm tra cuối khóa (Final Exam):**
- Có thể là điều kiện để nhận chứng chỉ.
- Pass threshold do Teacher đặt (vd: 70%).

---

## 8. Luồng Cấp Chứng Chỉ Hoàn Thành Khóa Học

```
Student hoàn thành 100% bài giảng
    ↓
Làm bài kiểm tra cuối khóa (nếu có)
    ↓
Đạt điểm pass → BE tự động tạo Certificate Hoàn Thành Khóa Học
    ↓
Lưu Certificate:
├── studentId, courseId, issueDate, certificateNumber (unique)
├── Mã QR để verify (tùy chọn)
└── ⚠️ Loại: COURSE COMPLETION CERTIFICATE (chứng chỉ hoàn thành nội bộ)
    ↓
Student nhận thông báo "Chúc mừng bạn đã hoàn thành khóa học!"
    ↓
Student xem / tải chứng chỉ PDF tại "Chứng chỉ của tôi"
```

**Điều kiện cấp chứng chỉ:**
- Hoàn thành 100% bài giảng
- + (Nếu có final exam) Đạt điểm pass
- Không phụ thuộc vào prerequisite khác hay lộ trình.

**⚠️ IMPORTANT - Certificate Type Clarification:**

Chứng chỉ do hệ thống cấp là **Course Completion Certificate** (chứng chỉ hoàn thành khóa học) - đây là **chứng chỉ nội bộ của nền tảng**, được cấp để xác nhận rằng học viên đã hoàn thành khóa học trên hệ thống.

**KHÔNG phải** Chứng Chỉ Năng Lực Ngoại Ngữ (Language Proficiency Certificate) được công nhận quốc tế như IELTS, TOEIC, hoặc official CEFR certificates.

**Chỉ dùng CEFR/Levels để:**
- Phân loại nội dung khóa học (A1, A2, B1, B2...)
- Đánh giá năng lực nội bộ của học viên trên nền tảng
- Gợi ý lộ trình học tập phù hợp

**Xác minh (Verify) Chứng Chỉ:**
- Xác minh via certificateNumber chỉ xác nhận: "Học viên X đã hoàn thành khóa học Y trên nền tảng"
- **KHÔNG xác nhận** năng lực ngoại ngữ thực tế của học viên

---

## 9. Luồng Đề Xuất Khóa Học

```
Student hoàn thành khóa học A
    ↓
BE phân tích:
├── Level của khóa A (vd: beginner)
├── Category của khóa A (vd: tiếng Anh giao tiếp)
└── Các khóa đã đăng ký của student
    ↓
Tìm khóa phù hợp:
├── Cùng category, level cao hơn 1 bậc (intermediate)
├── Chưa đăng ký
└── Đã published
    ↓
Gợi ý trên Dashboard / cuối trang khóa học A:
"Bạn đã xong khóa A. Khóa tiếp theo phù hợp: B"
    ↓
Student click "Đăng ký học" → Vào luồng Đăng ký Khóa học (item 4)
```

**Quyết định thiết kế (Option B):**
- Hệ thống chỉ **gợi ý** khóa học tiếp theo, **không ép buộc** Student phải đăng ký theo tuần tự.
- Student có thể tự do chọn đăng ký bất kỳ khóa nào (miễn là đủ điều kiện prerequisite nếu có).
- AI đề xuất dựa trên tiến độ, điểm số, thời gian học.
- Hiển thị "Lộ trình gợi ý" (Learning Path) nhưng **không bắt buộc**.

> Ví dụ: Học xong khóa A1 → UI gợi ý "Khóa A2 phù hợp tiếp theo". Student có thể:
> - Click "Đăng ký học" A2 ngay
> - Hoặc bỏ qua, tự tìm khóa khác (ví dụ: khóa nghe nói chuyên sâu cùng trình độ A1)
> - Hoặc đăng ký cả A2 và khóa luyện thi song song

---

## 10. Luồng Hủy / Hoàn Tiền

```
Student vào "Khóa học của tôi" → Chọn khóa → "Yêu cầu hoàn tiền"
    ↓
BE kiểm tra điều kiện hoàn tiền:
├── Đã thanh toán (Payment.status = 'completed')
├── Tiến độ < 30% (anti-abuse)
└── Trong thời hạn 7-14 ngày (tùy chính sách)
    ↓
Nếu đủ điều kiện:
├── Admin / CourseManager duyệt (hoặc tự động)
├── Payment.status = 'refunded'
├── Enrollment.status = 'cancelled'
├── Xóa LectureProgress của khóa đó
└── Student mất quyền học khóa đó
```

---

## 11. Data Model Relationships (Sau Refactor)

```
User (1)
 ├── (N) Enrollment
 │    ├── (1) Course
 │    └── (1) Payment (1-1, optional)
 ├── (N) Attempt (qua Quiz)
 └── (N) Certificate

Course (1)
 ├── (N) Lecture
 ├── (N) Quiz
 ├── (N) Enrollment
 └── (1) PrerequisiteCourse (self-referencing, optional)
      └── "Để học Course này, phải hoàn thành Course khác"

Payment (1) ── (1) Enrollment
      └── Lưu amount, provider, transactionId, status

Category (1) ── (N) Course
```

**Không còn:**
- ~~Cart~~
- ~~CartItem~~
- ~~Payment.courseId~~ (thay bằng Payment.enrollmentId)

---

## 12. State Transitions

### Enrollment
```
free course:
  [create] → active

paid course:
  [create] → pending_payment
  pending_payment + payment completed → active
  pending_payment + timeout / cancel → cancelled
  active + expired (quá hạn) → expired
  active + refund / admin cancel → cancelled
```

### Payment
```
[create] → pending
pending + callback success → completed
pending + callback fail → failed
pending + user cancel → cancelled
completed + refund request → refunded
```

---

## 13. Các API Chính (Sau Refactor)

### Enrollment API
```
POST   /api/enrollments              → Đăng ký khóa học
GET    /api/enrollments/my           → Danh sách khóa đang học
GET    /api/enrollments/:id          → Chi tiết 1 enrollment
DELETE /api/enrollments/:id          → Hủy đăng ký (nếu chưa active/paid)
```

### Payment API
```
POST   /api/payments/:enrollmentId   → Tạo thanh toán cho enrollment
GET    /api/payments/history         → Lịch sử thanh toán
POST   /api/payments/:id/refund      → Yêu cầu hoàn tiền
```

### Course API
```
GET    /api/courses                  → Danh sách + filter + search
GET    /api/courses/:id              → Chi tiết khóa học
GET    /api/courses/recommended      → Đề xuất cho student
POST   /api/courses                  → Teacher tạo (draft)
PUT    /api/courses/:id/publish      → Gửi duyệt / publish
```

---

## 14. UI Screens (FE) Sau Refactor

| Screen | Mô tả |
|--------|-------|
| **Course List** | Tìm kiếm, lọc, xem chi tiết khóa học |
| **Course Detail** | Mô tả, preview bài giảng, nút **"Đăng ký học"** (thay "Mua ngay") |
| **My Enrollments** | Danh sách khóa đang học, tiến độ từng khóa |
| **Learning Page** | Xem video, tài liệu, comment, làm quiz |
| **Payment Page** | Xác nhận đóng học phí, chọn VNPay/Stripe, QR |
| **Payment History** | Hóa đơn đã thanh toán |
| **Certificates** | Chứng chỉ đã đạt, tải PDF |
| **Dashboard** | Đề xuất khóa học, tiến độ tổng quan |

**Không còn:**
- ~~Giỏ hàng~~
- ~~Trang thanh toán giỏ hàng~~
- ~~Nút "Thêm vào giỏ"~~

---

## 15. Quyết Định Thiết Kế Tóm Tắt

| Vấn đề | Quyết định |
|--------|------------|
| Giỏ hàng? | **Không**. Đăng ký từng khóa riêng lẻ |
| Học song song? | **Có**. Cho phép nhiều enrollment active |
| Password khóa? | **Không**. Dùng JWT + enrollment check |
| Lộ trình? | **Gợi ý + Prerequisite tùy chọn**. Không ép tuần tự |
| Chứng chỉ? | **Khi hoàn thành khóa + pass test** |
| Thanh toán? | **Trực tiếp theo khóa**. Payment gắn với enrollment |
| Free course? | **Đăng ký ngay**, không cần thanh toán |

---

## Next Step

Sau khi duyệt xong luồng này, bắt đầu code refactor:
1. Xóa Cart (BE model, service, routes + FE store, page, service)
2. Sửa Enrollment model (thêm `enrollmentType`, `paymentStatus`)
3. Sửa Payment model (dùng `enrollmentId`, bỏ `courseId` trực tiếp)
4. Tạo Enrollment Service + Controller + Routes mới
5. Sửa Payment Service (không tự động `_enrollAfterPayment`)
6. Thêm `prerequisiteCourseId` vào Course model
7. Sửa FE: xóa Cart, thay wording "Mua" → "Đăng ký học"
