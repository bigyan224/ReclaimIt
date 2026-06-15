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
import { Audio } from 'expo-av';
import { COLORS } from '../constants/colors';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getAuthenticatedApi } from '../services/api';
import socketService from '../services/socket';
import { useI18n } from '../i18n/I18nProvider';

export default function ChatConversationScreen() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { chatId, otherUserName } = useLocalSearchParams();
  const { t, language } = useI18n();

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatInfo, setChatInfo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [pendingVoice, setPendingVoice] = useState(null);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [translatedMessages, setTranslatedMessages] = useState({});
  const [showTranslatedMessages, setShowTranslatedMessages] = useState({});
  const [translationLoading, setTranslationLoading] = useState({});
  const [voiceTranscripts, setVoiceTranscripts] = useState({});
  const [showVoiceTranscript, setShowVoiceTranscript] = useState({});
  const [transcriptionLoading, setTranscriptionLoading] = useState({});
  const [claimStatus, setClaimStatus] = useState(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [matchedItemId, setMatchedItemId] = useState(null);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const markedReadRef = useRef(new Set());
  const appState = useRef(AppState.currentState);
  const onlineUsersRef = useRef(new Set()); // Track online user IDs
  const recordingIntervalRef = useRef(null);
  const soundRef = useRef(null);
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

    const loadChatData = async () => {
      try {
        const token = await getTokenRef.current({ skipCache: true });
        const api = getAuthenticatedApi(token, getTokenRef.current);
        const [chatsResponse, messagesResponse] = await Promise.all([
          api.getChats(),
          api.getChatMessages(chatId),
        ]);

        if (!mounted) return;

        const currentChat = chatsResponse.chats?.find((c) => c._id === chatId) || null;
        setChatInfo(currentChat);
        setMessages(messagesResponse.messages || []);

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
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadChatData();

    return () => {
      mounted = false;
    };
  }, [chatId]);

  useEffect(() => {
    // Connect to socket and join chat room
    const initSocket = async () => {
      try {
        const token = await getTokenRef.current();
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

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
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

  // Auto-scroll only when message count grows (new messages), not when existing messages are expanded/translated.
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
    if (isRecording) return;

    if (!messageText.trim() && pendingVoice?.uri) {
      await sendVoiceRecording(pendingVoice.uri, pendingVoice.durationMs || 0);
      setPendingVoice(null);
      return;
    }

    if (!messageText.trim()) return;

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

  const formatDuration = (durationMs) => {
    const totalSeconds = Math.floor((durationMs || 0) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
  };

  const startRecording = async () => {
    try {
      const permissionResponse = await Audio.requestPermissionsAsync();
      if (!permissionResponse.granted) {
        Alert.alert(t('chat.microphoneNeeded'), t('chat.microphonePermissionMsg'));
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: nextRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      // Starting a new recording replaces any unsent draft voice note.
      setPendingVoice(null);

      setRecording(nextRecording);
      setIsRecording(true);
      setRecordingDurationMs(0);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      recordingIntervalRef.current = setInterval(async () => {
        try {
          const status = await nextRecording.getStatusAsync();
          if (status?.isRecording) {
            setRecordingDurationMs(status.durationMillis || 0);
          }
        } catch {
          // noop
        }
      }, 300);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert(t('common.error'), t('chat.recordingStartError'));
      setRecording(null);
      setIsRecording(false);
    }
  };

  const sendVoiceRecording = async (audioUri, durationMs = 0) => {
    if (!audioUri) return;

    setSendingVoice(true);

    try {
      const token = await getToken({ skipCache: true });
      const api = getAuthenticatedApi(token, getToken);
      const response = await api.sendVoiceMessage(chatId, audioUri, durationMs);
      const createdMessage = response?.message;

      if (createdMessage?._id) {
        setMessages(prev => {
          const alreadyInList = prev.some(msg => msg._id === createdMessage._id);
          if (alreadyInList) return prev;
          return [...prev, createdMessage];
        });

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error sending voice message:', error);
      Alert.alert(t('common.error'), t('chat.voiceSendError'));
    } finally {
      setSendingVoice(false);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const audioUri = recording.getURI();

      setRecording(null);
      setIsRecording(false);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (!audioUri) {
        Alert.alert(t('common.error'), t('chat.voiceNotFound'));
        return;
      }

      const finalDurationMs = status?.durationMillis || recordingDurationMs || 0;

      if (finalDurationMs < 600) {
        setRecordingDurationMs(0);
        setPendingVoice(null);
        return;
      }

      setPendingVoice({
        uri: audioUri,
        durationMs: finalDurationMs,
      });
      setRecordingDurationMs(0);
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert(t('common.error'), t('chat.recordingStartError'));
      setRecording(null);
      setIsRecording(false);
    }
  };

  const discardPendingVoice = () => {
    setPendingVoice(null);
    if (playingMessageId === 'draft_voice') {
      setPlayingMessageId(null);
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    }
  };

  const playVoiceMessage = async (audioUrl, messageId) => {
    if (!audioUrl) return;

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      if (playingMessageId === messageId) {
        setPlayingMessageId(null);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      setPlayingMessageId(messageId);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status?.didJustFinish) {
          setPlayingMessageId(null);
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.error('Error playing voice message:', error);
      Alert.alert(t('common.error'), t('chat.voiceSendError'));
      setPlayingMessageId(null);
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

  const getTargetTranslateLanguage = () => (language === 'hi' ? 'hi' : 'en');

  const handleTranslateTextMessage = async (item) => {
    const messageId = item._id;

    if (showTranslatedMessages[messageId]) {
      setShowTranslatedMessages((prev) => ({ ...prev, [messageId]: false }));
      return;
    }

    if (translatedMessages[messageId]) {
      setShowTranslatedMessages((prev) => ({ ...prev, [messageId]: true }));
      return;
    }

    setTranslationLoading((prev) => ({ ...prev, [messageId]: true }));
    try {
      const token = await getToken({ skipCache: true });
      const api = getAuthenticatedApi(token, getToken);
      const targetLanguage = getTargetTranslateLanguage();
      const response = await api.translateTextMessage(chatId, messageId, targetLanguage);

      const translatedText = response?.translatedText || item.content;
      setTranslatedMessages((prev) => ({ ...prev, [messageId]: translatedText }));
      setShowTranslatedMessages((prev) => ({ ...prev, [messageId]: true }));
    } catch (error) {
      console.error('Error translating message:', error);
      Alert.alert(t('common.error'), t('chat.translateError'));
    } finally {
      setTranslationLoading((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  const handleTranscribeVoiceMessageEnglish = async (item) => {
    const messageId = item._id;

    if (showVoiceTranscript[messageId]) {
      setShowVoiceTranscript((prev) => ({ ...prev, [messageId]: false }));
      return;
    }

    if (voiceTranscripts[messageId]) {
      setShowVoiceTranscript((prev) => ({ ...prev, [messageId]: true }));
      return;
    }

    if (item.transcriptLanguage === 'en' && item.transcriptText) {
      setVoiceTranscripts((prev) => ({ ...prev, [messageId]: item.transcriptText }));
      setShowVoiceTranscript((prev) => ({ ...prev, [messageId]: true }));
      return;
    }

    setTranscriptionLoading((prev) => ({ ...prev, [messageId]: true }));
    try {
      const token = await getToken({ skipCache: true });
      const api = getAuthenticatedApi(token, getToken);
      const response = await api.transcribeVoiceMessageEnglish(chatId, messageId);

      const transcriptText = response?.transcriptText || '';
      if (!transcriptText) {
        Alert.alert(t('common.error'), t('chat.transcribeUnavailable'));
        return;
      }

      setVoiceTranscripts((prev) => ({ ...prev, [messageId]: transcriptText }));
      setShowVoiceTranscript((prev) => ({ ...prev, [messageId]: true }));
    } catch (error) {
      console.error('Error transcribing voice message:', error);
      Alert.alert(t('common.error'), t('chat.transcribeError'));
    } finally {
      setTranscriptionLoading((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender?.clerkId === user?.id;
    // Check if message is read by counting unique users in readBy array
    // Exclude the sender's own ID when counting
    const uniqueReadByUsers = Array.isArray(item.readBy) 
      ? [...new Set(item.readBy)].filter(id => id !== user?.id)
      : [];
    const isRead = uniqueReadByUsers.length > 0; // At least one other person has read it

    const isVoiceMessage = item.type === 'voice';
    const translatedText = translatedMessages[item._id];
    const isTranslationLoading = Boolean(translationLoading[item._id]);
    const shouldShowTranslation = Boolean(showTranslatedMessages[item._id] && translatedText);
    const transcriptText = voiceTranscripts[item._id] || (item.transcriptLanguage === 'en' ? item.transcriptText : '');
    const isTranscriptionLoading = Boolean(transcriptionLoading[item._id]);
    const shouldShowTranscript = Boolean(showVoiceTranscript[item._id] && transcriptText);

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
          {!isVoiceMessage && (
            <>
              <Text
                style={[
                  styles.messageText,
                  isMyMessage ? styles.myMessageText : styles.otherMessageText
                ]}
              >
                {item.content}
              </Text>

              <View style={styles.messageActionsRow}>
                <TouchableOpacity
                  style={[styles.messageActionButton, isMyMessage && styles.myMessageActionButton]}
                  onPress={() => handleTranslateTextMessage(item)}
                  disabled={isTranslationLoading}
                >
                  {isTranslationLoading ? (
                    <ActivityIndicator size="small" color={isMyMessage ? '#fff' : '#334155'} />
                  ) : (
                    <Text style={[styles.messageActionText, isMyMessage && styles.myMessageActionText]}>
                      {shouldShowTranslation ? t('chat.hideTranslation') : t('chat.translateButton')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {shouldShowTranslation && (
                <Text style={isMyMessage ? styles.translatedTextMine : styles.translatedTextOther}>
                  {translatedText}
                </Text>
              )}
            </>
          )}

          {isVoiceMessage && (
            <View style={styles.voiceMessageWrapper}>
              <View style={styles.voiceHeaderRow}>
                <TouchableOpacity
                  style={styles.voicePlayButton}
                  onPress={() => playVoiceMessage(item.audioUrl, item._id)}
                >
                  <Ionicons
                    name={playingMessageId === item._id ? 'pause' : 'play'}
                    size={16}
                    color="#fff"
                  />
                </TouchableOpacity>
                <Text style={[styles.voiceLabel, isMyMessage ? styles.voiceLabelMine : styles.voiceLabelOther]}>
                  {t('chat.voiceMessageLabel')} • {formatDuration((item.audioDurationSec || 0) * 1000)}
                </Text>
              </View>

              <View style={styles.messageActionsRow}>
                <TouchableOpacity
                  style={[styles.messageActionButton, isMyMessage && styles.myMessageActionButton]}
                  onPress={() => handleTranscribeVoiceMessageEnglish(item)}
                  disabled={isTranscriptionLoading}
                >
                  {isTranscriptionLoading ? (
                    <ActivityIndicator size="small" color={isMyMessage ? '#fff' : '#334155'} />
                  ) : (
                    <Text style={[styles.messageActionText, isMyMessage && styles.myMessageActionText]}>
                      {shouldShowTranscript ? t('chat.hideTranscript') : t('chat.transcribeEnglishButton')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {shouldShowTranscript && (
                <Text style={isMyMessage ? styles.voiceTranscriptMine : styles.voiceTranscriptOther}>
                  {transcriptText}
                </Text>
              )}
            </View>
          )}

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

          {!!pendingVoice?.uri && (
            <View style={styles.pendingVoiceContainer}>
              <TouchableOpacity
                style={styles.pendingVoicePlayButton}
                onPress={() => playVoiceMessage(pendingVoice.uri, 'draft_voice')}
              >
                <Ionicons
                  name={playingMessageId === 'draft_voice' ? 'pause' : 'play'}
                  size={16}
                  color="#fff"
                />
              </TouchableOpacity>
              <Text style={styles.pendingVoiceText}>
                {t('chat.voiceNoteReady')} • {formatDuration(pendingVoice.durationMs)}
              </Text>
              <TouchableOpacity onPress={discardPendingVoice} style={styles.pendingVoiceDeleteButton}>
                <Ionicons name="trash-outline" size={18} color="#b91c1c" />
              </TouchableOpacity>
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
            <TouchableOpacity
              style={[
                styles.micButton,
                isRecording && styles.micButtonActive,
                sendingVoice && styles.micButtonDisabled
              ]}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={sendingVoice}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={20}
                color="#fff"
              />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder={pendingVoice?.uri ? t('chat.placeholderWithVoice') : t('chat.placeholderTypeMessage')}
              value={messageText}
              onChangeText={handleTextChange}
              multiline
              maxLength={2000}
              editable={!isRecording && !sendingVoice}
            />

            {isRecording && (
              <View style={styles.recordingBadge}>
                <Text style={styles.recordingText}>{t('chat.recording')} {formatDuration(recordingDurationMs)}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.sendButton,
                ((!messageText.trim() && !pendingVoice?.uri) || sending || isRecording || sendingVoice) && styles.sendButtonDisabled
              ]}
              onPress={handleSend}
              disabled={(!messageText.trim() && !pendingVoice?.uri) || sending || isRecording || sendingVoice}
            >
              {sending || sendingVoice ? (
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

  messageActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  messageActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    alignSelf: 'flex-start',
  },
  myMessageActionButton: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  messageActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  myMessageActionText: {
    color: '#fff',
  },
  translatedTextMine: {
    color: '#F8FAFC',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
    opacity: 0.95,
  },
  translatedTextOther: {
    color: '#0F172A',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
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
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  micButtonActive: {
    backgroundColor: '#dc2626',
  },
  micButtonDisabled: {
    opacity: 0.6,
  },
  recordingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    marginRight: 8,
  },
  recordingText: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '600',
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
  pendingVoiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#eef2ff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pendingVoicePlayButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pendingVoiceText: {
    flex: 1,
    color: '#1e3a8a',
    fontSize: 13,
    fontWeight: '600',
  },
  pendingVoiceDeleteButton: {
    marginLeft: 10,
    padding: 4,
  },
  voiceMessageWrapper: {
    width: '100%',
    alignItems: 'stretch',
    marginTop: 2,
  },
  voiceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voicePlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  voiceLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 0,
    marginRight: 4,
    flexShrink: 1,
  },
  voiceLabelMine: {
    color: '#fff',
  },
  voiceLabelOther: {
    color: '#0f172a',
  },
  voiceTranscriptMine: {
    color: '#f8fafc',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
    width: '100%',
    flexShrink: 1,
  },
  voiceTranscriptOther: {
    color: '#0f172a',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
    width: '100%',
    flexShrink: 1,
  },
});
