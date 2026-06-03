import express from "express";
import {
  getOrCreateChat,
  getMyChats,
  getChatMessages,
  sendMessage,
  sendVoiceMessage,
  transcribeVoiceMessageEnglish,
  translateTextMessage,
  deleteChat
} from "../controllers/chat.js";
import { requireAuth } from "../middleware/clerkAuth.js";
import multer from "multer";

const router = express.Router();

const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB max voice note
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("audio/")) {
      return cb(new Error("Only audio files are allowed"));
    }
    cb(null, true);
  },
});

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

// POST /api/chats/:chatId/messages/voice - Send in-app recorded voice note
router.post("/:chatId/messages/voice", voiceUpload.single("audio"), sendVoiceMessage);

// POST /api/chats/:chatId/messages/:messageId/transcribe-en - Get English transcript for a voice message
router.post("/:chatId/messages/:messageId/transcribe-en", transcribeVoiceMessageEnglish);

// POST /api/chats/:chatId/messages/:messageId/translate - Translate a text message (en/hi)
router.post("/:chatId/messages/:messageId/translate", translateTextMessage);

// DELETE /api/chats/:chatId - Archive a chat
router.delete("/:chatId", deleteChat);

export default router;
