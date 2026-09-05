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
import NetInfo from '@react-native-community/netinfo';
import { getAuthenticatedApi } from '../services/api';
import socketService from '../services/socket';
import { useI18n } from '../i18n/I18nProvider';
import { getApiToken } from '../lib/authToken';

let cachedMessagesMap = new Map();
let cachedChatInfoMap = new Map();
let cachedMessagesAt = new Map();

const withColdStartRetry = async (fn) => {
  try { return await fn(); } catch (e) {
    const msg = String(e?.message || '');
    const isCold = e?.code === 'ECONNABORTED' || msg.includes('timeout') || msg.includes('Network Error') || (e?.response?.status >= 500);
    if (isCold) { await new Promise(r => setTimeout(r, 2500)); return await fn(); }
    throw e;
  }
};

export default function ChatConversationScreen() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { chatId, otherUserName } = useLocalSearchParams();
  const { t } = useI18n();

  const [messages, setMessages] = useState(() => cachedMessagesMap.get(chatId) || []);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(!cachedMessagesMap.has(chatId));
  const [sending, setSending] = useState(false);
  const [chatInfo, setChatInfo] = useState(() => cachedChatInfoMap.get(chatId) || null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const [claimStatus, setClaimStatus] = useState(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [matchedItemId, setMatchedItemId] = useState(null);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const markedReadRef = useRef(new Set());
  const appState = useRef(AppState.currentState);
  const onlineUsersRef = useRef(new Set()); // Track online user IDs
  const otherUserClerkIdRef = useRef(null);
  const getTokenRef = useRef(getToken);
  const previousMessagesCountRef = useRef(0);

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
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    let mounted = true;

    const loadChatData = async (isBackground = false) => {
      const now = Date.now();
      const cachedAt = cachedMessagesAt.get(chatId) || 0;
      const hasFreshCache = cachedMessagesMap.has(chatId) && now - cachedAt < 30000;
      if (hasFreshCache && !isBackground) {
        // Instant from cache, no spinner, skip network
        setChatInfo(cachedChatInfoMap.get(chatId) || null);
        setMessages(cachedMessagesMap.get(chatId) || []);
        setLoading(false);
        const cachedClaim = cachedChatInfoMap.get(chatId)?.matchedItem ? null : null;
        // Still refresh claim status in background
        return;
      }
      if (!isBackground) {
        // Only show spinner if no cache
        if (!cachedMessagesMap.has(chatId)) setLoading(true);
      }
      try {
        const token = await getApiToken(getTokenRef.current);
        if (!token) {
          if (mounted && !cachedMessagesMap.has(chatId)) setLoading(false);
          return;
        }
        const api = getAuthenticatedApi(token, getTokenRef.current);
        // Single-chat fetch — no longer pulls the entire chats list (with 3
        // populates) just to open one conversation
        const [chatResponse, messagesResponse] = await Promise.all([
          withColdStartRetry(() => api.getChat(chatId)),
          withColdStartRetry(() => api.getChatMessages(chatId)),
        ]);

        if (!mounted) return;

        const currentChat = chatResponse.chat || cachedChatInfoMap.get(chatId) || null;
        if (currentChat) {
          cachedChatInfoMap.set(chatId, currentChat);
          setChatInfo(currentChat);
        }
        const msgs = messagesResponse.messages || [];
        cachedMessagesMap.set(chatId, msgs);
        cachedMessagesAt.set(chatId, Date.now());
        setMessages(msgs);

        // Fetch matchedItem claim status
        if (currentChat?.matchedItem) {
          setMatchedItemId(currentChat.matchedItem);
          api.getMatchedItem(currentChat.matchedItem)
            .then(res => {
              if (!mounted) return;
              const c = res?.matchedItem?.claim;
              setClaimStatus(c?.status ? c : { status: "NONE", requestedBy: null });
            })
            .catch(() => {});
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Error loading chat data:', err);
        // If we have cache, keep showing it
        if (!cachedMessagesMap.has(chatId)) {
          // No cache — will show empty/error (keep loading false to show empty state)
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadChatData(false);

    return () => {
      mounted = false;
    };
  }, [chatId]);

  useEffect(() => {
    // Connect to socket and join chat room
    const initSocket = async () => {
      try {
        const token = await getApiToken(getTokenRef.current);
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
        
        if (otherUserClerkIdRef.current === data.userId) {
          if (__DEV__) console.log('👤 Other participant came online:', data.userId);
          setIsOtherUserOnline(true);
        }
      }
    };

    const handleUserOffline = (data) => {
      if (data.chatId === chatId && data.userId !== user?.id) {
        if (__DEV__) console.log('🔴 User went offline:', data.userId);
        onlineUsersRef.current.delete(data.userId);
        
        if (otherUserClerkIdRef.current === data.userId) {
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

    const handleClaimUpdated = (data) => {
      if (String(data.matchedItemId) === String(matchedItemId)) {
        if (__DEV__) console.log('📦 Claim updated:', data);
        setClaimStatus(data.claim || { status: data.status, requestedBy: null });
      }
    };

    socketService.onMessageReceived(handleMessageReceived);
    socketService.onTypingUpdate(handleTypingUpdate);
    socketService.onUserOnline(handleUserOnline);
    socketService.onUserOffline(handleUserOffline);
    socketService.onMessagesReadUpdate(handleMessagesReadUpdate);
    socketService.onClaimUpdated(handleClaimUpdated);

    // Cleanup
    return () => {
      socketService.offMessageReceived(handleMessageReceived);
      socketService.offTypingUpdate(handleTypingUpdate);
      socketService.offUserOnline(handleUserOnline);
      socketService.offUserOffline(handleUserOffline);
      socketService.offMessagesReadUpdate(handleMessagesReadUpdate);
      socketService.offClaimUpdated(handleClaimUpdated);
      socketService.leaveChat(chatId, user?.id);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [chatId, user?.id, matchedItemId]);

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

  // Auto-scroll only when message count grows (new messages).
  useEffect(() => {
    if (!messages.length) return;

    if (previousMessagesCountRef.current === 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 0);
    } else if (messages.length > previousMessagesCountRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 0);
    }

    previousMessagesCountRef.current = messages.length;
  }, [messages.length]);

  // Keep cache in sync for instant reopen
  useEffect(() => {
    if (chatId && messages.length) {
      cachedMessagesMap.set(chatId, messages);
      cachedMessagesAt.set(chatId, Date.now());
    }
  }, [messages, chatId]);

  // Check online status when chatInfo loads
  useEffect(() => {
    const clerkId = chatInfo?.otherUser?.clerkId || null;
    otherUserClerkIdRef.current = clerkId;

    if (clerkId) {
      const isOnline = onlineUsersRef.current.has(clerkId);
      if (__DEV__) console.log(`📊 Checking online status for ${clerkId}: ${isOnline}`);
      setIsOtherUserOnline(isOnline);
    }
  }, [chatInfo]);

  const handleSend = async () => {
    if (!messageText.trim()) return;
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      Alert.alert(t('common.error'), 'You are offline. Please check your internet connection.');
      return;
    }

    const textToSend = messageText.trim();
    const tempId = `temp_${Date.now()}`;
    setMessageText('');
    setSending(true);

    // Stop typing indicator
    socketService.stopTyping(chatId, user?.id);

    try {
      const token = await getToken({ skipCache: true });
      const api = getAuthenticatedApi(token, getToken);
      
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
      Alert.alert(t('common.error'), t('chat.sendError'));
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
      socketService.startTyping(chatId, user?.id, user?.fullName || t('chat.user'));
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
            {chatInfo?.otherUser?.name || chatInfo?.otherUser?.email?.split('@')[0] || otherUserName || t('chat.user')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isOtherUserOnline ? `🟢 ${t('chat.online')}` : t('chat.matchConversation')}
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
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 56}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.messagesList}
            initialNumToRender={15}
            windowSize={7}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyText}>{t('chat.startConversation')}</Text>
                <Text style={styles.emptySubtext}>
                  {t('chat.coordinateReturn')}
                </Text>
              </View>
            }
          />

          {claimStatus?.status && claimStatus.status !== "NONE" && (
            <View style={[styles.claimBanner, claimStatus.status === "CONFIRMED" && styles.claimBannerDone]}>
              {claimStatus.status === "REQUESTED" && (
                <>
                  <Ionicons name="return-up-forward" size={20} color="#2563EB" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.claimBannerTitle}>{t('chat.returnRequested')}</Text>
                    <Text style={styles.claimBannerSub}>
                      {String(claimStatus.requestedBy) === user?.id
                        ? t('chat.waitingConfirm')
                        : t('chat.confirmReturn')}
                    </Text>
                  </View>
                  {String(claimStatus.requestedBy) !== user?.id && (
                    <TouchableOpacity
                      style={styles.claimConfirmBtn}
                      onPress={async () => {
                        setClaimLoading(true);
                        try {
                          const token = await getToken({ skipCache: true });
                          const api = getAuthenticatedApi(token, getToken);
                          const res = await api.confirmClaim(matchedItemId, chatId);
                          if (res?.matchedItem?.claim) setClaimStatus(res.matchedItem.claim);
                        } catch (err) {
                          Alert.alert(t('common.error'), err.response?.data?.message || 'Failed to confirm');
                        } finally {
                          setClaimLoading(false);
                        }
                      }}
                      disabled={claimLoading}
                    >
                      <Text style={styles.claimConfirmText}>{claimLoading ? '...' : t('chat.confirm')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.claimCancelBtn}
                    onPress={async () => {
                      setClaimLoading(true);
                      try {
                        const token = await getToken({ skipCache: true });
                        const api = getAuthenticatedApi(token, getToken);
                        const res = await api.cancelClaim(matchedItemId, chatId);
                        if (res?.matchedItem?.claim) setClaimStatus(res.matchedItem.claim);
                      } catch (err) {
                        Alert.alert(t('common.error'), err.response?.data?.message || 'Failed to cancel');
                      } finally {
                        setClaimLoading(false);
                      }
                    }}
                    disabled={claimLoading}
                  >
                    <Ionicons name="close" size={18} color="#64748B" />
                  </TouchableOpacity>
                </>
              )}
              {claimStatus.status === "CONFIRMED" && (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#16A34A" style={{ marginRight: 8 }} />
                  <Text style={[styles.claimBannerTitle, { color: '#16A34A' }]}>{t('chat.itemReturned')}</Text>
                </>
              )}
            </View>
          )}

          {otherUserTyping && (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>{t('chat.typing')}</Text>
            </View>
          )}

          {claimStatus?.status === "NONE" && matchedItemId && (
            <TouchableOpacity
              style={styles.claimRequestBar}
              onPress={async () => {
                setClaimLoading(true);
                try {
                  const token = await getToken({ skipCache: true });
                  const api = getAuthenticatedApi(token, getToken);
                  const res = await api.requestClaim(matchedItemId, chatId);
                  if (res?.matchedItem?.claim) setClaimStatus(res.matchedItem.claim);
                } catch (err) {
                  Alert.alert(t('common.error'), err.response?.data?.message || 'Failed to request');
                } finally {
                  setClaimLoading(false);
                }
              }}
              disabled={claimLoading}
            >
              <Ionicons name="return-up-forward" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.claimRequestText}>
                {claimLoading ? '...' : t('chat.markReturned')}
              </Text>
            </TouchableOpacity>
          )}

          <View style={[styles.inputContainer, { paddingBottom: insets.bottom || 16 }]}>
            <TextInput
              style={styles.input}
              placeholder={t('chat.placeholderTypeMessage')}
              value={messageText}
              onChangeText={handleTextChange}
              multiline
              maxLength={2000}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                !messageText.trim() && styles.sendButtonDisabled
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
    maxWidth: '92%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    overflow: 'hidden',
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
  claimBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderTopWidth: 1,
    borderTopColor: '#BFDBFE',
  },
  claimBannerDone: {
    backgroundColor: '#F0FDF4',
    borderTopColor: '#BBF7D0',
  },
  claimBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  claimBannerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  claimConfirmBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginLeft: 8,
  },
  claimConfirmText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  claimCancelBtn: {
    padding: 6,
    marginLeft: 4,
  },
  claimRequestBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: 12,
    marginBottom: 4,
    backgroundColor: '#2563EB',
    borderRadius: 10,
  },
  claimRequestText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
