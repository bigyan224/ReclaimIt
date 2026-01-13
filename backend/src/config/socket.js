import Message from "../models/message.model.js";
import Chat from "../models/chat.model.js";
import User from "../models/user.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import mongoose from 'mongoose';

// Store connected users: { userId: socketId }
const connectedUsers = new Map();

export const setupSocketHandlers = (io) => {
  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        console.log('⚠️  Socket connection without token - allowing in dev mode');
        return next(); // Allow in dev mode
      }

      try {
        const decoded = await clerkClient.verifyToken(token);
        socket.userId = decoded.sub; // Store user ID in socket
        console.log('✅ Socket authenticated for user:', decoded.sub);
        next();
      } catch (err) {
        console.log('⚠️  Token verification failed:', err.message, '- allowing anyway in dev mode');
        // Allow connection anyway for development (remove in production)
        next();
      }
    } catch (error) {
      console.error('Socket auth error:', error);
      next(error);
    }
  });

  io.on("connection", (socket) => {
    console.log(`\n🔌 New Socket Connection`);
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Transport: ${socket.conn?.transport?.name || 'unknown'}`);
    console.log(`   Remote Address: ${socket.handshake.address}`);

    // User authentication and joining
    socket.on("user:join", async ({ userId, chatIds = [] }) => {
      try {
        // Store user connection
        connectedUsers.set(userId, socket.id);
        socket.userId = userId; // Store on socket for easy access
        console.log(`👤 User ${userId} connected with socket ${socket.id}`);

        // Join all chat rooms for this user
        if (chatIds && chatIds.length > 0) {
          chatIds.forEach((chatId) => {
            socket.join(`chat:${chatId}`);
            console.log(`  → Joined chat room: ${chatId}`);
          });
        }

        // Notify user they're connected
        socket.emit("connection:success", {
          message: "Connected to chat server",
          userId,
        });

        // Notify all chats that user is online
        if (chatIds && chatIds.length > 0) {
          chatIds.forEach((chatId) => {
            socket.to(`chat:${chatId}`).emit("user:online", { userId, chatId });
          });
        }
      } catch (error) {
        console.error("Error in user:join:", error);
        socket.emit("connection:error", { message: "Failed to join" });
      }
    });

    // Join a specific chat room
    socket.on("chat:join", async ({ chatId, userId }) => {
      socket.join(`chat:${chatId}`);
      console.log(`👤 User ${userId} joined chat room: ${chatId}`);

      // Notify others in the room that user is online
      console.log(`📢 Broadcasting user:online to chat:${chatId} for user ${userId}`);
      socket.to(`chat:${chatId}`).emit("user:online", { userId, chatId });
      
      // Also send back current online users in this chat to the joiner
      const socketsInRoom = io.sockets.adapter.rooms.get(`chat:${chatId}`);
      if (socketsInRoom) {
        console.log(`   Found ${socketsInRoom.size} socket(s) in room chat:${chatId}`);
        const onlineUsersInChat = new Set();

        // Load chat participants once for validation
        let chatDoc = null;
        try {
          chatDoc = await Chat.findById(chatId).populate('participants', 'clerkId');
        } catch (err) {
          console.error('Error loading chat for online user validation:', err);
        }

        for (const socketId of socketsInRoom) {
          const sock = io.sockets.sockets.get(socketId);
          if (!sock?.userId || sock.userId === userId) continue;

          // If we have chat participants, ensure this sock.userId corresponds to one of them
          if (chatDoc) {
            const isParticipant = chatDoc.participants.some(p => p.clerkId === sock.userId);
            if (!isParticipant) {
              console.log(`   → Skipping user ${sock.userId} (not a participant in chat ${chatId})`);
              continue;
            }
          }

          onlineUsersInChat.add(sock.userId);
          console.log(`   → User ${sock.userId} is already online in this chat`);
        }

        if (onlineUsersInChat.size > 0) {
          for (const onlineUserId of onlineUsersInChat) {
            console.log(`   📤 Sending user:online event to ${userId} about ${onlineUserId}`);
            socket.emit("user:online", { userId: onlineUserId, chatId });
          }
        } else {
          console.log(`   ℹ️  No other users currently online in this chat`);
        }
      }
    });

    // Leave a chat room
    socket.on("chat:leave", ({ chatId, userId }) => {
      socket.leave(`chat:${chatId}`);
      console.log(`👤 User ${userId} left chat room: ${chatId}`);

      socket.to(`chat:${chatId}`).emit("user:offline", { userId, chatId });
    });

    // Query whether a specific user is online (callback) - used by clients when chatInfo arrives
    socket.on('user:status:query', async ({ userId, chatId }, cb) => {
      try {
        const isOnline = connectedUsers.has(userId);
        // If a chatId is provided, verify the queried user is a participant of that chat
        if (chatId && isOnline) {
          try {
            const chatDoc = await Chat.findById(chatId).populate('participants', 'clerkId');
            if (chatDoc) {
              const isParticipant = chatDoc.participants.some(p => p.clerkId === userId);
              if (!isParticipant) {
                console.log(`user:status:query - user ${userId} is not participant of chat ${chatId}`);
                return cb && cb({ online: false });
              }
            }
          } catch (err) {
            console.error('Error validating user participant for status query:', err);
          }
        }

        console.log(`user:status:query - user ${userId} online=${isOnline}`);
        return cb && cb({ online: isOnline });
      } catch (err) {
        console.error('Error handling user:status:query:', err);
        return cb && cb({ online: false });
      }
    });

    // Send a message
    socket.on("message:send", async (data) => {
      try {
        const { chatId, senderId, content, senderInfo } = data;

        console.log(`💬 Message from ${senderId} in chat ${chatId}`);

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
            // Resolve sender to ObjectId if possible (senderId is clerkId string from client)
            let senderObjectId = null;
            if (typeof senderId === 'string') {
              const senderDoc = await User.findOne({ clerkId: senderId });
              if (senderDoc) senderObjectId = senderDoc._id;
            }

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
            console.error('Error updating chat after message send:', err);
          }
        }
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("message:error", {
          error: "Failed to send message",
          tempId: data.tempId,
        });
      }
    });

    // Typing indicator
    socket.on("typing:start", ({ chatId, userId, userName }) => {
      socket.to(`chat:${chatId}`).emit("typing:update", {
        chatId,
        userId,
        userName,
        isTyping: true,
      });
    });

    socket.on("typing:stop", ({ chatId, userId }) => {
      socket.to(`chat:${chatId}`).emit("typing:update", {
        chatId,
        userId,
        isTyping: false,
      });
    });

    // Mark messages as read
    socket.on("messages:read", async ({ chatId, userId, messageIds }) => {
      try {
        console.log(`📖 User ${userId} read ${messageIds?.length || 0} messages in chat ${chatId}`);

        // Find user by clerkId to get the ObjectId stored in messages
        const userDoc = await User.findOne({ clerkId: userId });
        if (!userDoc) {
          console.warn(`User with clerkId ${userId} not found - cannot mark messages as read`);
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

        console.log(`✅ Messages marked as read for user ${userId}`);
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      let disconnectedUserId = null;

      for (const [uid, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = uid;
          connectedUsers.delete(uid);
          console.log(`👋 User ${uid} disconnected`);
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

      console.log(`🔌 Socket disconnected: ${socket.id}`);
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
