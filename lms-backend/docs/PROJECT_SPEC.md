# LMS Project Specification

## 1. Giới thiệu
Dự án xây dựng một hệ thống quản lý khóa học trực tuyến (LMS) đơn giản để phục vụ cho luận văn tốt nghiệp. Hệ thống có hai nhóm người dùng chính: Giảng viên (Teacher) và Học viên (Student), cùng vai trò quản trị (CourseManager/Admin).  
Mục tiêu là cung cấp nền tảng học tập trực tuyến, quản lý nội dung, theo dõi tiến độ và cho phép giảng viên đánh giá học viên.

## 2. Phạm vi
- **Môi trường**: Ứng dụng chạy backend Node.js/Express, front-end (tương lai) responsive trên mobile.
- **Chức năng chính**:
  - Quản lý khóa học và bài giảng (video, tài liệu).
  - Phân loại, tìm kiếm khóa học.
  - Thanh toán khóa học tính phí.
  - Đề xuất khóa học phù hợp.
  - Tương tác người dùng (thông báo, bình luận).
  - Học và làm bài kiểm tra.
  - Xem thống kê tiến độ và điểm số.

## 3. Đối tượng sử dụng
- Trường học, tổ chức, trung tâm đào tạo muốn cung cấp khóa học online.
- Cá nhân tìm học kiến thức mới, không có thời gian hoặc điều kiện học offline.

## 4. Yêu cầu chức năng chi tiết
1. **Đăng ký/Đăng nhập**: Học viên và giảng viên có thể tạo tài khoản, đăng nhập. Phân quyền rõ ràng.
2. **Quản lý khóa học** (giảng viên): tạo, chỉnh sửa, xóa khóa học; thêm chương, bài, tài liệu.
3. **Xem khóa học** (học viên): duyệt khóa, đăng ký, truy cập bài giảng.
4. **Nội dung đa phương tiện**: video (MP4/YouTube), PDF, tài liệu; upload và lưu trữ.
5. **Quiz & kiểm tra**: tạo câu hỏi, làm và chấm điểm.
6. **Thanh toán**: tích hợp cổng thanh toán giả lập hoặc thực (PayPal/Stripe) cho khóa mất phí.
7. **Tiến độ học**: lưu trữ phần trăm hoàn thành, điểm số.
8. **Gợi ý & tìm kiếm**: mecanismos gợi ý dựa trên tags, lịch sử; tìm kiếm theo từ khóa.
9. **Thông báo & bình luận**: hệ thống cảnh báo, chat/bình luận trong bài học.
10. **Thống kê**: giảng viên xem số lượng học viên, tỉ lệ hoàn thành, điểm trung bình.
11. **Quản trị**: admin quản lý người dùng, khóa học, phân quyền.

## 5. Kiến trúc kỹ thuật
- **Backend**: Node.js (Express), Sequelize ORM, MySQL.
- **Authentication**: JWT, bcrypt cho mật khẩu.
- **Middleware**: phân quyền, upload (multer), validate.
- **Storage**: file tạm trên đĩa, TTL.
- **API**: RESTful.
- **Tests**: Mocha/Chai hoặc Jest (sau này cho unit/integration).

## 6. Database Schema sơ bộ
Xem nhiệm vụ 2 (ERD). Các bảng chính: users, roles, courses, chapters, lectures, enrollments, payments, quizzes, questions, attempts, reviews, notifications.

## 7. Phân chia giai đoạn phát triển
1. Thiết lập môi trường + repository.
2. Thiết kế ERD và cấu trúc dữ liệu.
3. Xây dựng auth & RBAC.
4. API user và course CRUD.
5. Quản lý nội dung bài học.
6. Upload & lưu trữ media.
7. Enrollment & payments.
8. Quiz & progress tracking.
9. Tìm kiếm & gợi ý.
10. Thống kê, admin features.
11. Testing, bảo mật, triển khai.

## 8. Tiêu chí nghiệm thu
- Chạy được backend cơ bản với API health check.
- User có thể đăng ký, đăng nhập, phân quyền.
- Giảng viên tạo khóa, học viên đăng ký.
- Lưu trữ nội dung video/PDF.
- Hệ thống cho phép làm quiz và lưu điểm.
- Thống kê đơn giản.

## 9. Tài liệu đi kèm
- Sơ đồ Use Case, ERD, sequence diagrams.
- Hướng dẫn cài đặt và sử dụng.
- Báo cáo luận văn.

## 10. Hướng phát triển mở rộng
- Chatbot, livestream, chatbot, chứng chỉ PDF tự động, tích hợp SMS/email, di động native.

---
*Document prepared during Stage 1 of the LMS project.*
