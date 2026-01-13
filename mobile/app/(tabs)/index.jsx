import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Modal, Pressable, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomNavBar } from "../../components/BottomNavBar";
import { getAuthenticatedApi } from "../../services/api";
import RecentItemsList from "../../components/RecentItemsList";

// Module-level cache to persist items and notifications across mounts
let cachedItems = null;
let cachedNotifications = null;
let cachedUnreadCount = 0;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  welcomeContainer: {
    marginLeft: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
  },
  usernameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButtonHeader: {
    padding: 8,
    borderRadius: 10,
  },
  redDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  /* Modal styles (reused) */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    padding: 16,
  },

  /* Notifications empty state */
  notificationsEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 8,
  },
  notificationsEmptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  notificationsEmptySubtitle: {
    marginTop: 6,
    color: '#64748B',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickAction: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  activityPlaceholder: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  placeholderText: {
    marginTop: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default function Page() {
  const { user } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { getToken } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    setLoading(true);
    setError(null);

    try {
      const token = await getToken().catch(err => {
        console.error('getToken failed:', err);
        return null;
      });
      const api = getAuthenticatedApi(token);
      if (__DEV__) console.log('Token present:', !!token);

      // Fetch items always; fetch notifications only when we have a token
      const itemsPromise = api.getItems();
      const notificationsPromise = token ? api.getNotifications() : Promise.resolve({ notifications: [], unreadCount: 0 });

      const [itemsData, notificationsData] = await Promise.all([itemsPromise, notificationsPromise]);

      setItems(itemsData?.items ?? []);
      cachedItems = itemsData?.items ?? [];
      setNotifications(notificationsData?.notifications ?? []);
      setUnreadCount(notificationsData?.unreadCount ?? 0);
      cachedNotifications = notificationsData?.notifications ?? [];
      cachedUnreadCount = notificationsData?.unreadCount || 0;
      if (__DEV__) console.log(`Refreshed: ${itemsData?.items?.length || 0} items, ${notificationsData?.unreadCount || 0} unread`);
    } catch (err) {
      console.error('Error fetching data:', err?.response?.status, err?.response?.data || err?.message);
      setError("Could not load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch: load items once on mount and use cache across remounts
  useEffect(() => {
    let mounted = true;
    const fetchInitialItems = async () => {
      setLoading(true);
      setError(null);

      if (cachedItems && cachedNotifications) {
        setItems(cachedItems);
        setNotifications(cachedNotifications);
        setUnreadCount(cachedUnreadCount || 0);
        setLoading(false);
        if (__DEV__) console.log(`Using cached items (${cachedItems.length}) and ${cachedNotifications.length} notifications`);
        return;
      }

      try {
        const token = await getToken().catch(err => {
          console.error('getToken failed:', err);
          return null;
        });
        const api = getAuthenticatedApi(token);
        if (__DEV__) console.log('Token present:', !!token);

        const itemsPromise = api.getItems();
        const notificationsPromise = token ? api.getNotifications() : Promise.resolve({ notifications: [], unreadCount: 0 });

        const [itemsData, notificationsData] = await Promise.all([itemsPromise, notificationsPromise]);
        if (!mounted) return;
        setItems(itemsData?.items ?? []);
        cachedItems = itemsData?.items ?? [];
        setNotifications(notificationsData?.notifications ?? []);
        setUnreadCount(notificationsData?.unreadCount || 0);
        cachedNotifications = notificationsData?.notifications ?? [];
        cachedUnreadCount = notificationsData?.unreadCount || 0;
        if (__DEV__) console.log(`Initial fetch: ${itemsData?.items?.length || 0} items, ${notificationsData?.unreadCount || 0} unread`);
      } catch (err) {
        if (!mounted) return;
        console.error('Error during initial fetch:', err?.response?.status, err?.response?.data || err?.message);
        setError("Could not load items and notifications");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchInitialItems();

    return () => { mounted = false; };
  }, [getToken]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={[styles.headerLogo, {resizeMode: 'contain'}]}
          />
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Welcome,</Text>
            <Text style={styles.usernameText}>
              {user?.emailAddresses[0]?.emailAddress.split("@")[0]}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButtonHeader}
            onPress={() => setNotificationModalVisible(true)}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={24} color="#333" />
            {unreadCount > 0 && (
              <View style={styles.redDot} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Report Lost or Found Items</Text>
            <Text style={styles.sectionSubtitle}>
              Help others find their lost items or report items you&apos;ve found.
            </Text>
            
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={[styles.quickAction, { backgroundColor: '#E3F2FD' }]}
                onPress={() => router.push('/(modals)/report-lost')}
              >
                <Ionicons name="search" size={24} color="#1976D2" />
                <Text style={[styles.quickActionText, { color: '#1976D2' }]}>I Lost Something</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.quickAction, { backgroundColor: '#E8F5E9' }]}
                onPress={() => router.push('/(modals)/report-found')}
              >
                <Ionicons name="eye" size={24} color="#2E7D32" />
                <Text style={[styles.quickActionText, { color: '#2E7D32' }]}>I Found Something</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.section, { flex: 1 }]}> 
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <TouchableOpacity 
                onPress={handleRefresh}
                disabled={refreshing}
                style={{ padding: 8 }}
              >
                <Ionicons 
                  name="refresh" 
                  size={24} 
                  color={refreshing ? "#999" : "#4A90E2"} 
                />
              </TouchableOpacity>
            </View>
            {loading ? (
              <ActivityIndicator size="large" color="#2563EB" />
            ) : error ? (
              <Text style={{ color: "red" }}>{error}</Text>
            ) : null}

            <View style={{ flex: 1 }}>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
                <RecentItemsList items={items} onDelete={(id) => setItems(prev => prev.filter(i => i._id !== id))} />
              </ScrollView>
            </View>
          </View>

          {/* Notification modal */}
          <Modal visible={notificationModalVisible} transparent animationType="fade" onRequestClose={() => setNotificationModalVisible(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setNotificationModalVisible(false)}>
              <Pressable style={[styles.modalContent, { width: '90%', maxHeight: '70%' }]} onPress={() => {}}>
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Notifications</Text>

                {(!notifications || notifications.length === 0) ? (
                  <View style={styles.notificationsEmpty}>
                    <Ionicons name="notifications-off" size={48} color="#CBD5E1" />
                    <Text style={styles.notificationsEmptyTitle}>No notifications</Text>
                    <Text style={styles.notificationsEmptySubtitle}>You are all caught up.</Text>
                  </View>
                ) : (
                  <ScrollView>
                    {notifications.map((n, idx) => (
                      <View key={idx} style={{ paddingVertical: 12, borderBottomWidth: idx === notifications.length - 1 ? 0 : 1, borderColor: '#E6EEF8' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '600', fontSize: 15 }}>{n.title}</Text>
                            <Text style={{ color: '#64748B', marginTop: 4, fontSize: 14 }}>{n.body}</Text>
                          </View>
                          {n.meta?.matchedItemId && n.meta?.sourceItemId && (
                            <TouchableOpacity
                              style={{
                                marginLeft: 8,
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                backgroundColor: '#2563EB',
                                borderRadius: 6
                              }}
                              onPress={async () => {
                                setNotificationModalVisible(false);
                                try {
                                  const token = await getToken();
                                  const api = getAuthenticatedApi(token);
                                  
                                  // Get the matched item document using the two item IDs
                                  const matchedItemResponse = await api.getMatchedItemByItems(
                                    n.meta.sourceItemId,
                                    n.meta.matchedItemId
                                  );
                                  
                                  // Get or create chat for this match
                                  const chatResponse = await api.getOrCreateChatForMatch(
                                    matchedItemResponse.matchedItem._id
                                  );
                                  
                                  // Navigate to the chat conversation
                                  const otherUser = chatResponse.chat.participants.find(
                                    p => p.clerkId !== user.id
                                  );
                                  
                                  router.push({
                                    pathname: '/chat-conversation',
                                    params: {
                                      chatId: chatResponse.chat._id,
                                      otherUserName: otherUser?.name || otherUser?.email?.split('@')[0] || 'User'
                                    }
                                  });
                                } catch (err) {
                                  console.error('Error opening chat:', err);
                                  alert('Failed to open chat. Please try again.');
                                }
                              }}
                            >
                              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Chat</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <TouchableOpacity onPress={() => setNotificationModalVisible(false)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <Text style={{ color: '#0F172A', fontWeight: '600' }}>Close</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
      </View>

      {/* Bottom Navigation */}
      <BottomNavBar activeTab="home" />
    </View>
  );
}
