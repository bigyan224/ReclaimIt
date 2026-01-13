import express from "express";
import { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification 
} from "../controllers/notifications.js";
import { requireAuth } from "../middleware/clerkAuth.js";

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Get all notifications for current user
router.get("/", getNotifications);

// Mark notification as read
router.patch("/:notificationId/read", markAsRead);

// Mark all notifications as read
router.patch("/read-all", markAllAsRead);

// Delete notification
router.delete("/:notificationId", deleteNotification);

export default router;
