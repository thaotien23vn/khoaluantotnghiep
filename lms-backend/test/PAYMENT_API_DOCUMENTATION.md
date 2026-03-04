# LMS Payment System - API Documentation

## Base URL
```
http://localhost:5000
```

## Authentication
All payment endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

---

## Student Payment Operations

### 1. Process Payment

**Endpoint:** `POST /api/student/payments/process`

**Description:** Xử lý thanh toán cho khóa học

**Request Body:**
```json
{
  "courseId": 1,
  "paymentMethod": "stripe",
  "paymentDetails": {
    "cardToken": "tok_1234567890",
    "cardholderName": "Nguyen Van A"
  }
}
```

**Payment Methods:**
- `stripe` - Thanh toán qua Stripe
- `paypal` - Thanh toán qua PayPal  
- `bank_transfer` - Chuyển khoản ngân hàng
- `mock` - Thanh toán giả lập (cho testing)

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Yêu cầu thanh toán đã được tạo",
  "data": {
    "success": true,
    "paymentUrl": "https://checkout.stripe.com/pay?payment_id=123",
    "paymentId": "TXN_171234567890_ABCD",
    "message": "Vui lòng hoàn thành thanh toán qua Stripe"
  }
}
```

**Bank Transfer Response:**
```json
{
  "success": true,
  "message": "Yêu cầu thanh toán đã được tạo",
  "data": {
    "success": true,
    "bankInfo": {
      "bankName": "Vietcombank",
      "accountNumber": "1234567890",
      "accountName": "LMS SYSTEM",
      "amount": 99.99,
      "content": "Payment TXN_171234567890_ABCD"
    },
    "message": "Vui lòng chuyển khoản theo thông tin đã cung cấp"
  }
}
```

**Mock Payment Response:**
```json
{
  "success": true,
  "message": "Yêu cầu thanh toán đã được tạo",
  "data": {
    "success": true,
    "payment": {
      "id": 1,
      "userId": 2,
      "courseId": 1,
      "amount": 99.99,
      "status": "completed"
    },
    "enrollment": "created",
    "message": "Thanh toán giả lập thành công"
  }
}
```

---

### 2. Verify Payment

**Endpoint:** `POST /api/student/payments/verify`

**Description:** Xác thực thanh toán và hoàn tất đăng ký

**Request Body:**
```json
{
  "paymentId": 1,
  "verificationData": {
    "stripeChargeId": "ch_1234567890",
    "paymentIntentId": "pi_1234567890"
  }
}
```

**Response (200 OK) - Success:**
```json
{
  "success": true,
  "message": "Thanh toán thành công. Bạn đã được đăng ký khóa học.",
  "data": {
    "payment": {
      "id": 1,
      "userId": 2,
      "courseId": 1,
      "amount": 99.99,
      "currency": "USD",
      "provider": "stripe",
      "providerTxn": "TXN_171234567890_ABCD",
      "status": "completed",
      "paymentDetails": {
        "stripeChargeId": "ch_1234567890",
        "verifiedAt": "2025-03-04T10:30:00.000Z"
      },
      "createdAt": "2025-03-04T10:00:00.000Z",
      "updatedAt": "2025-03-04T10:30:00.000Z"
    },
    "enrollment": {
      "id": 1,
      "userId": 2,
      "courseId": 1,
      "status": "enrolled",
      "progressPercent": 0,
      "enrolledAt": "2025-03-04T10:30:00.000Z"
    }
  }
}
```

**Response (400 Bad Request) - Failed:**
```json
{
  "success": false,
  "message": "Thanh toán thất bại",
  "error": "Payment declined by bank"
}
```

---

### 3. Get Payment History

**Endpoint:** `GET /api/student/payments`

**Description:** Lấy lịch sử thanh toán

**Query Parameters:**
- `page` (optional): Số trang (default: 1)
- `limit` (optional): Số lượng mỗi trang (default: 10, max: 100)
- `status` (optional): Lọc theo trạng thái (`pending`, `completed`, `failed`, `cancelled`)

**Example:** `GET /api/student/payments?page=1&limit=5&status=completed`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": 1,
        "userId": 2,
        "courseId": 1,
        "amount": 99.99,
        "currency": "USD",
        "provider": "stripe",
        "providerTxn": "TXN_171234567890_ABCD",
        "status": "completed",
        "createdAt": "2025-03-04T10:00:00.000Z",
        "updatedAt": "2025-03-04T10:30:00.000Z",
        "course": {
          "id": 1,
          "title": "JavaScript Advanced",
          "price": "99.99"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

### 4. Get Payment Details

**Endpoint:** `GET /api/student/payments/:paymentId`

**Description:** Xem chi tiết thanh toán

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": 1,
      "userId": 2,
      "courseId": 1,
      "amount": 99.99,
      "currency": "USD",
      "provider": "stripe",
      "providerTxn": "TXN_171234567890_ABCD",
      "status": "completed",
      "paymentDetails": {
        "cardToken": "tok_1234567890",
        "stripeChargeId": "ch_1234567890",
        "verifiedAt": "2025-03-04T10:30:00.000Z"
      },
      "createdAt": "2025-03-04T10:00:00.000Z",
      "updatedAt": "2025-03-04T10:30:00.000Z",
      "course": {
        "id": 1,
        "title": "JavaScript Advanced",
        "price": "99.99",
        "description": "Khóa học nâng cao về JavaScript"
      },
      "user": {
        "id": 2,
        "name": "Nguyen Van A",
        "email": "a@example.com"
      }
    }
  }
}
```

