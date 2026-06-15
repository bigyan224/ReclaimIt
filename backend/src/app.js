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

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true
}));
app.use(express.json());

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

export default app;
