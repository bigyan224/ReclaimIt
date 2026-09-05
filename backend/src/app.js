import express from "express";
import cors from "cors";
import usersRoute from "./routes/users.js";
import itemsRoute from "./routes/items.js";
import uploadRoute from "./routes/upload.js";
import matchingRoute from "./routes/matching.js";
import notificationsRoute from "./routes/notifications.js";
import chatRoute from "./routes/chat.js";
import institutionsRoute from "./routes/institutions.js";
import adminRoute from "./admin/routes.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { createLogger } from "./config/logger.js";

const log = createLogger("app");

const app = express();

// Render terminates TLS at its load balancer — trust it so req.ip is the real client IP
app.set("trust proxy", 1);

// SECURITY headers (no extra deps — plain middleware)
app.use((req, res, next) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // API serves JSON only — lock down content policy
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// CORS allowlist: comma-separated origins, e.g. CORS_ORIGINS=https://admin.example.com
// Non-browser clients (mobile app, curl, server-to-server) send no Origin and always pass.
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json());
app.use(requestLogger);
app.use("/api/", apiLimiter);

app.use("/api/users", usersRoute);
app.use("/api/items", itemsRoute);
app.use("/api/upload", uploadRoute);
app.use("/api/matches", matchingRoute);
app.use("/api/notifications", notificationsRoute);
app.use("/api/chats", chatRoute);
app.use("/api/institutions", institutionsRoute);
app.use("/api/admin", adminRoute);

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Unknown routes — JSON, not Express default HTML
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
});

// Global error handler — never leak stacks to clients
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  log.error("Unhandled error", { method: req.method, path: req.originalUrl, err });

  if (err?.name === "MulterError" || err?.message === "Invalid file type. Only JPEG, JPG, PNG, and WEBP are allowed.") {
    const msg = err.code === "LIMIT_FILE_SIZE"
      ? "File too large. Maximum size is 5MB."
      : err.message || "File upload failed.";
    return res.status(400).json({ success: false, message: msg });
  }

  if (err?.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid id format." });
  }

  if (err?.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Request body too large." });
  }

  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ success: false, message: "Origin not allowed." });
  }

  const status = Number(err?.status || err?.statusCode) || 500;
  res.status(status >= 400 && status < 600 ? status : 500).json({
    success: false,
    message: status === 500 || !Number.isFinite(status) ? "Internal server error" : (err.message || "Request failed"),
  });
});

export default app;
