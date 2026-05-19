# Audit Report: LMS EnglishLearning

> Generated: 2026-05-16
> Status: **Pending Fix** — Save for later, prioritize business logic first.

---

## 1. Backend (`lms-backend`)

### 1.1 Bảo mật — Critical

- **[BE-SEC-001] Hardcoded JWT Fallback Secret**
  - `lms-backend/src/config/jwt.js:1` dùng fallback `your_super_secret_jwt_key_change_this_in_production`
  - **Risk:** Nếu `JWT_SECRET` không được set (hoặc trim rỗng), production chạy với secret công khai. Attacker có thể ký token giả.
  - **Fix:** Throw ngay lập tức trong mọi môi trường nếu `JWT_SECRET` thiếu. Không dùng fallback.

- **[BE-SEC-002] Rate Limiting Bị Tắt Ở Production**
  - `lms-backend/src/app.js:119-122` tắt `apiLimiter` khi `NODE_ENV === 'production'`
  - **Risk:** DDoS, brute force, scraping không bị giới hạn.
  - **Fix:** Dùng Redis store cho `express-rate-limit` (đã có `ioredis`/`bullmq`), bật lại cho production.

- **[BE-SEC-003] Socket.IO Không Validate User Tồn Tại**
  - `lms-backend/src/socket.js:35` chỉ `jwt.verify()` token, không query DB kiểm tra user tồn tại hay `isActive`.
  - **Risk:** User bị xóa/khóa vẫn có thể kết nối socket.
  - **Fix:** Sau verify, query `User.findByPk(decoded.id)` và kiểm tra `isActive` như `auth.js` middleware.

- **[BE-SEC-004] SSL `rejectUnauthorized: false`**
  - `lms-backend/src/models/index.js:30` và `:49`
  - **Risk:** Tấn công Man-in-the-Middle với database connection.
  - **Fix:** Trong production, dùng CA certificate hợp lệ (ví dụ: `ca: fs.readFileSync('/path/to/ca.pem')`) thay vì `rejectUnauthorized: false`.

### 1.2 Bảo mật — High

- **[BE-SEC-005] XSS Sanitization Quá Yếu**
  - `lms-backend/src/middlewares/validateInput.js:28` chỉ replace `[<>"\'\`]`.
  - Nhiều field rich-text như `content`, `description`, `comment` được skip hoàn toàn (dòng 13-19).
  - **Risk:** Stored XSS qua forum posts, course descriptions nếu FE render thô.
  - **Fix:** Dùng thư viện chuyên dụng (vd: `dompurify` server-side hoặc `sanitize-html`) cho rich-text fields. Hoặc ép FE chỉ dùng Markdown.

- **[BE-SEC-006] Không Timeout Khi Gọi Brevo API**
  - `lms-backend/src/services/email.service.js:35` `fetch()` không có `signal`/`AbortController`.
  - **Risk:** Request treo vô thời hạn, chiếm worker/thread.
  - **Fix:** Thêm `AbortSignal.timeout(10000)`.

- **[BE-SEC-007] Avatar URL Không Được Validate**
  - `lms-backend/src/modules/auth/auth.controller.js:242` cập nhật `user.avatar = avatar || null` trực tiếp mà không validate URL scheme.
  - **Risk:** `javascript:alert(1)` trong avatar URL -> XSS khi FE hiển thị `<img src={avatar}>`.
  - **Fix:** Validate URL bắt đầu bằng `https://` hoặc domain whitelist.

- **[BE-SEC-008] Trust Proxy Có Thể Bị Lợi Dụng**
  - `lms-backend/src/app.js:31` `app.set('trust proxy', ['127.0.0.1', '10.0.0.0/8', ...])`
  - **Risk:** Nếu reverse proxy bị misconfigure, attacker có thể spoof IP qua `X-Forwarded-For`, bypass rate limit.
  - **Fix:** Hạn chế về `loopback` hoặc địa chỉ cụ thể của load balancer.

### 1.3 Bảo mật — Medium

- **[BE-SEC-009] `sequelize.sync()` Trong Dev**
  - `lms-backend/src/models/index.js:348` `force: true` chỉ trong `test`, nhưng `sync()` trong `server.js:61` vẫn nguy hiểm nếu chạy nhầm env.
  - **Fix:** Thêm guard kiểm tra `DATABASE_URL` chứa `test` hoặc `sqlite`.

- **[BE-SEC-010] Thiếu Request Timeout Global**
  - Không có middleware timeout cho Express request.
  - **Fix:** Dùng `connect-timeout` hoặc `server.setTimeout(30000)`.

- **[BE-SEC-011] Không Có Audit Log Tự Động Cho Mọi Thay Đổi Nhạy Cảm**
  - Chỉ có `AdminActionLog` cho admin. Chưa có log cho: đổi mật khẩu, thanh toán, enroll/unenroll.
  - **Fix:** Thêm middleware logging cho các mutation quan trọng.

### 1.4 Kiến trúc & Hiệu năng

- **[BE-ARCH-001] Không Có Refresh Token**
  - JWT có `expiresIn: 7d`. Nếu token bị leak, attacker có 7 ngày. Không có cơ chế revoke/refresh.
  - **Fix:** Triển khai refresh token (HTTP-only cookie hoặc rotate token).

- **[BE-ARCH-002] Sử Dụng `memoryStorage` Cho Multer**
  - `lms-backend/src/middlewares/uploadMedia.js:3` file upload giữ trong RAM.
  - **Risk:** Upload đồng thời nhiều file lớn có thể OOM.
  - **Fix:** Dùng `diskStorage` hoặc stream trực tiếp lên Supabase/S3.

