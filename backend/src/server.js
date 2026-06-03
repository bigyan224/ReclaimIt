import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import { initDB } from "./config/db.js";
import app from "./app.js";
import { setupSocketHandlers } from "./config/socket.js";

import job from "./config/cron.js";
import tempImageCleanupJob from "./config/tempImageCleanup.js";

dotenv.config();

if (process.env.NODE_ENV === "production") {
  job.start();
  tempImageCleanupJob.start();
  console.log("✅ Temp image cleanup job started (runs every 30 minutes)");
}

const PORT = process.env.PORT || 5001;

// Create HTTP server and Socket.io instance
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
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
      console.log(`✅ Backend (HTTP + Express) is running at http://localhost:${PORT}`);
      console.log(`✅ Socket.io (WebSocket) is listening on the same port: ${PORT}`);
      console.log(`📡 Clients should connect to: http://YOUR_IP:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  });
