import { AsyncLocalStorage } from "node:async_hooks";

// Levelled logger — the big-app standard vs raw console.*:
// - Levels (error/warn/info/debug) so Render stays quiet normally and verbose on demand
// - Namespaces ([matching], [socket], ...) so you can grep one subsystem
// - Request ids auto-attached via AsyncLocalStorage (no signature changes)
// - JSON lines in production (parseable by log drains), pretty lines in dev
//
// Verbosity: LOG_LEVEL=error|warn|info|debug (default: debug locally, info in production)
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function activeLevel() {
  const fallback = process.env.NODE_ENV === "production" ? "info" : "debug";
  const raw = String(process.env.LOG_LEVEL || fallback).toLowerCase();
  return LEVELS[raw] ?? LEVELS[fallback];
}

const isProd = () => process.env.NODE_ENV === "production";

const requestStore = new AsyncLocalStorage();

export function runWithRequestContext(data, fn) {
  return requestStore.run(data, fn);
}

export function serializeError(err) {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      message: err.message,
      stack: err.stack,
      code: err.code,
      status: err.status ?? err.statusCode,
    };
  }
  if (typeof err === "object") {
    try {
      return JSON.parse(JSON.stringify(err));
    } catch {
      return { value: String(err) };
    }
  }
  return { message: String(err) };
}

function normalizeFields(fields) {
  if (fields instanceof Error) return { err: serializeError(fields) };
  if (fields && typeof fields === "object") {
    const out = { ...fields };
    if (out.err instanceof Error) out.err = serializeError(out.err);
    if (out.error instanceof Error) out.error = serializeError(out.error);
    return out;
  }
  return fields === undefined ? undefined : { value: fields };
}

const LEVEL_LABEL = { error: "ERROR", warn: "WARN", info: "INFO", debug: "DEBUG" };

function emit(level, ns, msg, fields) {
  if (LEVELS[level] > activeLevel()) return;

  const ctx = requestStore.getStore() || {};
  const entry = {
    ts: new Date().toISOString(),
    level,
    ns,
    ...(ctx.reqId ? { reqId: ctx.reqId } : {}),
    msg: typeof msg === "string" ? msg : String(msg),
    ...normalizeFields(fields),
  };

  const line = isProd()
    ? JSON.stringify(entry)
    : `${entry.ts.slice(11, 19)} ${LEVEL_LABEL[level].padEnd(5)} [${ns}]${entry.reqId ? ` #${entry.reqId}` : ""} ${entry.msg}${
        entry.err ? ` :: ${entry.err.message || ""}` : ""
      }`;

  // Errors/warnings go to stderr so Render separates them from routine output
  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(line + "\n");
}

export function createLogger(ns) {
  return {
    error: (msg, fields) => emit("error", ns, msg, fields),
    warn: (msg, fields) => emit("warn", ns, msg, fields),
    info: (msg, fields) => emit("info", ns, msg, fields),
    debug: (msg, fields) => emit("debug", ns, msg, fields),
  };
}

export const logger = createLogger("app");
