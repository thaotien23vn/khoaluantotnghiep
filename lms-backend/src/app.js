const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const passport = require('passport');
const session = require('express-session');
require('./config/passport'); // Load passport configuration
const authRoutes = require("./routes/auth.routes");
const courseRoutes = require("./routes/course.routes");
const categoryRoutes = require("./routes/category.routes");
const quizRoutes = require("./routes/quiz.routes");
const paymentRoutes = require("./routes/payment.routes");
const reviewRoutes = require("./routes/review.routes");
const notificationRoutes = require("./routes/notification.routes");
const aiRoutes = require("./routes/ai.routes");
const teacherStatisticsRoutes = require("./routes/teacher_statistics.routes");
const protectedRoutes = require("./routes/protected.routes");
const validateInput = require("./middlewares/validateInput");
const { apiLimiter } = require("./middlewares/rateLimiter");
const { randomUUID } = require("crypto");

const app = express();

app.disable("x-powered-by");

// Security middleware
app.use(helmet()); // Add security headers
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:3000,http://localhost:5173,https://elearning-eduvn.vercel.app/"
)
  .split(",")
  .map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (Postman, curl) with no Origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// Body parsing middleware
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "1mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.URLENCODED_BODY_LIMIT || "1mb",
  }),
);

// Request correlation ID
app.use((req, res, next) => {
  const headerId =
    req.headers["x-correlation-id"] || req.headers["x-request-id"];
  const correlationId =
    typeof headerId === "string" && headerId.trim()
      ? headerId.trim()
      : randomUUID();
  req.correlationId = correlationId;
  res.setHeader("x-correlation-id", correlationId);
  next();
});

// Minimal structured request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const isProd =
      String(process.env.NODE_ENV || "").toLowerCase() === "production";
    const level =
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    const log = {
      level,
      msg: "http_request",
      correlationId: req.correlationId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip: req.ip,
      userId: req.user?.id,
      role: req.user?.role,
    };
    if (!isProd || level !== "info") {
      console.log(JSON.stringify(log));
    }
  });
  next();
});

// Input validation and sanitization
app.use(validateInput);

// Session middleware (required for Passport)
app.use(session({
  secret: process.env.JWT_SECRET || 'default-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// General API rate limiting
app.use("/api/", apiLimiter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "LMS Backend running",
  });
});

// Auth routes
app.use("/api/auth", authRoutes);

// Public course & category routes
app.use("/api/courses", courseRoutes);
app.use("/api/categories", categoryRoutes);

// Review routes (mixed public and protected)
app.use("/api", reviewRoutes);

// Notification routes (mixed public and protected)
app.use("/api", notificationRoutes);

// Quiz routes (mixed public and protected)
app.use("/api", quizRoutes);

app.use("/api/teacher", teacherStatisticsRoutes);
app.use("/api", aiRoutes);

// Payment routes
app.use("/api/student/payments", paymentRoutes);

// Protected routes (require authentication and authorization)
app.use("/api/admin", protectedRoutes);
app.use("/api/teacher", protectedRoutes);
app.use("/api/student", protectedRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint không tồn tại",
  });
});

// Error handler
app.use((err, req, res, next) => {
  const isProd =
    String(process.env.NODE_ENV || "").toLowerCase() === "production";

  // Normalize CORS rejection
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Not allowed by CORS",
    });
  }

  const statusCode =
    err && Number.isInteger(err.statusCode) ? err.statusCode : 500;

  const log = {
    level: "error",
    msg: "unhandled_error",
    correlationId: req.correlationId,
    method: req.method,
    path: req.originalUrl,
    status: statusCode,
    error: {
      name: err?.name,
      message: err?.message,
    },
  };
  if (!isProd && err?.stack) {
    log.error.stack = err.stack;
  }
  console.error(JSON.stringify(log));

  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? "Lỗi máy chủ" : err.message || "Lỗi",
    correlationId: req.correlationId,
    ...(isProd ? {} : { error: err.message }),
  });
});

module.exports = app;
