import { io } from 'socket.io-client';
import { API_URL } from '../config/env';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.token = null;
  }

  connect(userId, chatIds = [], authToken = null) {
    if (this.socket?.connected) {
      if (__DEV__) console.log('Socket already connected');
      return this.socket;
    }

    // Store token for reconnection
    if (authToken) {
      this.token = authToken;
    }

    // Extract base URL without /api - handle various URL formats
    let socketUrl = API_URL;
    if (!socketUrl) {
      console.error('API_URL is not defined - socket connection failed');
      return null;
    }
    
    if (socketUrl.endsWith('/api')) {
      socketUrl = socketUrl.slice(0, -4);
    }
    
    if (__DEV__) {
      console.log('Connecting to socket server:', socketUrl);
      console.log('User ID:', userId);
      console.log('Chat IDs:', chatIds);
    }
    
    this.socket = io(socketUrl, {
      auth: {
        token: this.token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      if (__DEV__) console.log('✅ Socket connected:', this.socket.id);
      this.connected = true;
      
      // Join user and their chats
      this.socket.emit('user:join', { userId, chatIds });
    });

    this.socket.on('connection:success', (data) => {
      if (__DEV__) console.log('✅ Connection success:', data);
    });

    this.socket.on('disconnect', () => {
      if (__DEV__) console.log('❌ Socket disconnected');
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message || error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      if (__DEV__) console.log('🔌 Disconnecting socket...');
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.token = null;
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  getSocket() {
    return this.socket;
  }

  joinChat(chatId, userId) {
    if (this.socket?.connected) {
      this.socket.emit('chat:join', { chatId, userId });
      if (__DEV__) console.log('Joined chat:', chatId);
    }
  }

  leaveChat(chatId, userId) {
    if (this.socket?.connected) {
      this.socket.emit('chat:leave', { chatId, userId });
      if (__DEV__) console.log('Left chat:', chatId);
    }
  }

  sendMessage(chatId, senderId, content, senderInfo, tempId) {
    if (this.socket?.connected) {
      this.socket.emit('message:send', {
        chatId,
        senderId,
        content,
        senderInfo,
        tempId
      });
    } else {
      console.error('Socket not connected, cannot send message');
    }
  }

  onMessageReceived(callback) {
    if (this.socket) {
      this.socket.on('message:received', callback);
    }
  }

  offMessageReceived(callback) {
    if (this.socket) {
      this.socket.off('message:received', callback);
    }
  }

  startTyping(chatId, userId, userName) {
    if (this.socket?.connected) {
      this.socket.emit('typing:start', { chatId, userId, userName });
    }
  }

  stopTyping(chatId, userId) {
    if (this.socket?.connected) {
      this.socket.emit('typing:stop', { chatId, userId });
    }
  }

  onTypingUpdate(callback) {
    if (this.socket) {
      this.socket.on('typing:update', callback);
    }
  }

  offTypingUpdate(callback) {
    if (this.socket) {
      this.socket.off('typing:update', callback);
    }
  }

  markMessagesAsRead(chatId, userId, messageIds) {
    if (this.socket?.connected) {
      if (__DEV__) console.log('📨 Marking messages as read:', { chatId, messageIds });
      this.socket.emit('messages:read', { chatId, userId, messageIds });
    }
  }

  onUserOnline(callback) {
    if (this.socket) {
      this.socket.on('user:online', callback);
    }
  }

  offUserOnline(callback) {
    if (this.socket) {
      this.socket.off('user:online', callback);
    }
  }

  onUserOffline(callback) {
    if (this.socket) {
      this.socket.on('user:offline', callback);
    }
  }

  offUserOffline(callback) {
    if (this.socket) {
      this.socket.off('user:offline', callback);
    }
  }

  onMessagesReadUpdate(callback) {
    if (this.socket) {
      this.socket.on('messages:read:update', callback);
    }
  }

  offMessagesReadUpdate(callback) {
    if (this.socket) {
      this.socket.off('messages:read:update', callback);
    }
  }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;
