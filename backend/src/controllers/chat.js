import Chat from "../models/chat.model.js";
import Message from "../models/message.model.js";
import MatchedItem from "../models/matchedItem.model.js";
import { getOrCreateUser } from "../utils/userSync.js";
import cloudinary from "../config/cloudinary.js";

const GEMINI_MODEL = process.env.GEMINI_STT_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";

const mapLanguageToSupported = (language) => {
  if (!language) return "unknown";
  const normalized = language.toLowerCase();
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("hi")) return "hi";
  return "unknown";
};

const inferLanguageFromText = (text) => {
  if (!text) return "unknown";

  // Basic Devanagari detection as fallback for Hindi.
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[A-Za-z]/.test(text)) return "en";
  return "unknown";
};

const extractGeminiText = (payload) => {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
};

const callGeminiJson = async (parts) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const modelText = extractGeminiText(payload);

  if (!modelText) {
    throw new Error("Gemini returned empty response");
  }

  try {
    return JSON.parse(modelText);
  } catch {
    const firstBrace = modelText.indexOf("{");
    const lastBrace = modelText.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(modelText.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Gemini JSON parse failed");
  }
};

const uploadVoiceToCloudinary = async (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "reclaimit/voice",
        resource_type: "video",
        format: "mp3",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
};

const transcribeVoice = async (buffer, mimeType) => {
  if (!process.env.GEMINI_API_KEY) {
    return {
      transcriptText: "",
      transcriptLanguage: "unknown",
    };
  }

  const parsed = await callGeminiJson([
    {
      text: "Transcribe this audio message accurately. The speaker may switch between Hindi and English. Return strict JSON only in this format: {\"transcriptText\":\"...\",\"transcriptLanguage\":\"hi|en|unknown\"}.",
    },
    {
      inlineData: {
        mimeType: mimeType || "audio/mp4",
        data: buffer.toString("base64"),
      },
    },
  ]);

  const transcriptText = (parsed?.transcriptText || "").trim();
  const transcriptLanguage = mapLanguageToSupported(parsed?.transcriptLanguage) || inferLanguageFromText(transcriptText);

  return {
    transcriptText,
    transcriptLanguage: transcriptLanguage === "unknown" ? inferLanguageFromText(transcriptText) : transcriptLanguage,
  };
};

const transcribeVoiceToEnglish = async (buffer, mimeType) => {
  const parsed = await callGeminiJson([
    {
      text: "Transcribe this voice message into English only. If the speech is Hindi, translate it to natural English. Return strict JSON only in this format: {\"transcriptText\":\"...\",\"transcriptLanguage\":\"en\"}.",
    },
    {
      inlineData: {
        mimeType: mimeType || "audio/mpeg",
        data: buffer.toString("base64"),
      },
    },
  ]);

  const transcriptText = (parsed?.transcriptText || "").trim();
  return {
    transcriptText,
    transcriptLanguage: transcriptText ? "en" : "unknown",
  };
};

