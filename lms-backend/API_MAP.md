# API Map (Canonical)

Base URL: `/api`

## Health
- `GET /health`

## Auth (`/auth`)
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/reset-password/:token`
- `GET /auth/verify-email/:token`
- `POST /auth/verify-email-code`
- `POST /auth/resend-verification-email`
- `GET /auth/me`
- `PUT /auth/me`
- `POST /auth/me/avatar`

## Public
### Courses
- `GET /courses`
- `GET /courses/:id`

### Categories
- `GET /categories`

### Reviews
- `GET /courses/:courseId/reviews`

## Student
### Enrollments
- `POST /student/courses/:courseId/enroll`
- `DELETE /student/courses/:courseId/enroll`
- `GET /student/enrollments`
- `GET /student/enrollments/course/:courseId`
- `PUT /student/progress/:courseId`

### Schedule
- `GET /student/schedule`
- `GET /student/schedule/next`

### Payments
- `POST /student/payments/process`
- `POST /student/payments/verify`
- `GET /student/payments`
- `GET /student/payments/:paymentId`

### Reviews
- `POST /student/courses/:courseId/reviews`
- `GET /student/reviews`
- `GET /student/reviews/:reviewId`
- `PUT /student/reviews/:reviewId`
- `DELETE /student/reviews/:reviewId`

### Notifications
- `GET /student/notifications`
- `GET /student/notifications/unread-count`
- `PUT /student/notifications/:notificationId/read`
- `PUT /student/notifications/read-all`
- `DELETE /student/notifications/:notificationId`

### Quiz attempts
- `POST /student/quizzes/:quizId/start`
- `POST /student/attempts/:attemptId/submit`
- `GET /student/quizzes/:quizId/attempts`
- `GET /student/attempts/:attemptId`

### Assignment (placeholder)
- `POST /student/submit-assignment`

## Teacher
### Courses
- `GET /teacher/courses`
- `POST /teacher/courses`
- `GET /teacher/courses/:id`
- `PUT /teacher/courses/:id`
- `PUT /teacher/courses/:id/publish`
- `DELETE /teacher/courses/:id`

### Course content
- `GET /teacher/courses/:courseId/chapters`
- `POST /teacher/courses/:courseId/chapters`
- `PUT /teacher/chapters/:id`
- `DELETE /teacher/chapters/:id`
- `POST /teacher/chapters/:chapterId/lectures`
- `PUT /teacher/lectures/:id`
- `DELETE /teacher/lectures/:id`

### Enrollments
- `GET /teacher/courses/:courseId/enrollments`

### Schedule events
- `GET /teacher/courses/:courseId/schedule-events`
- `POST /teacher/courses/:courseId/schedule-events`
- `PUT /teacher/schedule-events/:eventId`
- `DELETE /teacher/schedule-events/:eventId`

### Notifications
- `GET /teacher/notifications`
- `GET /teacher/notifications/unread-count`
- `PUT /teacher/notifications/:notificationId/read`
- `PUT /teacher/notifications/read-all`
- `DELETE /teacher/notifications/:notificationId`

### Quizzes
- `POST /teacher/media/quiz`
- `POST /teacher/courses/:courseId/quizzes`
- `GET /teacher/courses/:courseId/quizzes`
- `GET /teacher/quizzes/:quizId`
- `PUT /teacher/quizzes/:quizId`
- `DELETE /teacher/quizzes/:quizId`

### Questions
- `POST /teacher/quizzes/:quizId/questions`
- `PUT /teacher/questions/:questionId`
- `DELETE /teacher/questions/:questionId`

### Quiz attempts (teacher stats)
- `GET /teacher/quizzes/:quizId/attempts`

## Admin
### Dashboard
- `GET /admin/dashboard`

### Users
- `GET /admin/users`
- `POST /admin/users`
- `PUT /admin/users/:id`
- `DELETE /admin/users/:id`

### Categories
- `GET /admin/categories`
- `POST /admin/categories`
- `PUT /admin/categories/:id`
- `DELETE /admin/categories/:id`

### Payments
- `GET /admin/payments`

### Enrollments
- `POST /admin/enrollments`
- `DELETE /admin/enrollments`
- `GET /admin/courses/:courseId/enrollments-admin`
- `GET /admin/users/:userId/enrollments`

### Reviews
- `GET /admin/reviews`
- `DELETE /admin/reviews/:id`

### Notifications
- `POST /admin/notifications/send`
- `GET /admin/notifications`
