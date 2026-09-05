import Chat from "../models/chat.model.js";
import Message from "../models/message.model.js";
import MatchedItem from "../models/matchedItem.model.js";
import { getOrCreateUser } from "../utils/userSync.js";
import { createLogger } from "../config/logger.js";

const log = createLogger("chat");

const emitMessageToChatRoom = (req, chatId, messagePayload) => {
  const io = req.app.get("io");
  if (!io) return;

  io.to(`chat:${chatId}`).emit("message:received", {
    chatId,
    message: messagePayload,
  });
};

// Get or create a chat for a matched item
export const getOrCreateChat = async (req, res) => {
  try {
    const { clerkUserId } = req;
    const { matchedItemId } = req.params;

    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Find the matched item
    const matchedItem = await MatchedItem.findById(matchedItemId)
      .populate('sourceItem matchedItem sourceUser matchedUser');

    if (!matchedItem) {
      return res.status(404).json({
        success: false,
        message: "Matched item not found"
      });
    }

    // Verify user is part of this match
    const isParticipant = 
      matchedItem.sourceUser._id.toString() === user._id.toString() ||
      matchedItem.matchedUser._id.toString() === user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this match"
      });
    }

    // Check if chat already exists
    let chat = await Chat.findOne({ matchedItem: matchedItemId })
      .populate('participants', 'clerkId name email')
      .populate('items', 'itemName type category image');

    // Create new chat if it doesn't exist
    if (!chat) {
      chat = new Chat({
        participants: [matchedItem.sourceUser._id, matchedItem.matchedUser._id],
        matchedItem: matchedItem._id,
        items: [matchedItem.sourceItem._id, matchedItem.matchedItem._id],
        unreadCount: new Map([
          [matchedItem.sourceUser._id.toString(), 0],
          [matchedItem.matchedUser._id.toString(), 0]
        ])
      });
      await chat.save();
      
      // Populate after save
      chat = await Chat.findById(chat._id)
        .populate('participants', 'clerkId name email')
        .populate('items', 'itemName type category image');
    }

    res.status(200).json({
      success: true,
      chat
    });
  } catch (error) {
    log.error("Error getting/creating chat:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get all chats for current user
export const getMyChats = async (req, res) => {
  try {
    const { clerkUserId } = req;

    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    const chats = await Chat.find({
      participants: user._id,
      status: "active"
    })
      .populate('participants', 'clerkId name email')
      .populate('items', 'itemName type category image')
      .populate('lastMessageBy', 'name')
      .sort({ lastMessageAt: -1 })
      .limit(50);

    // Format chats with user-specific data
    const formattedChats = chats.map(chat => {
      const otherParticipant = chat.participants.find(
        p => p._id.toString() !== user._id.toString()
      );
      const unreadCount = chat.unreadCount.get(user._id.toString()) || 0;

      return {
        _id: chat._id,
        matchedItem: chat.matchedItem,
        otherUser: otherParticipant,
        items: chat.items,
        lastMessage: chat.lastMessage,
        lastMessageAt: chat.lastMessageAt,
        lastMessageBy: chat.lastMessageBy,
        unreadCount,
        createdAt: chat.createdAt
      };
    });

    res.status(200).json({
      success: true,
      chats: formattedChats
    });
  } catch (error) {
    log.error("Error fetching chats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get a single chat by id (cheap — lets conversation open without pulling the whole list)
export const getChatById = async (req, res) => {
  try {
    const { clerkUserId } = req;
    const { chatId } = req.params;

    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    const chat = await Chat.findById(chatId)
      .populate('participants', 'clerkId name email')
      .populate('items', 'itemName type category image');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    const isParticipant = chat.participants.some(
      p => (p._id || p).toString() === user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this chat"
      });
    }

    res.status(200).json({ success: true, chat });
  } catch (error) {
    log.error("Error fetching chat by id", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Get messages for a specific chat
export const getChatMessages = async (req, res) => {
  try {
    const { clerkUserId } = req;
    const { chatId } = req.params;
    const { limit = 50, before } = req.query;

    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify user is part of this chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    const isParticipant = chat.participants.some(
      p => p.toString() === user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this chat"
      });
    }

    // Build query for pagination
    const query = { chat: chatId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'clerkId name email')
      .populate('readBy', 'clerkId')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Mark messages as read (server-side)
    const unreadMessages = messages.filter(
      msg => msg.sender._id.toString() !== user._id.toString() &&
             !msg.readBy.some(rb => rb._id.toString() === user._id.toString())
    );

    if (unreadMessages.length > 0) {
      await Message.updateMany(
        {
          _id: { $in: unreadMessages.map(m => m._id) },
          sender: { $ne: user._id }
        },
        {
          $addToSet: { readBy: user._id },
          status: "read"
        }
      );

      // Update unread count in chat
      const currentUnread = chat.unreadCount.get(user._id.toString()) || 0;
      chat.unreadCount.set(user._id.toString(), Math.max(0, currentUnread - unreadMessages.length));
      await chat.save();

      // Reflect this change in the messages we will return
      unreadMessages.forEach(m => {
        m.readBy = [...(m.readBy || []), { clerkId: user.clerkId }];
      });
    }

    // Convert readBy to clerkId strings for frontend convenience
    const messagesForClient = messages.reverse().map(m => {
      const obj = m.toObject ? m.toObject() : m;
      // Filter out undefined/null values and safely extract clerkId
      obj.readBy = (m.readBy || [])
        .filter(rb => rb != null)
        .map(rb => {
          if (typeof rb === 'string') return rb;
          if (rb.clerkId) return rb.clerkId;
          if (rb._id) return rb._id.toString();
          return rb.toString();
        });
      return obj;
    });

    res.status(200).json({
      success: true,
      messages: messagesForClient, // Return in chronological order with clerkIds in readBy
      hasMore: messages.length === parseInt(limit)
    });
  } catch (error) {
    log.error("Error fetching messages:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Send a message
export const sendMessage = async (req, res) => {
  try {
    const { clerkUserId } = req;
    const { chatId } = req.params;
    const { content, type = "text", imageUrl = null } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message content is required"
      });
    }

    // SECURITY: clients may only send text — voice/system types are server-side only
    if (type !== "text") {
      return res.status(400).json({
        success: false,
        message: "Invalid message type"
      });
    }

    if (content.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message is too long (max 2000 characters)"
      });
    }

    // imageUrl, when provided, must be a short https URL (no data: URIs, no JS)
    let safeImageUrl = null;
    if (imageUrl !== null && imageUrl !== undefined && imageUrl !== "") {
      if (typeof imageUrl !== "string" || imageUrl.length > 2000 || !imageUrl.startsWith("https://")) {
        return res.status(400).json({
          success: false,
          message: "Invalid image URL"
        });
      }
      safeImageUrl = imageUrl;
    }

    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify chat exists and user is participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    const isParticipant = chat.participants.some(
      p => p.toString() === user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this chat"
      });
    }

    // Create message
    const message = new Message({
      chat: chatId,
      sender: user._id,
      content: content.trim(),
      type: "text",
      imageUrl: safeImageUrl,
      readBy: [user._id] // Sender has read it
    });

    await message.save();

    // Update chat
    chat.lastMessage = content.trim().substring(0, 100);
    chat.lastMessageAt = new Date();
    chat.lastMessageBy = user._id;

    // Increment unread count for other participant
    const otherParticipantId = chat.participants.find(
      p => p.toString() !== user._id.toString()
    ).toString();
    
    const currentUnread = chat.unreadCount.get(otherParticipantId) || 0;
    chat.unreadCount.set(otherParticipantId, currentUnread + 1);

    await chat.save();

    // Populate sender info
    await message.populate('sender', 'clerkId name email');

    res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    log.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Delete a chat (archive it)
export const deleteChat = async (req, res) => {
  try {
    const { clerkUserId } = req;
    const { chatId } = req.params;

    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found"
      });
    }

    const isParticipant = chat.participants.some(
      p => p.toString() === user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not part of this chat"
      });
    }

    chat.status = "archived";
    await chat.save();

    res.status(200).json({
      success: true,
      message: "Chat archived successfully"
    });
  } catch (error) {
    log.error("Error deleting chat:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