const translateTextBetweenEnglishHindi = async (text, targetLanguage) => {
  const parsed = await callGeminiJson([
    {
      text: `Translate this message to ${targetLanguage}. Only Hindi and English are supported. Keep original meaning and tone. Return strict JSON only in this format: {\"translatedText\":\"...\",\"sourceLanguage\":\"en|hi|unknown\",\"targetLanguage\":\"en|hi\"}.`,
    },
    {
      text,
    },
  ]);

  return {
    translatedText: (parsed?.translatedText || "").trim(),
    sourceLanguage: mapLanguageToSupported(parsed?.sourceLanguage),
    targetLanguage: mapLanguageToSupported(parsed?.targetLanguage) || targetLanguage,
  };
};

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
    console.error("Error getting/creating chat:", error);
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
    console.error("Error fetching chats:", error);
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
    console.error("Error fetching messages:", error);
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
    const { content, type = "text", imageUrl } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message content is required"
      });
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
      type,
      imageUrl,
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
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Send a voice message (recorded in app)
export const sendVoiceMessage = async (req, res) => {
  try {
    const { clerkUserId } = req;
    const { chatId } = req.params;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "Voice recording is required"
      });
    }

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

    const cloudinaryUpload = await uploadVoiceToCloudinary(req.file.buffer);

    let transcriptText = "";
    let transcriptLanguage = "unknown";

    try {
      const transcription = await transcribeVoice(req.file.buffer, req.file.mimetype);
      transcriptText = transcription.transcriptText;
      transcriptLanguage = transcription.transcriptLanguage;
    } catch (transcriptionError) {
      console.error("Voice transcription failed:", transcriptionError.message);
    }

    const fallbackContent = transcriptText || "Voice message";

    const message = new Message({
      chat: chatId,
      sender: user._id,
      content: fallbackContent,
      type: "voice",
      audioUrl: cloudinaryUpload.secure_url,
      audioPublicId: cloudinaryUpload.public_id,
      audioDurationSec: Number(cloudinaryUpload.duration || 0),
      audioMimeType: cloudinaryUpload.format === "mp3" ? "audio/mpeg" : req.file.mimetype,
      transcriptText,
      transcriptLanguage,
      readBy: [user._id]
    });

    await message.save();

    chat.lastMessage = transcriptText
      ? transcriptText.substring(0, 100)
      : "Voice message";
    chat.lastMessageAt = new Date();
    chat.lastMessageBy = user._id;

    const otherParticipantId = chat.participants.find(
      p => p.toString() !== user._id.toString()
    )?.toString();

    if (otherParticipantId) {
      const currentUnread = chat.unreadCount.get(otherParticipantId) || 0;
      chat.unreadCount.set(otherParticipantId, currentUnread + 1);
    }

    await chat.save();
    await message.populate("sender", "clerkId name email");

    const messageObj = message.toObject();
    messageObj.readBy = [user.clerkId];

    emitMessageToChatRoom(req, chatId, messageObj);

    res.status(201).json({
      success: true,
      message: messageObj
    });
  } catch (error) {
    console.error("Error sending voice message:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const transcribeVoiceMessageEnglish = async (req, res) => {
  try {
    const { clerkUserId } = req;
    const { chatId, messageId } = req.params;

    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "You are not part of this chat" });
    }

    const message = await Message.findOne({ _id: messageId, chat: chatId });
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (message.type !== "voice") {
      return res.status(400).json({ success: false, message: "Transcription is available only for voice messages" });
    }

    if (!message.audioUrl) {
      return res.status(400).json({ success: false, message: "Voice message audio is unavailable" });
    }

    if (message.transcriptText && message.transcriptLanguage === "en") {
      return res.status(200).json({
        success: true,
        transcriptText: message.transcriptText,
        transcriptLanguage: "en",
      });
    }

    const audioResponse = await fetch(message.audioUrl);
    if (!audioResponse.ok) {
      return res.status(502).json({ success: false, message: "Failed to fetch voice audio" });
    }

    const mimeType = audioResponse.headers.get("content-type") || message.audioMimeType || "audio/mpeg";
    const audioArrayBuffer = await audioResponse.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    const transcription = await transcribeVoiceToEnglish(audioBuffer, mimeType);

    if (!transcription.transcriptText) {
      return res.status(200).json({
        success: true,
        transcriptText: "",
        transcriptLanguage: "unknown",
      });
    }

    message.transcriptText = transcription.transcriptText;
    message.transcriptLanguage = "en";
    await message.save();

    return res.status(200).json({
      success: true,
      transcriptText: transcription.transcriptText,
      transcriptLanguage: "en",
    });
  } catch (error) {
    console.error("Error transcribing voice message:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const translateTextMessage = async (req, res) => {
  try {
    const { clerkUserId } = req;
    const { chatId, messageId } = req.params;
    const { targetLanguage } = req.body;

    const target = mapLanguageToSupported(targetLanguage);
    if (!["en", "hi"].includes(target)) {
      return res.status(400).json({ success: false, message: "targetLanguage must be 'en' or 'hi'" });
    }

    const user = await getOrCreateUser(clerkUserId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "You are not part of this chat" });
    }

    const message = await Message.findOne({ _id: messageId, chat: chatId });
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    if (message.type !== "text") {
      return res.status(400).json({ success: false, message: "Translation is available only for text messages" });
    }

    const source = inferLanguageFromText(message.content);
    if (source === target) {
      return res.status(200).json({
        success: true,
        translatedText: message.content,
        sourceLanguage: source,
        targetLanguage: target,
      });
    }

    const translation = await translateTextBetweenEnglishHindi(message.content, target);

    return res.status(200).json({
      success: true,
      translatedText: translation.translatedText,
      sourceLanguage: translation.sourceLanguage,
      targetLanguage: target,
    });
  } catch (error) {
    console.error("Error translating message:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
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
    console.error("Error deleting chat:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
