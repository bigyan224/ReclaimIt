import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { BottomNavBar } from '../components/BottomNavBar';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/colors';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getAuthenticatedApi } from '../services/api';
import socketService from '../services/socket';
import { useI18n } from '../i18n/I18nProvider';

// Module-level cache to avoid re-fetch on tab switches/remounts in same app session.
let cachedChats = null;
let hasFetchedChatsOnce = false;
let chatsFetchPromise = null;
let cachedChatErrorKey = null;
let cachedChatUserId = null;

export default function ChatScreen() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const [chats, setChats] = useState(cachedChats ?? []);
  const [loading, setLoading] = useState(!hasFetchedChatsOnce);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(cachedChatErrorKey ? t(cachedChatErrorKey) : null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const applyCachedChats = () => {
    setChats(cachedChats ?? []);
    setError(cachedChatErrorKey ? t(cachedChatErrorKey) : null);
  };

  const fetchChats = async (force = false) => {
    try {
      setError(null);

      if (cachedChatUserId && cachedChatUserId !== user?.id) {
        cachedChats = null;
        hasFetchedChatsOnce = false;
        chatsFetchPromise = null;
        cachedChatErrorKey = null;
      }

      if (!force && hasFetchedChatsOnce) {
        applyCachedChats();
        setLoading(false);
        if (__DEV__) console.log('Using cached chats (session-hydrated)');
        return;
      }

      if (!force && chatsFetchPromise) {
        await chatsFetchPromise;
        applyCachedChats();
        setLoading(false);
        return;
      }

      const runFetch = async () => {
        const token = await getToken({ skipCache: true });
        const api = getAuthenticatedApi(token, getToken);
        const response = await api.getChats();
        cachedChats = response.chats || [];
        cachedChatUserId = user?.id || null;
        cachedChatErrorKey = null;
        hasFetchedChatsOnce = true;
        return { token, chats: cachedChats };
      };

      let fetchResult;
      if (force) {
        fetchResult = await runFetch();
      } else {
        chatsFetchPromise = runFetch();
        fetchResult = await chatsFetchPromise;
      }

      setChats(fetchResult.chats);
      const token = await getToken({ skipCache: true });
      const chatsToConnect = fetchResult.chats;
      
      // Connect to socket with all chat IDs
      if (chatsToConnect && chatsToConnect.length > 0) {
        const chatIds = chatsToConnect.map(c => c._id);
        if (!socketService.isConnected()) {
          socketService.connect(user?.id, chatIds, token);
        }
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
      cachedChatErrorKey = 'chat.failedLoadChats';
      hasFetchedChatsOnce = true;
      setError(t('chat.failedLoadChats'));
    } finally {
      chatsFetchPromise = null;
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const initChatAndSocket = async () => {
      try {
        await fetchChats(false);
      } catch (err) {
        console.error('Error fetching chats:', err);
        setError(t('chat.failedLoadChats'));
        setLoading(false);
      }
    };

    initChatAndSocket();
    
    // Listen for new messages to update chat list
    const handleMessageReceived = (data) => {
      // Update last message in chat list
      setChats(prev => prev.map(chat => {
        if (chat._id === data.chatId) {
          return {
            ...chat,
            lastMessage: data.message.content,
            lastMessageAt: data.message.createdAt,
            unreadCount: data.message.sender.clerkId === user?.id ? chat.unreadCount : (chat.unreadCount || 0) + 1
          };
        }
        return chat;
      }));
    };

    const handleUserOnline = (data) => {
      console.log('👤 User online:', data.userId);
      setOnlineUsers(prev => new Set([...prev, data.userId]));
    };

    const handleUserOffline = (data) => {
      console.log('👤 User offline:', data.userId);
      setOnlineUsers(prev => {
        const updated = new Set(prev);
        updated.delete(data.userId);
        return updated;
      });
    };

    socketService.onMessageReceived(handleMessageReceived);
    socketService.onUserOnline(handleUserOnline);
    socketService.onUserOffline(handleUserOffline);

    return () => {
      socketService.offMessageReceived(handleMessageReceived);
      socketService.offUserOnline(handleUserOnline);
      socketService.offUserOffline(handleUserOffline);
    };
  }, [user?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchChats(true);
  };

  const formatTime = (date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now - messageDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('chat.justNow');
    if (diffMins < 60) return t('chat.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('chat.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('chat.daysAgo', { count: diffDays });
    return messageDate.toLocaleDateString();
  };

  const handleChatPress = (chat) => {
    router.push({
      pathname: '/chat-conversation',
      params: {
        chatId: chat._id,
        otherUserName: chat.otherUser?.name || chat.otherUser?.email?.split('@')[0] || t('chat.user')
      }
    });
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('chat.title')}</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#CBD5E1" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchChats}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : chats.length === 0 ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.placeholderContainer}>
            <Ionicons name="chatbubbles-outline" size={80} color="#CBD5E1" />
            <Text style={styles.placeholderTitle}>{t('chat.noMessagesTitle')}</Text>
            <Text style={styles.placeholderText}>
              {t('chat.noMessagesBody')}
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {chats.map((chat) => {
            const isOnline = onlineUsers.has(chat.otherUser?.clerkId);
            
            return (
            <TouchableOpacity
              key={chat._id}
              style={styles.chatItem}
              onPress={() => handleChatPress(chat)}
            >
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={24} color="#666" />
                </View>
                {isOnline && <View style={styles.onlineIndicator} />}
              </View>

              <View style={styles.chatContent}>
                <View style={styles.chatHeader}>
                  <Text style={styles.chatName} numberOfLines={1}>
                    {chat.otherUser?.name || chat.otherUser?.email?.split('@')[0] || t('chat.user')}
                  </Text>
                  <Text style={styles.chatTime}>{formatTime(chat.lastMessageAt)}</Text>
                </View>

                <View style={styles.chatDetails}>
                  <Text style={styles.itemInfo} numberOfLines={1}>
                    {chat.items?.map(item => item.itemName).join(' & ') || t('chat.match')}
                  </Text>
                </View>

                <View style={styles.chatFooter}>
                  <Text
                    style={[
                      styles.lastMessage,
                      chat.unreadCount > 0 && styles.unreadMessage
                    ]}
                    numberOfLines={1}
                  >
                    {chat.lastMessage || t('chat.noMessagesYet')}
                  </Text>
                  {chat.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadCount}>{chat.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <BottomNavBar activeTab="chat" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderContainer: {
    alignItems: 'center',
    padding: 20,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    marginRight: 12,
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  chatTime: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  chatDetails: {
    marginBottom: 4,
  },
  itemInfo: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  unreadMessage: {
    fontWeight: '600',
    color: '#333',
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
