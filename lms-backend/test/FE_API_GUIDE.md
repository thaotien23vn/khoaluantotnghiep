# FE API Guide (LMS Backend)

Base URL:
- `http://localhost:5000`

All APIs are under prefix:
- `/api`

Auth:
- Protected endpoints require header: `Authorization: Bearer <JWT>`

---

## Auth

### POST `/api/auth/register`
- Create new account (default role: student).

### POST `/api/auth/login`
- Login, returns JWT token.

### GET `/api/auth/me`
- Get current user profile (requires JWT).

---

## Public Courses (Browse)

### GET `/api/courses`
- List published courses with search/filter/sort/pagination.

Common query params:
- `page`, `limit`
- `q` (search text)
- `categoryId`
- `minPrice`, `maxPrice`
- `sort` (e.g. newest / priceAsc / priceDesc / ratingDesc)

### GET `/api/courses/:slug`
- Get published course detail by slug.

---

## Categories

### GET `/api/categories`
- List categories for FE menus/filters.

---

## Reviews

### GET `/api/courses/:courseId/reviews`
- Public: list reviews of a course (pagination + rating filter).
- Response includes:
  - `review.user`: `{ id, name, avatar }`
  - `review.course`: `{ id, title, slug }`

Query params:
- `page`, `limit`
- `rating` (1..5)
- `sort` (`newest`, `oldest`, `highest`, `lowest`)

### POST `/api/student/courses/:courseId/reviews`
- Student: create review (requires enrollment).
- Response includes `user` + `course`.

Body:
- `rating` (1..5)
- `comment` (optional, 10..1000 chars)

### PUT `/api/student/reviews/:reviewId`
- Student: update own review.
- Response includes `user` + `course`.

### DELETE `/api/student/reviews/:reviewId`
- Student: delete own review.

### GET `/api/student/reviews`
- Student: list my reviews (pagination).
- Response includes:
  - `review.course`: `{ id, title, slug, price }`

### GET `/api/student/reviews/:reviewId`
- Student/Admin: review detail.
- Response includes `user` + `course`.

### GET `/api/admin/reviews`
- Admin: list all reviews (pagination + filters).
- Response includes:
  - `review.user`: `{ id, name, avatar, email }`
  - `review.course`: `{ id, title, slug }`

Query params:
- `page`, `limit`
- `courseId`, `userId`, `rating`

---

## Teacher Course Management

### GET `/api/teacher/courses`
- Teacher/Admin: list my courses (supports search/filter/sort/pagination).

### POST `/api/teacher/courses`
- Teacher/Admin: create course.
- Teacher-created course defaults to `published=false` (draft workflow).

### PUT `/api/teacher/courses/:id`
- Teacher/Admin: update course.

### PUT `/api/teacher/courses/:id/publish`
- Teacher/Admin: publish/unpublish course.

Body:
- `published`: boolean

---

## Admin

### GET `/api/admin/dashboard`
- Admin dashboard stats.

### GET `/api/admin/users`
- List users.

### POST `/api/admin/users`
- Create user (student/teacher).

### PUT `/api/admin/users/:id`
- Update user (role/active/reset password per implementation).

### DELETE `/api/admin/users/:id`
- Delete user (cannot delete admin).

---

## Notifications

### GET `/api/student/notifications`
- Student: list notifications.

### GET `/api/teacher/notifications`
- Teacher: list notifications.

### GET `/api/admin/notifications`
- Admin: list notifications.

---

## Health

### GET `/api/health`
- Health check.
