# ERD & Schema Overview

Sơ đồ thực thể - quan hệ (ERD) cho cơ sở dữ liệu LMS.

```mermaid
erDiagram
    USERS {
        INTEGER id PK
        STRING name
        STRING email
        STRING password_hash
        STRING role
        DATETIME createdAt
        DATETIME updatedAt
    }
    COURSES {
        INTEGER id PK
        STRING title
        STRING slug
        TEXT description
        DECIMAL price
        BOOLEAN published
        INTEGER categoryId FK
        INTEGER createdBy FK "users.id"
        DATETIME createdAt
        DATETIME updatedAt
    }
    CATEGORIES {
        INTEGER id PK
        STRING name
        INTEGER parentId FK "categories.id"
    }
    CHAPTERS {
        INTEGER id PK
        INTEGER courseId FK "courses.id"
        STRING title
        INTEGER "order"
    }
    LECTURES {
        INTEGER id PK
        INTEGER chapterId FK "chapters.id"
        STRING title
        STRING type
        STRING contentUrl
        INTEGER duration
        INTEGER "order"
    }
    ENROLLMENTS {
        INTEGER id PK
        INTEGER userId FK "users.id"
        INTEGER courseId FK "courses.id"
        STRING status
        DECIMAL progress_percent
        DATETIME enrolledAt
    }
    PAYMENTS {
        INTEGER id PK
        INTEGER userId FK "users.id"
        INTEGER courseId FK "courses.id"
        DECIMAL amount
        STRING currency
        STRING provider
        STRING providerTxn
        STRING status
        DATETIME createdAt
    }
    QUIZZES {
        INTEGER id PK
        INTEGER courseId FK "courses.id"
        STRING title
        INTEGER maxScore
        INTEGER timeLimit
    }
    QUESTIONS {
        INTEGER id PK
        INTEGER quizId FK "quizzes.id"
        STRING type
        TEXT content
        JSON options
        JSON correctAnswer
        INTEGER points
    }
    ATTEMPTS {
        INTEGER id PK
        INTEGER userId FK "users.id"
        INTEGER quizId FK "quizzes.id"
        JSON answers
        DECIMAL score
        DATETIME completedAt
    }
    REVIEWS {
        INTEGER id PK
        INTEGER userId FK "users.id"
        INTEGER courseId FK "courses.id"
        INTEGER rating
        TEXT comment
        DATETIME createdAt
    }
    NOTIFICATIONS {
        INTEGER id PK
        INTEGER userId FK "users.id"
        STRING type
        JSON payload
        BOOLEAN read
        DATETIME createdAt
    }

    USERS ||--o{ COURSES : "creates"
    USERS ||--o{ ENROLLMENTS : "enrolls"
    COURSES ||--o{ CHAPTERS : "has"
    CHAPTERS ||--o{ LECTURES : "contains"
    COURSES ||--o{ QUIZZES : "includes"
    QUIZZES ||--o{ QUESTIONS : "contains"
    USERS ||--o{ ATTEMPTS : "takes"
    COURSES ||--o{ ENROLLMENTS : "receives"
    ENROLLMENTS }o--|| PAYMENTS : "paid by"
    USERS ||--o{ REVIEWS : "writes"
    COURSES ||--o{ REVIEWS : "receives"
    USERS ||--o{ NOTIFICATIONS : "receives"
    COURSES }o--|| CATEGORIES : "categorized in"
``` 

## Mô tả sơ bộ
- **users** lưu tài khoản và vai trò ('student', 'teacher', 'admin').
- **courses** thông tin khoá học, liên kết creator (teacher) và category.
- **categories** cho phép phân loại nhiều cấp.
- **chapters/lectures** phân cấp nội dung khoá học.
- **enrollments** theo dõi học viên đăng ký và tiến độ.
- **payments** ghi nhận giao dịch cho khoá học trả phí.
- **quizzes/questions/attempts** quản lý bài kiểm tra.
- **reviews** học viên đánh giá khoá học.
- **notifications** lưu các thông báo gửi đến người dùng.

Sơ đồ trên giúp nhìn tổng quan quan hệ và là cơ sở cho các migration và model Sequelize.
