import axios from 'axios';

import { API_URL } from "../config/env";

// Create axios instance without interceptor
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 second timeout to prevent hanging
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a function that accepts a token parameter
export const getAuthenticatedApi = (token) => {
  // Create a new instance with the token
  const authenticatedApi = axios.create({
    baseURL: API_URL,
    timeout: 30000, // 30 second timeout
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    },
  });

  return {
    reportItem: async (itemData) => {
      try {
        const response = await authenticatedApi.post('/items/report', itemData);
        return response.data;
      } catch (error) {
        console.error('Error reporting item:', error);
        throw error;
      }
    },
    getItems: async () => {
      try {
        const response = await authenticatedApi.get('/items');
        return response.data;
      } catch (error) {
        console.error('Error fetching items:', error);
        throw error;
      }
    },
    deleteItem: async (itemId) => {
      try {
        const response = await authenticatedApi.delete(`/items/${itemId}`);
        return response.data;
      } catch (error) {
        console.error('Error deleting item:', error);
        throw error;
      }
    },
    getNotifications: async () => {
      try {
        const response = await authenticatedApi.get('/notifications');
        return response.data;
      } catch (error) {
        console.error('Error fetching notifications:', error);
        throw error;
      }
    },
    markNotificationAsRead: async (notificationId) => {
      try {
        const response = await authenticatedApi.patch(`/notifications/${notificationId}/read`);
        return response.data;
      } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
      }
    },
    markAllNotificationsAsRead: async () => {
      try {
        const response = await authenticatedApi.patch('/notifications/read-all');
        return response.data;
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
      }
    },
    deleteNotification: async (notificationId) => {
      try {
        const response = await authenticatedApi.delete(`/notifications/${notificationId}`);
        return response.data;
      } catch (error) {
        console.error('Error deleting notification:', error);
        throw error;
      }
    },
    // Chat APIs
    getChats: async () => {
      try {
        const response = await authenticatedApi.get('/chats');
        return response.data;
      } catch (error) {
        console.error('Error fetching chats:', error);
        throw error;
      }
    },
    getOrCreateChatForMatch: async (matchedItemId) => {
      try {
        const response = await authenticatedApi.get(`/chats/match/${matchedItemId}`);
        return response.data;
      } catch (error) {
        console.error('Error getting/creating chat:', error);
        throw error;
      }
    },
    getMatchedItemByItems: async (item1Id, item2Id) => {
      try {
        const response = await authenticatedApi.get('/matches/find', {
          params: { item1Id, item2Id }
        });
        return response.data;
      } catch (error) {
        console.error('Error getting matched item:', error);
        throw error;
      }
    },
    getChatMessages: async (chatId, limit = 50, before = null) => {
      try {
        const params = { limit };
        if (before) params.before = before;
        const response = await authenticatedApi.get(`/chats/${chatId}/messages`, { params });
        return response.data;
      } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }
    },
    sendMessage: async (chatId, content, type = 'text', imageUrl = null) => {
      try {
        const response = await authenticatedApi.post(`/chats/${chatId}/messages`, {
          content,
          type,
          imageUrl
        });
        return response.data;
      } catch (error) {
        console.error('Error sending message:', error);
        throw error;
      }
    },
    deleteChat: async (chatId) => {
      try {
        const response = await authenticatedApi.delete(`/chats/${chatId}`);
        return response.data;
      } catch (error) {
        console.error('Error deleting chat:', error);
        throw error;
      }
    }
  };
};

// Export the base API for non-authenticated requests
export default api;