---

## Payment Flow Examples

### 1. Stripe Payment Flow
```bash
# 1. Initiate payment
POST /api/student/payments/process
{
  "courseId": 1,
  "paymentMethod": "stripe",
  "paymentDetails": {
    "cardToken": "tok_1234567890"
  }
}

# 2. User completes payment on Stripe (redirect)
# 3. Verify payment
POST /api/student/payments/verify
{
  "paymentId": 1,
  "verificationData": {
    "stripeChargeId": "ch_1234567890"
  }
}
```

### 2. Bank Transfer Flow
```bash
# 1. Initiate payment
POST /api/student/payments/process
{
  "courseId": 1,
  "paymentMethod": "bank_transfer"
}

# 2. User transfers money to bank account
# 3. Admin verifies payment (manual process)
# 4. System creates enrollment automatically
```

### 3. Mock Payment Flow (Testing)
```bash
# 1. Initiate mock payment (instant completion)
POST /api/student/payments/process
{
  "courseId": 1,
  "paymentMethod": "mock"
}

# Payment is completed and enrollment created instantly
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
      "msg": "ID khóa học phải là số nguyên",
      "param": "courseId"
    }
  ]
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Bạn không có quyền xác thực giao dịch này"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Không tìm thấy giao dịch"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Bạn đã đăng ký khóa học này"
}
```

```json
{
  "success": false,
  "message": "Bạn có một giao dịch đang chờ xử lý",
  "data": {
    "payment": {
      "id": 1,
      "status": "pending"
    }
  }
}
```

---

## Payment Statuses

| Status | Description | Next Action |
|--------|-------------|-------------|
| `pending` | Đang chờ thanh toán | Complete payment or cancel |
| `completed` | Thanh toán thành công | Enrollment created |
| `failed` | Thanh toán thất bại | Retry with new payment |
| `cancelled` | Đã hủy | Create new payment if needed |

---

## Security Notes

- All payment operations require authentication
- Payment details are stored as encrypted JSON
- Transaction IDs are unique and non-sequential
- Bank transfers require manual admin verification
- Mock payments should only be used in development/testing

---

## Integration Notes

### Stripe Integration (Future)
- Install Stripe SDK: `npm install stripe`
- Configure Stripe keys in `.env`
- Replace mock functions with actual Stripe API calls
- Handle webhooks for payment status updates

### PayPal Integration (Future)
- Install PayPal SDK: `npm install @paypal/checkout-server-sdk`
- Configure PayPal credentials in `.env`
- Implement PayPal order creation and capture
- Handle PayPal webhooks

### Bank Transfer
- Provide clear bank transfer instructions
- Implement admin panel for manual verification
- Send email notifications for payment status changes
- Generate unique reference numbers for each transfer