- **[BE-ARCH-003] Thiếu API Versioning**
  - Tất cả routes đều là `/api/*`. Khó migrate breaking changes.
  - **Fix:** Tiền tố `/api/v1/...`.

- **[BE-ARCH-004] Error Handler Có Thể Leak Stack Trace**
  - `lms-backend/src/app.js:246-248` log stack trace trong production khi `!isProd`, nhưng response vẫn trả `err.message`.
  - **Fix:** Trong production, response chỉ nên trả `"Lỗi máy chủ"` và `correlationId`.

---

## 2. Frontend (`FE-EnglishLearning`)

### 2.1 Bảo mật — High

- **[FE-SEC-001] Token Lưu Trong `localStorage`**
  - `FE-EnglishLearning/src/services/api.ts:42-48` lưu JWT trong `localStorage`.
  - **Risk:** Nếu xảy ra XSS (qua forum content, course description...), attacker có thể đọc token.
  - **Fix:** Chuyển sang HTTP-only cookie (do BE hỗ trợ) hoặc ít nhất là `sessionStorage`. Kết hợp với CSP strict.

- **[FE-SEC-002] Không Có Token Refresh Mechanism**
  - Token hết hạn sau 7 ngày nhưng FE không tự động refresh. User sẽ bị đăng xuất đột ngột.
  - **Fix:** Triển khai `/auth/refresh` endpoint và interceptor trong `api.ts`.

- **[FE-SEC-003] Hardcoded API Base URL**
  - `FE-EnglishLearning/src/services/api.ts:58` `DEFAULT_BASE_URL = "http://localhost:5000"`.
  - **Risk:** Dễ vô tình deploy production với localhost.
  - **Fix:** Production build nên fail nếu `VITE_API_BASE_URL` không được set.

- **[FE-SEC-004] Error Swallowing Trong Auth**
  - `FE-EnglishLearning/src/context/AuthContext.tsx:99-127` `register()` trả về `true/false`, không throw lỗi cụ thể (ví dụ: email đã tồn tại).
  - **Risk:** User không biết lý do đăng ký thất bại.
  - **Fix:** Throw `ApiError` và hiển thị `err.message` trong UI.

### 2.2 Bảo mật — Medium

- **[FE-SEC-005] Sử Dụng `as any` / `as unknown` Rộng Rãi**
  - `FE-EnglishLearning/src/services/api.ts:82-148` nhiều cast `as any` làm mất type safety.
  - **Risk:** Runtime errors do type mismatch.
  - **Fix:** Dùng generics đúng cách, tránh `as any`.

- **[FE-SEC-006] `react-quill-new` Nằm Trong `devDependencies`**
  - `FE-EnglishLearning/package.json:61` đặt trong `devDependencies`.
  - **Risk:** Build production có thể thiếu package.
  - **Fix:** Chuyển sang `dependencies`.

- **[FE-SEC-007] Không Validate `allowedRoles` Ở Route `/course/:id/lesson`**
  - `FE-EnglishLearning/src/App.tsx:156-162` `ProtectedRoute` không truyền `allowedRoles`.
  - **Risk:** Bất kỳ user đăng nhập nào (kể cả admin/teacher) cũng vào được lesson player.
  - **Fix:** Kiểm tra xem route này có cần giới hạn `STUDENT` không, hoặc thêm logic kiểm tra enrollment.

### 2.3 Kiến trúc & Hiệu năng

- **[FE-ARCH-001] Không Có Code Splitting**
  - `FE-EnglishLearning/src/App.tsx` import tất cả pages ở top level. Bundle có thể rất lớn.
  - **Fix:** Dùng `React.lazy()` + `Suspense` cho các trang admin/teacher ít dùng.

- **[FE-ARCH-002] Không Có Service Worker / PWA Fallback**
  - Không có offline capability hay cache strategy cho API.

- **[FE-ARCH-003] Context + Zustand Chồng Chéo**
  - Có `AuthContext` nhưng cũng có `useCourseStore`, `useEnrollmentStore`. Auth state nên centralize trong 1 nơi.

---

## 3. Database & Model

- **[DB-001] `sync()` Thay Vì Migration**
  - Dùng `sequelize.sync()` thay cho migration files. Khó rollback, khó quản lý schema thay đổi giữa các môi trường.
  - **Fix:** Dùng `sequelize-cli` tạo migration files.

- **[DB-002] Thiếu Index Trên Các Trường Query Thường Xuyên**
  - Chưa kiểm tra được toàn bộ model, nhưng các trường như `email`, `role`, `courseId`, `userId` nên có index rõ ràng để tránh full table scan.

---

## 4. Tổng Hợp Khuyến Nghị Ưu Tiên

| # | Vấn đề | File | Mức độ |
|---|--------|------|--------|
| 1 | Remove JWT fallback secret | `config/jwt.js` | Critical |
| 2 | Bật rate limit ở production | `app.js:119` | Critical |
| 3 | Validate user tồn tại trong socket auth | `socket.js:35` | Critical |
| 4 | Sửa `rejectUnauthorized: false` | `models/index.js` | Critical |
| 5 | Chuyển token sang HTTP-only cookie | FE + BE | High |
| 6 | Thêm refresh token flow | BE auth module | High |
| 7 | Validate/Sanitize rich-text fields | `validateInput.js` | High |
| 8 | Timeout cho external API calls | `email.service.js` | High |
| 9 | Fix error swallowing trong FE auth | `AuthContext.tsx` | High |
| 10 | Dùng `React.lazy()` code splitting | `App.tsx` | Medium |
