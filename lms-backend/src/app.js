const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/auth.routes');
const courseRoutes = require('./routes/course.routes');
const categoryRoutes = require('./routes/category.routes');
const quizRoutes = require('./routes/quiz.routes');
const paymentRoutes = require('./routes/payment.routes');
const reviewRoutes = require('./routes/review.routes');
const notificationRoutes = require('./routes/notification.routes');
const protectedRoutes = require('./routes/protected.routes');
const validateInput = require('./middlewares/validateInput');
const { apiLimiter } = require('./middlewares/rateLimiter');

const app = express();

app.disable('x-powered-by');

// Security middleware
app.use(helmet()); // Add security headers
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map((o) => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients (Postman, curl) with no Origin header
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '1mb' }));

// Input validation and sanitization
app.use(validateInput);

// General API rate limiting
app.use('/api/', apiLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'LMS Backend running',
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Public course & category routes
app.use('/api/courses', courseRoutes);
app.use('/api/categories', categoryRoutes);

// Review routes (mixed public and protected)
app.use('/api', reviewRoutes);

// Notification routes (mixed public and protected)
app.use('/api', notificationRoutes);

// Quiz routes (mixed public and protected)
app.use('/api/teacher', quizRoutes);
app.use('/api/student', quizRoutes);

// Payment routes
app.use('/api/student/payments', paymentRoutes);

// Protected routes (require authentication and authorization)
app.use('/api/admin', protectedRoutes);
app.use('/api/teacher', protectedRoutes);
app.use('/api/student', protectedRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint không tồn tại',
  });
});

// Error handler
app.use((err, req, res, next) => {
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  // Normalize CORS rejection
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'Not allowed by CORS',
    });
  }

  console.error(err.stack);
  return res.status(500).json({
    success: false,
    message: 'Lỗi máy chủ',
    ...(isProd ? {} : { error: err.message }),
  });
});

module.exports = app;