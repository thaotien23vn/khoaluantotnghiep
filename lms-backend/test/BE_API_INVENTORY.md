# LMS Backend - API Inventory

**Base URL:** `http://localhost:5000`

## Global

- **GET** `/api/health`  
  Health check

## 1) Auth

**Base prefix:** `/api/auth`

- **POST** `/api/auth/register`
- **GET** `/api/auth/verify-email/:token`
- **POST** `/api/auth/verify-email-code`
- **POST** `/api/auth/resend-verification-email`
- **POST** `/api/auth/login`
- **POST** `/api/auth/forgot-password`
- **POST** `/api/auth/reset-password`
- **GET** `/api/auth/reset-password/:token`  
  Check reset-password token

**Auth (requires token)**

- **GET** `/api/auth/me`
- **PUT** `/api/auth/me`
- **POST** `/api/auth/me/avatar`  
  `multipart/form-data` (`file`), image only

## 2) Courses (Public)

**Base prefix:** `/api/courses`

- **GET** `/api/courses`  
  Published courses list
- **GET** `/api/courses/:id`  
  Course detail

## 3) Categories (Public)

**Base prefix:** `/api/categories`

- **GET** `/api/categories`

## 4) Notifications

> Notification routes are mounted at `/api`.

### 4.1 Student/Admin notifications

- **GET** `/api/student/notifications`
- **GET** `/api/student/notifications/unread-count`
- **PUT** `/api/student/notifications/:notificationId/read`
- **PUT** `/api/student/notifications/read-all`
- **DELETE** `/api/student/notifications/:notificationId`

### 4.2 Teacher/Admin notifications

- **GET** `/api/teacher/notifications`
- **GET** `/api/teacher/notifications/unread-count`
- **PUT** `/api/teacher/notifications/:notificationId/read`
- **PUT** `/api/teacher/notifications/read-all`
- **DELETE** `/api/teacher/notifications/:notificationId`

### 4.3 Admin notifications

- **POST** `/api/admin/notifications/send`
- **GET** `/api/admin/notifications`

Note: The following short paths also exist because `notification.routes.js` is mounted at `/api`, but they are **not recommended** to use directly (can be confusing with admin/student role-based access):

- **GET** `/api/notifications`
- **GET** `/api/notifications/unread-count`
- **PUT** `/api/notifications/:notificationId/read`
- **PUT** `/api/notifications/read-all`
- **DELETE** `/api/notifications/:notificationId`
- **POST** `/api/notifications/send`

## 5) Reviews

> Review routes are mounted at `/api`.

### 5.1 Public reviews

- **GET** `/api/courses/:courseId/reviews`

### 5.2 Student/Admin reviews

- **POST** `/api/student/courses/:courseId/reviews`
- **PUT** `/api/student/reviews/:reviewId`
- **DELETE** `/api/student/reviews/:reviewId`
- **GET** `/api/student/reviews`
- **GET** `/api/student/reviews/:reviewId`

### 5.3 Admin reviews

- **GET** `/api/admin/reviews`  
  Alias: **GET** `/api/reviews`

Note: The following short paths also exist because `review.routes.js` is mounted at `/api`:

- **POST** `/api/courses/:courseId/reviews`
- **GET** `/api/reviews`
- **GET** `/api/reviews/:reviewId`
- **PUT** `/api/reviews/:reviewId`
- **DELETE** `/api/reviews/:reviewId`

## 6) Quiz

> Quiz routes are mounted at both `/api/teacher` and `/api/student`.

### 6.1 Teacher/Admin quiz management

- **POST** `/api/teacher/media/quiz`  
  `multipart/form-data` (`file`)
- **POST** `/api/teacher/courses/:courseId/quizzes`
- **GET** `/api/teacher/courses/:courseId/quizzes`
- **GET** `/api/teacher/quizzes/:quizId`
- **PUT** `/api/teacher/quizzes/:quizId`
- **DELETE** `/api/teacher/quizzes/:quizId`

### 6.2 Teacher/Admin question management

