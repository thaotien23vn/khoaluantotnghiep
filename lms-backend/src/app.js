const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const authRoutes = require("./routes/auth.routes");
const courseRoutes = require("./routes/course.routes");
const categoryRoutes = require("./routes/category.routes");
const quizRoutes = require("./routes/quiz.routes");
const paymentRoutes = require("./routes/payment.routes");
const cartRoutes = require("./routes/cart.routes");
const reviewRoutes = require("./routes/review.routes");
const notificationRoutes = require("./routes/notification.routes");
const forumRoutes = require("./routes/forum.routes");
const aiRoutes = require("./routes/ai.routes");
const teacherStatisticsRoutes = require("./routes/teacher_statistics.routes");
const placementRoutes = require("./routes/placement.routes");
const chatRoutes = require("./routes/chat.routes");
const protectedRoutes = require("./routes/protected.routes");
const trackingRoutes = require("./routes/tracking.routes");
const progressRoutes = require("./routes/progress.routes");
const scheduleRoutes = require("./routes/schedule.routes");
const certificateRoutes = require("./routes/certificate.routes");
const validateInput = require("./middlewares/validateInput");
const { apiLimiter } = require("./middlewares/rateLimiter");
const { randomUUID } = require("crypto");

const app = express();

app.disable("x-powered-by");

// Trust proxy for Render (only specific IPs)
app.set('trust proxy', ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']);

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


// General API rate limiting (disabled for production due to proxy issues)
if (process.env.NODE_ENV !== 'production') {
  app.use("/api/", apiLimiter);
}

// Health check
app.get("/api/health", async (req, res) => {
  const health = {
    status: "OK",
    message: "LMS Backend running",
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Check Redis
  try {
    const { redisConnection } = require('./modules/notification/notification.queue');
    if (redisConnection) {
      await redisConnection.ping();
      health.services.redis = { status: 'operational' };
    } else {
      health.services.redis = { status: 'disabled', message: 'Not configured' };
    }
  } catch (err) {
    health.services.redis = { status: 'degraded', error: err.message };
  }

  // Check Database
  try {
    const db = require('./models');
    await db.sequelize.authenticate();
    health.services.database = { status: 'operational' };
  } catch (err) {
    health.services.database = { status: 'degraded', error: err.message };
  }

  res.json(health);
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

// Forum routes
app.use("/api/forum", forumRoutes);

// Quiz routes (mixed public and protected)
app.use("/api", quizRoutes);

app.use("/api/teacher", teacherStatisticsRoutes);
app.use("/api", aiRoutes);

// Placement test routes
app.use("/api", placementRoutes);

// Schedule routes
app.use("/api", scheduleRoutes);

// Chat routes
app.use("/api", chatRoutes);

// Payment routes
app.use("/api/student/payments", paymentRoutes);

// Cart routes
app.use("/api/cart", cartRoutes);

// Tracking routes (mixed public and protected)
app.use("/api/tracking", trackingRoutes);
console.log('[Routes] Mounted /api/tracking routes');

// Protected routes (require authentication and authorization)
app.use("/api/certificate", certificateRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/admin", protectedRoutes);
app.use("/api/teacher", protectedRoutes);
app.use("/api/student", protectedRoutes);

console.log('[Routes] Mounted /api/progress routes');

// Debug: list all registered routes
console.log('[Routes] Protected routes mounted at /api/student');

// Test route for progress tracking
app.put('/api/test/lectures/:lectureId/progress', (req, res) => {
  console.log('[Test] PUT /api/test/lectures/:lectureId/progress hit');
  res.json({ success: true, message: 'Test PUT route works' });
});
app.post('/api/test/lectures/:lectureId/progress', (req, res) => {
  console.log('[Test] POST /api/test/lectures/:lectureId/progress hit');
  res.json({ success: true, message: 'Test POST route works' });
});

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
    err && Number.isInteger(err.statusCode) ? err.statusCode :
    err && Number.isInteger(err.status) ? err.status : 500;

  const isClientError = statusCode >= 400 && statusCode < 500;
  const logLevel = isClientError ? "warn" : "error";
  const logMsg = isClientError ? "client_error" : "unhandled_error";

  const log = {
    level: logLevel,
    msg: logMsg,
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
