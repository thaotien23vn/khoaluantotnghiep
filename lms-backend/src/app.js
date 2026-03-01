const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/auth.routes');
const courseRoutes = require('./routes/course.routes');
const protectedRoutes = require('./routes/protected.routes');
const validateInput = require('./middlewares/validateInput');
const { apiLimiter } = require('./middlewares/rateLimiter');

const app = express();

// Security middleware
app.use(helmet()); // Add security headers
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Public course routes
app.use('/api/courses', courseRoutes);

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
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Lỗi máy chủ',
    error: err.message,
  });
});

module.exports = app;