- **POST** `/api/teacher/quizzes/:quizId/questions`
- **PUT** `/api/teacher/questions/:questionId`
- **DELETE** `/api/teacher/questions/:questionId`

### 6.3 Teacher/Admin attempts

- **GET** `/api/teacher/quizzes/:quizId/attempts`

### 6.4 Student/Admin quiz taking

- **POST** `/api/student/quizzes/:quizId/start`
- **POST** `/api/student/attempts/:attemptId/submit`
- **GET** `/api/student/quizzes/:quizId/attempts`
- **GET** `/api/student/attempts/:attemptId`

## 7) Payments

**Base prefix:** `/api/student/payments`

- **POST** `/api/student/payments/process`
- **POST** `/api/student/payments/verify`
- **GET** `/api/student/payments`
- **GET** `/api/student/payments/:paymentId`

## 8) Enrollments / Progress (Protected)

> These live in `protected.routes.js` and are mounted at `/api/student`.

- **POST** `/api/student/courses/:courseId/enroll`
- **DELETE** `/api/student/courses/:courseId/enroll`
- **GET** `/api/student/enrollments/course/:courseId`
- **GET** `/api/student/enrollments`
- **PUT** `/api/student/progress/:courseId`

## 9) Schedule (Protected)

### 9.1 Student

- **GET** `/api/student/schedule`
- **GET** `/api/student/schedule/next`

### 9.2 Teacher/Admin (course schedule)

- **GET** `/api/teacher/courses/:courseId/schedule-events`
- **POST** `/api/teacher/courses/:courseId/schedule-events`
- **PUT** `/api/teacher/schedule-events/:eventId`
- **DELETE** `/api/teacher/schedule-events/:eventId`

## 10) Teacher - Course management (Protected)

- **GET** `/api/teacher/courses`
- **POST** `/api/teacher/courses`
- **GET** `/api/teacher/courses/:id`
- **PUT** `/api/teacher/courses/:id`
- **DELETE** `/api/teacher/courses/:id`

Course content

- **GET** `/api/teacher/courses/:courseId/chapters`
- **POST** `/api/teacher/courses/:courseId/chapters`
- **PUT** `/api/teacher/chapters/:id`
- **DELETE** `/api/teacher/chapters/:id`

Lectures

- **POST** `/api/teacher/chapters/:chapterId/lectures`  
  `multipart/form-data` (`file`)
- **PUT** `/api/teacher/lectures/:id`  
  `multipart/form-data` (`file`)
- **DELETE** `/api/teacher/lectures/:id`

Enrollments list for teacher/admin

- **GET** `/api/teacher/courses/:courseId/enrollments`

## 11) Admin (Protected)

- **GET** `/api/admin/dashboard`
- **GET** `/api/admin/users`
- **POST** `/api/admin/users`
- **PUT** `/api/admin/users/:id`
- **DELETE** `/api/admin/users/:id`

Payments / enrollments

- **GET** `/api/admin/payments`
- **POST** `/api/admin/enrollments`
- **DELETE** `/api/admin/enrollments`
- **GET** `/api/admin/courses/:courseId/enrollments-admin`
- **GET** `/api/admin/users/:userId/enrollments`

Reviews (adminController)

- **GET** `/api/admin/reviews`
- **DELETE** `/api/admin/reviews/:id`

Categories (admin)

- **GET** `/api/admin/categories`
- **POST** `/api/admin/categories`
- **PUT** `/api/admin/categories/:id`
- **DELETE** `/api/admin/categories/:id`

---

## Notes

- Routes mounted in `app.js`:
  - `/api/auth` -> `auth.routes.js`
  - `/api/courses` -> `course.routes.js`
  - `/api/categories` -> `category.routes.js`
  - `/api` -> `review.routes.js`, `notification.routes.js`
  - `/api/teacher` and `/api/student` -> `quiz.routes.js`
  - `/api/student/payments` -> `payment.routes.js`
  - `/api/admin`, `/api/teacher`, `/api/student` -> `protected.routes.js`
