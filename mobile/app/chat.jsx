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

export default function ChatScreen() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const fetchChats = async () => {
    try {
      setError(null);
      const token = await getToken();
      const api = getAuthenticatedApi(token);
      const response = await api.getChats();
      setChats(response.chats || []);
      
      // Connect to socket with all chat IDs
      if (response.chats && response.chats.length > 0) {
        const chatIds = response.chats.map(c => c._id);
        if (!socketService.isConnected()) {
          socketService.connect(user?.id, chatIds);
        }
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError('Failed to load chats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const initChatAndSocket = async () => {
      try {
        const token = await getToken();
        const api = getAuthenticatedApi(token);
        const response = await api.getChats();
        setChats(response.chats || []);
        setLoading(false);
        
        // Connect socket with all chat IDs
        if (response.chats && response.chats.length > 0) {
          const chatIds = response.chats.map(c => c._id);
          if (!socketService.isConnected()) {
            socketService.connect(user?.id, chatIds, token);
          }
        }
      } catch (err) {
        console.error('Error fetching chats:', err);
        setError('Failed to load chats');
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
    fetchChats();
  };

  const formatTime = (date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now - messageDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return messageDate.toLocaleDateString();
  };

  const handleChatPress = (chat) => {
    router.push({
      pathname: '/chat-conversation',
      params: {
        chatId: chat._id,
        otherUserName: chat.otherUser?.name || chat.otherUser?.email?.split('@')[0] || 'User'
      }
    });
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
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
            <Text style={styles.retryButtonText}>Retry</Text>
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
            <Text style={styles.placeholderTitle}>No Messages Yet</Text>
            <Text style={styles.placeholderText}>
              When you match with someone, you can start chatting here to coordinate the return of lost items.
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
                    {chat.otherUser?.name || chat.otherUser?.email?.split('@')[0] || 'User'}
                  </Text>
                  <Text style={styles.chatTime}>{formatTime(chat.lastMessageAt)}</Text>
                </View>

                <View style={styles.chatDetails}>
                  <Text style={styles.itemInfo} numberOfLines={1}>
                    {chat.items?.map(item => item.itemName).join(' & ') || 'Match'}
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
                    {chat.lastMessage || 'No messages yet'}
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
