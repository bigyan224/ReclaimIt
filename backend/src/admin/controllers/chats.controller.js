import Chat from "../../models/chat.model.js";
import Message from "../../models/message.model.js";
import { buildPagination, parsePagination } from "../utils/pagination.js";
import { userInstitutionFilter } from "../utils/institutionFilter.js";
import User from "../../models/user.model.js";

export const listChatDisputes = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = String(req.query.status || "").toLowerCase();
    const filter = status ? { status } : { status: { $in: ["active", "blocked", "archived"] } };

    if (!req.isMasterAdmin && req.isInstitutionAdmin) {
      const users = await User.find(userInstitutionFilter(req)).select("_id").lean();
      const userIds = users.map((u) => u._id);
      filter.participants = { $in: userIds };
    }

    const [chats, total] = await Promise.all([
      Chat.find(filter)
        .populate("participants", "name email clerkId role status")
        .populate("items")
        .populate("matchedItem")
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit),
      Chat.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, disputes: chats, pagination: buildPagination({ page, limit, total }) });
  } catch (error) {
    console.error("Admin list chat disputes error:", error);
    res.status(500).json({ success: false, message: "Failed to load chat disputes" });
  }
};

export const getChatTranscript = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate("participants", "name email clerkId role status")
      .populate("items")
      .populate("matchedItem");

    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    // SECURITY: institution admins may only read chats involving their institutions' users
    if (!req.isMasterAdmin) {
      if (!req.isInstitutionAdmin) {
        return res.status(403).json({ success: false, message: "Admin access required" });
      }
      const users = await User.find(userInstitutionFilter(req)).select("_id").lean();
      const allowedIds = new Set(users.map((u) => String(u._id)));
      const involved = (chat.participants || []).some((p) => allowedIds.has(String(p._id || p)));
      if (!involved) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    const messages = await Message.find({ chat: chat._id }).populate("sender", "name email clerkId").sort({ createdAt: 1 });

    res.status(200).json({ success: true, chat, messages });
  } catch (error) {
    console.error("Admin chat transcript error:", error);
    res.status(500).json({ success: false, message: "Failed to load chat transcript" });
  }
};
