import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import { initDB } from "./config/db.js";
import app from "./app.js";
import { setupSocketHandlers } from "./config/socket.js";

import job from "./config/cron.js";
import tempImageCleanupJob from "./config/tempImageCleanup.js";
import { createLogger } from "./config/logger.js";

const log = createLogger("server");

dotenv.config();

if (process.env.NODE_ENV === "production") {
  job.start();
  tempImageCleanupJob.start();
  log.info("Temp image cleanup job started (runs every 30 minutes)");
}

const PORT = process.env.PORT || 5001;

// Create HTTP server and Socket.io instance
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Allow controllers to broadcast socket events
app.set("io", io);

// Setup Socket.io handlers
setupSocketHandlers(io);

initDB()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      log.info(`Backend listening on :${PORT}`, {
        env: process.env.NODE_ENV || "development",
        logLevel: process.env.LOG_LEVEL || "(default)",
      });
    });
  })
  .catch((error) => {
    log.error("Failed to start server", error);
    process.exit(1);
  });
