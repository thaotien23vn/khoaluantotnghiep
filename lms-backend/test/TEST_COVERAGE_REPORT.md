# 📊 Báo Cáo Coverage Test & Kế Hoạch Chuẩn Hóa

## 📈 Tổng Quan Hiện Tại
- **Test Suites**: 57 passed
- **Tests**: 188 passed, 1 skipped
- **Thời gian**: ~178s
- **Coverage toàn dự án**: Cần cải thiện

---

## 🔴 Phần Có Coverage Thấp Cần Bổ Sung Test

### 1. AI Services (Coverage: 2-13%)
| File | Coverage | Test File Đề Xuất |
|------|----------|-------------------|
| `aiContent.service.js` | 2.31% | `ai-content-generation.test.js` |
| `aiLearningPath.service.js` | 3.2% | `ai-learning-path.test.js` |
| `aiPersonalization.service.js` | 5.26% | `ai-personalization.test.js` |
| `aiRag.service.js` | 4.05% | `ai-rag.test.js` |
| `placement.service.js` | 8.57% | `placement-full.test.js` |

### 2. Payment Services (Coverage: 16-31%)
| File | Coverage | Test File Đề Xuất |
|------|----------|-------------------|
| `stripe.service.js` | 22.7% | `stripe-service.test.js` |
| `vnpay.service.js` | 31.32% | `vnpay-service.test.js` |
| `email.service.js` | 16.36% | `email-service.test.js` |

### 3. Background Workers (Coverage: 0-41%)
| File | Coverage | Priority |
|------|----------|----------|
| `courseGeneration.worker.js` | 0% | 🔴 High |
| `courseGeneration.queue.js` | 41.17% | 🟡 Medium |

### 4. Placement Analytics (Coverage: 10-14%)
| File | Coverage | Test File Đề Xuất |
|------|----------|-------------------|
| `placementAnalytics.service.js` | 10.2% | `placement-analytics.test.js` |
| `placementAiRecommendations.service.js` | 13.88% | `placement-ai-rec.test.js` |

### 5. Controllers Chưa Có Test Chuyên Biệt
| Controller | Đã Test? | Ghi Chú |
|------------|----------|---------|
| `attempt.controller.js` | ❌ No | Quiz attempt/submission |
| `chapter.controller.js` | ⚠️ Partial | Trong course test |
| `chat/courseChat.controller.js` | ❌ No | Real-time chat |
| `chat/lessonChat.controller.js` | ❌ No | Lesson chat |
| `placementAnalytics.controller.js` | ❌ No | Thống kê placement |
| `tracking.controller.js` | ⚠️ Partial | Có routes test |

---

## 🟢 Phần Đã Coverage Tốt
- **Routes**: cart, auth, certificate, quiz, forum, review, schedule
- **Services**: auth.service.js (57.74%), media.service.js (83.33%)
- **Controllers**: CRUD cơ bản đều có test

---

## 📋 Kế Hoạch Chuẩn Hóa Test

### Phase 1: Tạo Template Chuẩn (Immediate)
1. ✅ Template testAuth.js đã có sẵn
2. ✅ Pattern loginByRole đã được áp dụng
3. ⚠️ Cần tạo test fixtures/data builders

### Phase 2: Bổ Sung Test Còn Thiếu (1-2 tuần)
Priority | Module | Est. Tests | Effort
---------|--------|------------|-------
🔴 High | `attempt.controller.js` | 8-10 tests | 1 day
🔴 High | `email.service.js` | 5-8 tests | 0.5 day
🟡 Medium | `stripe.service.js` | 10-15 tests | 1 day
🟡 Medium | `placementAnalytics.controller.js` | 5-8 tests | 0.5 day
🟢 Low | AI services (mock) | 15-20 tests | 2 days
🟢 Low | `courseGeneration.worker.js` | 5 tests | 1 day

### Phase 3: Cải Thiện Coverage (Ongoing)
- Integration tests cho payment flows
- E2E tests cho critical paths
- Load tests cho AI services

---

## 📝 Checklist Test Template

Mỗi test file mới cần có:

```javascript
// 1. Imports chuẩn
const request = require('supertest');
const app = require('../app');
const { loginByRole } = require('./testAuth');
const db = require('../models');

// 2. Describe block rõ ràng
describe('[Module] Flow Tests', () => {
  // 3. Variables cho test data
  let userToken;
  let testData;

  // 4. beforeAll: Setup data
  beforeAll(async () => {
    userToken = await loginByRole('student');
    // Create test data
  });

  // 5. afterAll: Cleanup
  afterAll(async () => {
    // Destroy test data
  });

  // 6. Test cases
  test('[METHOD] [path] - [description]', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

---

## 🎯 Mục Tiêu Coverage Đề Xuất

| Loại | Mục Tiêu | Hiện Tại |
|------|----------|----------|
| Controllers | 80%+ | ~60% |
| Services (core) | 70%+ | ~40% |
| Services (AI) | 30%+ | ~5% |
| Routes | 90%+ | ~75% |
| Utils | 60%+ | ~25% |

---

## 🚀 Actions Tiếp Theo

1. **Viết test cho attempt.controller.js** (quiz submission flow)
2. **Viết test cho email.service.js** (mock email sending)
3. **Tạo integration test cho payment complete flow**
4. **Thêm test cho placement analytics**

Bạn muốn bắt đầu với phần nào?
