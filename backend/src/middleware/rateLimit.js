// In-house fixed-window rate limiter (no external deps).
// NOTE: single-process in-memory store — correct for one Render instance.
// Counters reset on restart; for multi-instance deployments use a shared
// store (Redis). Keys prefer the authenticated user id so users behind one
// campus NAT don't throttle each other; unauthenticated traffic keys by IP.
const buckets = new Map();
const MAX_KEYS = 20000;
const CLEANUP_MS = 5 * 60 * 1000;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
  // Prevent unbounded growth under key-spray attacks (Map keeps insertion order)
  if (buckets.size > MAX_KEYS) {
    let toDrop = buckets.size - MAX_KEYS;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (--toDrop <= 0) break;
    }
  }
}, CLEANUP_MS);
if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

export function rateLimit({ scope, windowMs = 15 * 60 * 1000, max = 100, message = "Too many requests, please try again later." }) {
  return (req, res, next) => {
    const id = req.clerkUserId ? `u:${req.clerkUserId}` : `ip:${req.ip}`;
    const key = `${scope}:${id}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return res.status(429).json({ success: false, message });
    }
    next();
  };
}

// Flood gate for all API traffic (generous — per IP, since it runs pre-auth)
export const apiLimiter = rateLimit({
  scope: "api",
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many requests from this network, please try again later.",
});

// Each hit can trigger a Gemini call — strictest, per user (mounted after requireAuth)
export const matchesLimiter = rateLimit({
  scope: "matches",
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Match lookup limit reached, please try again in a few minutes.",
});

// 5MB files straight to paid Cloudinary storage — per user (mounted after requireAuth)
export const uploadLimiter = rateLimit({
  scope: "upload",
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Upload limit reached, please try again later.",
});

// Admin panel polling (dashboard etc.) — per user (mounted after panel auth)
export const adminLimiter = rateLimit({
  scope: "admin",
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Too many admin requests, please slow down.",
});

// Daily upload quota per user — caps paid Cloudinary storage abuse.
// 40 × 5MB worst case ≈ 200MB/day/attacker; unreferenced temp files are
// reaped hourly by tempImageCleanup in production. In-memory: resets on restart.
const MAX_UPLOADS_PER_DAY = Number(process.env.MAX_UPLOADS_PER_DAY || 40);
const dailyUploads = new Map(); // userId -> { count, day }

function todayKey() {
  return new Date().toISOString().slice(0, 10); // UTC day
}

export function uploadDailyQuota(req, res, next) {
  // Must run after requireAuth so clerkUserId is set
  const userId = req.clerkUserId;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const today = todayKey();
  let entry = dailyUploads.get(userId);
  if (!entry || entry.day !== today) {
    entry = { count: 0, day: today };
    dailyUploads.set(userId, entry);
  }
  // Opportunistically drop yesterday's entries
  if (dailyUploads.size > MAX_KEYS) {
    for (const [key, value] of dailyUploads) {
      if (value.day !== today) dailyUploads.delete(key);
    }
  }
  entry.count += 1;
  res.setHeader("X-Upload-Quota-Limit", String(MAX_UPLOADS_PER_DAY));
  res.setHeader("X-Upload-Quota-Remaining", String(Math.max(0, MAX_UPLOADS_PER_DAY - entry.count)));
  if (entry.count > MAX_UPLOADS_PER_DAY) {
    return res.status(429).json({ success: false, message: "Daily upload limit reached, please try again tomorrow." });
  }
  next();
}
