import Message from "../models/message.model.js";
import Chat from "../models/chat.model.js";
import User from "../models/user.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import mongoose from 'mongoose';
import { createLogger } from "./logger.js";

const log = createLogger("socket");

// Store connected users: { userId: socketId }
const connectedUsers = new Map();

// Resolve the verified Clerk user id for a socket (set by auth middleware)
const socketClerkId = (socket) => socket.userId || null;

async function getUserDocByClerkId(clerkId) {
  if (!clerkId) return null;
  try {
    return await User.findOne({ clerkId });
  } catch {
    return null;
  }
}

// Verify the socket owner participates in the chat. Never trust client userId.
async function isChatParticipant(chatId, clerkId) {
  if (!chatId || !clerkId) return false;
  try {
    const chat = await Chat.findById(chatId).populate('participants', 'clerkId');
    if (!chat) return false;
    return chat.participants.some((p) => p.clerkId === clerkId);
  } catch {
    return false;
  }
}

export const setupSocketHandlers = (io) => {
  // Middleware to authenticate socket connections — strict, no dev bypass.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Unauthorized: missing token"));
      }

      let decoded;
      try {
        decoded = await clerkClient.verifyToken(token);
      } catch (err) {
        return next(new Error("Unauthorized: invalid token"));
      }

      // Banned users get no socket access (mirrors REST requireAuth)
      const userDoc = await getUserDocByClerkId(decoded.sub);
      if (userDoc && userDoc.status === "BANNED") {
        return next(new Error("Forbidden: account banned"));
      }

      socket.userId = decoded.sub; // Verified Clerk id — sole identity source
      log.debug('✅ Socket authenticated for user:', decoded.sub);
      next();
    } catch (error) {
      log.error('Socket auth error:', error);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    log.debug(`\n🔌 New Socket Connection`);
    log.debug(`   Socket ID: ${socket.id}`);
    log.debug(`   Transport: ${socket.conn?.transport?.name || 'unknown'}`);
    log.debug(`   Remote Address: ${socket.handshake.address}`);

    // User authentication and joining
    socket.on("user:join", async ({ chatIds = [] } = {}) => {
      try {
        // SECURITY: identity comes from the verified token only — ignore client userId
        const userId = socketClerkId(socket);
        if (!userId) {
          return socket.emit("connection:error", { message: "Unauthorized" });
        }
        // Store user connection
        connectedUsers.set(userId, socket.id);
        log.debug(`👤 User ${userId} connected with socket ${socket.id}`);

        // Join only chat rooms this user participates in
        const joinedChatIds = [];
        if (Array.isArray(chatIds) && chatIds.length > 0) {
          for (const chatId of chatIds) {
            if (await isChatParticipant(chatId, userId)) {
              socket.join(`chat:${chatId}`);
              joinedChatIds.push(chatId);
              log.debug(`  → Joined chat room: ${chatId}`);
            } else {
              log.warn(`  → Denied join for chat room: ${chatId} (not a participant)`);
            }
          }
        }

        // Notify user they're connected
        socket.emit("connection:success", {
          message: "Connected to chat server",
          userId,
        });

        // Notify chats the user actually joined that they are online
        joinedChatIds.forEach((chatId) => {
          socket.to(`chat:${chatId}`).emit("user:online", { userId, chatId });
        });
      } catch (error) {
        log.error("Error in user:join:", error);
        socket.emit("connection:error", { message: "Failed to join" });
      }
    });

    // Join a specific chat room
    socket.on("chat:join", async ({ chatId } = {}) => {
      const userId = socketClerkId(socket);
      if (!userId) {
        return socket.emit("connection:error", { message: "Unauthorized" });
      }
      if (!(await isChatParticipant(chatId, userId))) {
        log.warn(`⛔ Denied chat:join for user ${userId} in chat ${chatId}`);
        return socket.emit("connection:error", { message: "Not a participant" });
      }
      socket.join(`chat:${chatId}`);
      log.debug(`👤 User ${userId} joined chat room: ${chatId}`);

      // Notify others in the room that user is online
      log.debug(`📢 Broadcasting user:online to chat:${chatId} for user ${userId}`);
      socket.to(`chat:${chatId}`).emit("user:online", { userId, chatId });
      
      // Also send back current online users in this chat to the joiner
      const socketsInRoom = io.sockets.adapter.rooms.get(`chat:${chatId}`);
      if (socketsInRoom) {
        log.debug(`   Found ${socketsInRoom.size} socket(s) in room chat:${chatId}`);
        const onlineUsersInChat = new Set();

        // Load chat participants once for validation
        let chatDoc = null;
        try {
          chatDoc = await Chat.findById(chatId).populate('participants', 'clerkId');
        } catch (err) {
          log.error('Error loading chat for online user validation:', err);
        }

        for (const socketId of socketsInRoom) {
          const sock = io.sockets.sockets.get(socketId);
          if (!sock?.userId || sock.userId === userId) continue;

          // If we have chat participants, ensure this sock.userId corresponds to one of them
          if (chatDoc) {
            const isParticipant = chatDoc.participants.some(p => p.clerkId === sock.userId);
            if (!isParticipant) {
              log.debug(`   → Skipping user ${sock.userId} (not a participant in chat ${chatId})`);
              continue;
            }
          }

          onlineUsersInChat.add(sock.userId);
          log.debug(`   → User ${sock.userId} is already online in this chat`);
        }

        if (onlineUsersInChat.size > 0) {
          for (const onlineUserId of onlineUsersInChat) {
            log.debug(`   📤 Sending user:online event to ${userId} about ${onlineUserId}`);
            socket.emit("user:online", { userId: onlineUserId, chatId });
          }
        } else {
          log.debug(`   ℹ️  No other users currently online in this chat`);
        }
      }
    });

    // Leave a chat room
    socket.on("chat:leave", ({ chatId } = {}) => {
      const userId = socketClerkId(socket);
      if (!userId || !chatId) return;
      socket.leave(`chat:${chatId}`);
      log.debug(`👤 User ${userId} left chat room: ${chatId}`);

      socket.to(`chat:${chatId}`).emit("user:offline", { userId, chatId });
    });

    // Query whether a specific user is online (callback) - used by clients when chatInfo arrives
    // SECURITY: chatId required, and both requester and target must participate in it
    socket.on('user:status:query', async ({ userId, chatId } = {}, cb) => {
      try {
        const requesterId = socketClerkId(socket);
        if (!requesterId || !chatId || !userId) {
          return cb && cb({ online: false });
        }
        const [requesterOk, targetOk] = await Promise.all([
          isChatParticipant(chatId, requesterId),
          isChatParticipant(chatId, userId),
        ]);
        if (!requesterOk || !targetOk) {
          return cb && cb({ online: false });
        }
        const isOnline = connectedUsers.has(userId);
        log.debug(`user:status:query - user ${userId} online=${isOnline}`);
        return cb && cb({ online: isOnline });
      } catch (err) {
        log.error('Error handling user:status:query:', err);
        return cb && cb({ online: false });
      }
    });

    // Send a message
    socket.on("message:send", async (data) => {
      try {
        // SECURITY: sender identity comes from the verified token, never the client
        const senderId = socketClerkId(socket);
        const { chatId, content } = data || {};
        if (!senderId || !chatId) {
          return socket.emit("message:error", { error: "Unauthorized", tempId: data?.tempId });
        }
        if (!(await isChatParticipant(chatId, senderId))) {
          log.warn(`⛔ Denied message:send for user ${senderId} in chat ${chatId}`);
          return socket.emit("message:error", { error: "Not a participant", tempId: data?.tempId });
        }

        // Resolve sender profile server-side (ignore client senderInfo)
        const senderDoc = await User.findOne({ clerkId: senderId });
        const senderInfo = senderDoc
          ? { _id: senderDoc._id, clerkId: senderDoc.clerkId, name: senderDoc.name, email: senderDoc.email }
          : { clerkId: senderId };

        log.debug(`💬 Message from ${senderId} in chat ${chatId}`);

        // Broadcast to everyone in the chat room including sender
        io.to(`chat:${chatId}`).emit("message:received", {
          chatId,
          message: {
            _id: data.tempId, // Temporary ID, will be replaced with real one
            chat: chatId,
            sender: senderInfo,
            content,
            type: "text",
            status: "sent",
            createdAt: new Date(),
            readBy: [senderId],
          },
        });

        // Update chat's last message
        const chat = await Chat.findById(chatId);
        if (chat) {
          try {
            const senderObjectId = senderDoc ? senderDoc._id : null;

            chat.lastMessage = content?.substring(0, 100) || '';
            chat.lastMessageAt = new Date();
            if (senderObjectId) chat.lastMessageBy = senderObjectId;

            // Increment unread count for the other participant
            const compareKey = senderObjectId ? senderObjectId.toString() : senderId;
            const otherParticipantId = chat.participants.find((p) => p.toString() !== compareKey)?.toString();

            if (otherParticipantId) {
              const currentUnread = chat.unreadCount.get(otherParticipantId) || 0;
              chat.unreadCount.set(otherParticipantId, currentUnread + 1);
            }

            await chat.save();
          } catch (err) {
            log.error('Error updating chat after message send:', err);
          }
        }
      } catch (error) {
        log.error("Error sending message:", error);
        socket.emit("message:error", {
          error: "Failed to send message",
          tempId: data?.tempId,
        });
      }
    });

    // Typing indicator (participant-only, verified identity)
    socket.on("typing:start", async ({ chatId, userName } = {}) => {
      const userId = socketClerkId(socket);
      if (!userId || !(await isChatParticipant(chatId, userId))) return;
      socket.to(`chat:${chatId}`).emit("typing:update", {
        chatId,
        userId,
        userName,
        isTyping: true,
      });
    });

    socket.on("typing:stop", async ({ chatId } = {}) => {
      const userId = socketClerkId(socket);
      if (!userId || !(await isChatParticipant(chatId, userId))) return;
      socket.to(`chat:${chatId}`).emit("typing:update", {
        chatId,
        userId,
        isTyping: false,
      });
    });

    // Mark messages as read
    socket.on("messages:read", async ({ chatId, messageIds } = {}) => {
      try {
        // SECURITY: reader identity comes from the verified token, never the client
        const userId = socketClerkId(socket);
        if (!userId || !(await isChatParticipant(chatId, userId))) return;
        log.debug(`📖 User ${userId} read ${messageIds?.length || 0} messages in chat ${chatId}`);

        // Find user by clerkId to get the ObjectId stored in messages
        const userDoc = await User.findOne({ clerkId: userId });
        if (!userDoc) {
          log.warn(`User with clerkId ${userId} not found - cannot mark messages as read`);
          return;
        }
        const userObjectId = userDoc._id;

        // Filter messageIds to valid ObjectIds (ignore temp IDs like 'temp_...')
        const validMessageIds = (messageIds || []).filter(id => mongoose.isValidObjectId(id));

        // Update messages in database (only messages not sent by this user)
        if (validMessageIds.length > 0) {
          await Message.updateMany(
            {
              _id: { $in: validMessageIds },
              chat: chatId,
              sender: { $ne: userObjectId },
            },
            {
              $addToSet: { readBy: userObjectId },
              $set: { status: 'read' },
            }
          );
        }

        // Update chat unread count for this user (set to 0)
        const chat = await Chat.findById(chatId);
        if (chat) {
          // Use string key for map consistency
          chat.unreadCount.set(userObjectId.toString(), 0);
          await chat.save();
        }

        // Notify other users in the chat that messages were read (send only valid ids)
        socket.to(`chat:${chatId}`).emit("messages:read:update", {
          chatId,
          userId,
          messageIds: validMessageIds,
          readAt: new Date(),
        });

        log.debug(`✅ Messages marked as read for user ${userId}`);
      } catch (error) {
        log.error("Error marking messages as read:", error);
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      let disconnectedUserId = null;

      for (const [uid, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = uid;
          connectedUsers.delete(uid);
          log.debug(`👋 User ${uid} disconnected`);
          break;
        }
      }

      // Notify all chat rooms that user is offline
      if (disconnectedUserId) {
        const rooms = Array.from(socket.rooms).filter((room) => room.startsWith('chat:'));
        rooms.forEach((room) => {
          const affectedChatId = room.replace('chat:', '');
          io.to(room).emit("user:offline", {
            userId: disconnectedUserId,
            chatId: affectedChatId,
          });
        });
      }

      log.debug(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

// Helper function to check if user is online
export const isUserOnline = (userId) => connectedUsers.has(userId);

// Helper function to get all online users
export const getOnlineUsers = () => Array.from(connectedUsers.keys());

// Helper function to emit to a specific user
export const emitToUser = (io, userId, event, data) => {
  const socketId = connectedUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};
