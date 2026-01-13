import express from "express";
import {
  getOrCreateChat,
  getMyChats,
  getChatMessages,
  sendMessage,
  deleteChat
} from "../controllers/chat.js";
import { requireAuth } from "../middleware/clerkAuth.js";

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET /api/chats - Get all chats for current user
router.get("/", getMyChats);

// GET /api/chats/match/:matchedItemId - Get or create chat for a matched item
router.get("/match/:matchedItemId", getOrCreateChat);

// GET /api/chats/:chatId/messages - Get messages for a chat
router.get("/:chatId/messages", getChatMessages);

// POST /api/chats/:chatId/messages - Send a message in a chat
router.post("/:chatId/messages", sendMessage);

// DELETE /api/chats/:chatId - Archive a chat
router.delete("/:chatId", deleteChat);

export default router;
