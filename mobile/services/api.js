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

let onBannedCallback = null;
export const registerBannedCallback = (cb) => {
  onBannedCallback = cb;
};

// Create a function that accepts a token parameter and getToken function
export const getAuthenticatedApi = (token, getTokenFn = null) => {
  let currentToken = token;

  // Create a new instance with the initial token. A request interceptor below
  // refreshes it before each call so long-lived screens do not reuse expired JWTs.
  const authenticatedApi = axios.create({
    baseURL: API_URL,
    timeout: 30000, // 30 second timeout
    headers: {
      'Content-Type': 'application/json',
      ...(currentToken && { Authorization: `Bearer ${currentToken}` })
    },
  });

  authenticatedApi.interceptors.request.use(
    async (config) => {
      if (getTokenFn) {
        const freshToken = await getTokenFn({ skipCache: true });
        if (freshToken) {
          currentToken = freshToken;
          config.headers.Authorization = `Bearer ${freshToken}`;
        }
      } else if (currentToken) {
        config.headers.Authorization = `Bearer ${currentToken}`;
      }

      return config;
    },
    error => Promise.reject(error)
  );

  // Add response interceptor to handle 401 and refresh token
  authenticatedApi.interceptors.response.use(
    response => response,
    async (error) => {
      const originalRequest = error.config;

      // Handle 403 Forbidden (Banned user)
      if (error.response?.status === 403) {
        if (onBannedCallback) {
          onBannedCallback();
        }
      }

      // If we get a 401 and have a getToken function, try refreshing the token
      if (error.response?.status === 401 && getTokenFn && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const newToken = await getTokenFn({ skipCache: true });
          if (newToken) {
            currentToken = newToken;
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return authenticatedApi(originalRequest);
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }
  );

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
    getItems: async (params = {}) => {
      try {
        const query = new URLSearchParams();
        if (params.type) query.set('type', params.type);
        if (params.near) query.set('near', params.near);
        if (params.radius) query.set('radius', String(params.radius));
        if (params.institution) query.set('institution', params.institution);
        const qs = query.toString();
        const response = await authenticatedApi.get(`/items${qs ? `?${qs}` : ''}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching items:', error);
        throw error;
      }
    },
    getItemById: async (itemId) => {
      try {
        const response = await authenticatedApi.get(`/items/${itemId}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching item by id:', error);
        throw error;
      }
    },
    updateItem: async (itemId, itemData) => {
      try {
        const response = await authenticatedApi.put(`/items/${itemId}`, itemData);
        return response.data;
      } catch (error) {
        console.error('Error updating item:', error);
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
    getMatchedItem: async (matchedItemId) => {
      try {
        const response = await authenticatedApi.get(`/matches/detail/${matchedItemId}`);
        return response.data;
      } catch (error) {
        console.error('Error getting matched item:', error);
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
    requestClaim: async (matchedItemId, chatId) => {
      try {
        const response = await authenticatedApi.post(`/matches/${matchedItemId}/claim`, { chatId });
        return response.data;
      } catch (error) {
        console.error('Error requesting claim:', error);
        throw error;
      }
    },
    confirmClaim: async (matchedItemId, chatId) => {
      try {
        const response = await authenticatedApi.post(`/matches/${matchedItemId}/confirm`, { chatId });
        return response.data;
      } catch (error) {
        console.error('Error confirming claim:', error);
        throw error;
      }
    },
    cancelClaim: async (matchedItemId, chatId) => {
      try {
        const response = await authenticatedApi.post(`/matches/${matchedItemId}/cancel-claim`, { chatId });
        return response.data;
      } catch (error) {
        console.error('Error cancelling claim:', error);
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
    },

    getMyItemsSummary: async () => {
      try {
        const response = await authenticatedApi.get('/items/mine/summary');
        return response.data;
      } catch (error) {
        console.error('Error fetching my items summary:', error);
        throw error;
      }
    },
    getChat: async (chatId) => {
      try {
        const response = await authenticatedApi.get(`/chats/${chatId}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching chat:', error);
        throw error;
      }
    },
    getMyMatches: async () => {
      try {
        const response = await authenticatedApi.get('/matches/my/items');
        return response.data;
      } catch (error) {
        console.error('Error fetching my matches:', error);
        return { success: true, results: [], totalItems: 0, itemsWithMatches: 0 };
      }
    },
    getMyMatchesCount: async () => {
      try {
        const response = await authenticatedApi.get('/matches/my/count');
        return response.data;
      } catch (error) {
        console.error('Error fetching matches count:', error);
        return { success: true, count: 0 };
      }
    },
    getMyInstitutions: async () => {
      try {
        const response = await authenticatedApi.get('/institutions/me');
        return response.data;
      } catch (error) {
        console.error('Error fetching institutions:', error);
        throw error;
      }
    },
    getCurrentUser: async () => {
      try {
        const response = await authenticatedApi.get('/users/me');
        return response.data;
      } catch (error) {
        console.error('Error fetching current user:', error);
        throw error;
      }
    },
    acceptTerms: async () => {
      try {
        const response = await authenticatedApi.patch('/users/me/terms');
        return response.data;
      } catch (error) {
        console.error('Error accepting terms:', error);
        throw error;
      }
    },
  };
};

// Export the base API for non-authenticated requests
export default api;
