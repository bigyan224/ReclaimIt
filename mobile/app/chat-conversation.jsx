import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  AppState
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS } from '../constants/colors';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getAuthenticatedApi } from '../services/api';
import socketService from '../services/socket';

export default function ChatConversationScreen() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { chatId, otherUserName } = useLocalSearchParams();

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatInfo, setChatInfo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const markedReadRef = useRef(new Set());
  const appState = useRef(AppState.currentState);
  const onlineUsersRef = useRef(new Set()); // Track online user IDs

  // Handle app state changes - disconnect socket when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/active/) && nextAppState === 'background') {
        if (__DEV__) console.log('📱 App going to background - disconnecting socket');
        socketService.disconnect();
      } else if (appState.current.match(/background/) && nextAppState === 'active') {
        if (__DEV__) console.log('📱 App coming to foreground - reconnecting socket');
        // Will reconnect in main useEffect below
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    fetchChatInfo();
    fetchMessages();
    
    // Connect to socket and join chat room
    const initSocket = async () => {
      try {
        const token = await getToken();
        if (!socketService.isConnected()) {
          socketService.connect(user?.id, [chatId], token);
        } else {
          socketService.joinChat(chatId, user?.id);
        }
      } catch (err) {
        console.error('Error initializing socket:', err);
      }
    };

    initSocket();

    // Listen for new messages
    const handleMessageReceived = (data) => {
      if (data.chatId === chatId) {
        if (__DEV__) console.log('📨 Received message:', data.message);
        setMessages(prev => {
          // Check if message already exists (avoid duplicates)
          const exists = prev.some(m => m._id === data.message._id);
          if (exists) return prev;
          return [...prev, data.message];
        });
        
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    };

    const handleTypingUpdate = (data) => {
      if (data.chatId === chatId && data.userId !== user?.id) {
        setOtherUserTyping(data.isTyping);
      }
    };

    const handleUserOnline = (data) => {
      if (data.chatId === chatId && data.userId !== user?.id) {
        if (__DEV__) console.log('🟢 User is online:', data.userId);
        onlineUsersRef.current.add(data.userId);
        
        if (chatInfo?.otherUser?.clerkId === data.userId) {
          if (__DEV__) console.log('👤 Other participant came online:', data.userId);
          setIsOtherUserOnline(true);
        }
      }
    };

    const handleUserOffline = (data) => {
      if (data.chatId === chatId && data.userId !== user?.id) {
        if (__DEV__) console.log('🔴 User went offline:', data.userId);
        onlineUsersRef.current.delete(data.userId);
        
        if (chatInfo?.otherUser?.clerkId === data.userId) {
          setIsOtherUserOnline(false);
        }
      }
    };

    const handleMessagesReadUpdate = (data) => {
      if (data.chatId === chatId) {
        if (__DEV__) console.log('✅ Messages marked as read by other user');
        // Update message read status in UI and mark them locally to avoid re-sending
        setMessages(prev => prev.map(msg => {
          if (data.messageIds.includes(msg._id)) {
            markedReadRef.current.add(msg._id);
            return { ...msg, status: 'read', readBy: [...new Set([...(msg.readBy || []), data.userId])] };
          }
          return msg;
        }));
      }
    };

    socketService.onMessageReceived(handleMessageReceived);
    socketService.onTypingUpdate(handleTypingUpdate);
    socketService.onUserOnline(handleUserOnline);
    socketService.onUserOffline(handleUserOffline);
    socketService.onMessagesReadUpdate(handleMessagesReadUpdate);

    // Cleanup
    return () => {
      socketService.offMessageReceived(handleMessageReceived);
      socketService.offTypingUpdate(handleTypingUpdate);
      socketService.offUserOnline(handleUserOnline);
      socketService.offUserOffline(handleUserOffline);
      socketService.offMessagesReadUpdate(handleMessagesReadUpdate);
      socketService.leaveChat(chatId, user?.id);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [chatId, user?.id]);

  // Separate effect: when messages change, mark unread messages as read only once
  useEffect(() => {
    const unreadMessageIds = messages
      .filter(msg => msg.sender?.clerkId !== user?.id && !msg.readBy?.includes(user?.id) && !markedReadRef.current.has(msg._id))
      .map(msg => msg._id);

    if (unreadMessageIds.length > 0) {
      // mark them as read and remember we've marked them
      socketService.markMessagesAsRead(chatId, user?.id, unreadMessageIds);
      unreadMessageIds.forEach(id => markedReadRef.current.add(id));
    }
  }, [messages, chatId, user?.id]);

  // Check online status when chatInfo loads
  useEffect(() => {
    if (chatInfo?.otherUser?.clerkId) {
      const isOnline = onlineUsersRef.current.has(chatInfo.otherUser.clerkId);
      if (__DEV__) console.log(`📊 Checking online status for ${chatInfo.otherUser.clerkId}: ${isOnline}`);
      setIsOtherUserOnline(isOnline);
    }
  }, [chatInfo]);

  const fetchChatInfo = async () => {
    try {
      const token = await getToken();
      const api = getAuthenticatedApi(token);
      const response = await api.getChats();
      const currentChat = response.chats?.find(c => c._id === chatId);
      if (currentChat) {
        setChatInfo(currentChat);
      }
    } catch (err) {
      console.error('Error fetching chat info:', err);
    }
  };

  const fetchMessages = async () => {
    try {
      const token = await getToken();
      const api = getAuthenticatedApi(token);
      const response = await api.getChatMessages(chatId);
      setMessages(response.messages || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!messageText.trim()) return;

    const textToSend = messageText.trim();
    const tempId = `temp_${Date.now()}`;
    setMessageText('');
    setSending(true);

    // Stop typing indicator
    socketService.stopTyping(chatId, user?.id);

    try {
      const token = await getToken();
      const api = getAuthenticatedApi(token);
      
      // Create optimistic message
      const optimisticMessage = {
        _id: tempId,
        chat: chatId,
        sender: {
          _id: user?.id,
          clerkId: user?.id,
          name: user?.fullName,
          email: user?.primaryEmailAddress?.emailAddress
        },
        content: textToSend,
        type: 'text',
        status: 'sending',
        createdAt: new Date().toISOString(),
        readBy: [user?.id]
      };

      // Add to UI immediately
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Send via socket
      socketService.sendMessage(chatId, user?.id, textToSend, {
        _id: user?.id,
        clerkId: user?.id,
        name: user?.fullName,
        email: user?.primaryEmailAddress?.emailAddress
      }, tempId);

      // Also save to database
      await api.sendMessage(chatId, textToSend);

      // Update message status to sent
      setMessages(prev => prev.map(msg => 
        msg._id === tempId ? { ...msg, status: 'sent' } : msg
      ));

    } catch (err) {
      console.error('Error sending message:', err);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setMessageText(textToSend);
      
      // Remove failed message
      setMessages(prev => prev.filter(msg => msg._id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleTextChange = (text) => {
    setMessageText(text);
    
    // Handle typing indicator
    if (text.trim() && !isTyping) {
      setIsTyping(true);
      socketService.startTyping(chatId, user?.id, user?.fullName || 'User');
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.stopTyping(chatId, user?.id);
    }, 1000);
  };

  const formatMessageTime = (date) => {
    const messageDate = new Date(date);
    const hours = messageDate.getHours();
    const minutes = messageDate.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender?.clerkId === user?.id;
    // Check if message is read by counting unique users in readBy array
    // Exclude the sender's own ID when counting
    const uniqueReadByUsers = Array.isArray(item.readBy) 
      ? [...new Set(item.readBy)].filter(id => id !== user?.id)
      : [];
    const isRead = uniqueReadByUsers.length > 0; // At least one other person has read it

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText
            ]}
          >
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isMyMessage ? styles.myMessageTime : styles.otherMessageTime
              ]}
            >
              {formatMessageTime(item.createdAt)}
            </Text>
            {isMyMessage && (
              <Text style={styles.readReceipt}>
                {isRead ? '✓✓' : '✓'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {chatInfo?.otherUser?.name || chatInfo?.otherUser?.email?.split('@')[0] || otherUserName || 'User'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isOtherUserOnline ? '🟢 Online' : 'Match Conversation'}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>Start the conversation!</Text>
                <Text style={styles.emptySubtext}>
                  Coordinate with the other person to return the item.
                </Text>
              </View>
            }
          />

          {otherUserTyping && (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>typing...</Text>
            </View>
          )}

          <View style={[styles.inputContainer, { paddingBottom: insets.bottom || 16 }]}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={messageText}
              onChangeText={handleTextChange}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!messageText.trim() || sending) && styles.sendButtonDisabled
              ]}
              onPress={handleSend}
              disabled={!messageText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#fff',
  },

  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  readReceipt: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 4,
    fontWeight: '600',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
  },
  typingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});
