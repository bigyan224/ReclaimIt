import { randomUUID } from "node:crypto";
import { createLogger, runWithRequestContext } from "../config/logger.js";

const log = createLogger("http");

// One access line per request (method/path/status/ms) + short reqId attached to
// every log inside the request via AsyncLocalStorage. Health checks are skipped
// — the external pinger hits /api/health every 5 min and would drown the logs.
export function requestLogger(req, res, next) {
  if (req.path === "/api/health" || req.originalUrl === "/api/health") {
    return next();
  }

  req.id = randomUUID().slice(0, 8);
  const started = Date.now();

  runWithRequestContext({ reqId: req.id }, () => {
    log.debug(`-> ${req.method} ${req.originalUrl}`);

    res.on("finish", () => {
      const ms = Date.now() - started;
      const fields = { method: req.method, path: req.originalUrl, status: res.statusCode, ms };
      if (req.clerkUserId) fields.user = String(req.clerkUserId).slice(-8);
      if (res.statusCode >= 500) log.error(`<- ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`, fields);
      else if (res.statusCode >= 400) log.warn(`<- ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`, fields);
      else log.info(`<- ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`, fields);
    });

    next();
  });
}
