import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Modal, Pressable, ActivityIndicator, Animated, Easing } from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomNavBar } from "../../components/BottomNavBar";
import { getAuthenticatedApi } from "../../services/api";
import RecentItemsList from "../../components/RecentItemsList";
import { useI18n } from "../../i18n/I18nProvider";
import * as Location from "expo-location";

let cachedItems = null;
let cachedNotifications = null;
let cachedUnreadCount = 0;
let cachedInstitutions = null;
let cachedInstitutionItems = null;
let cachedNearbyItems = null;
let hasFetchedHomeDataOnce = false;
let homeDataFetchPromise = null;
let cachedHomeErrorKey = null;
let cachedHomeUserId = null;

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
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: 'rgba(241, 245, 249, 0.92)',
    borderRadius: 999,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  tabActiveSlider: {
    opacity: 1,
  },
  tabIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: '#DCE7F5',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#4A90E2',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});

export default function Page() {
  const { user } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const { isLoaded, isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("my");
  const tabLayouts = useRef({ my: null, institution: null, public: null });
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [institutions, setInstitutions] = useState([]);
  const [institutionItems, setInstitutionItems] = useState([]);
  const [nearbyItems, setNearbyItems] = useState([]);
  const [location, setLocation] = useState(null);

  const getFilteredItems = () => {
    if (!items) return [];
    const sorted = [...items].sort((a, b) => {
      const dateA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
      const dateB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
      return dateB - dateA;
    });
    if (activeTab === "my") {
      return sorted.filter(item => {
        const itemUserClerkId = typeof item.user === 'object' ? item.user?.clerkId : item.user;
        return itemUserClerkId === user?.id;
      });
    }
    return [];
  };

  const animateTabIndicator = useCallback((tabKey) => {
    const layout = tabLayouts.current[tabKey];
    if (!layout) return;
    Animated.parallel([
      Animated.timing(indicatorX, {
        toValue: layout.x,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(indicatorWidth, {
        toValue: layout.width,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [indicatorWidth, indicatorX]);

  useEffect(() => {
    animateTabIndicator(activeTab);
  }, [activeTab, animateTabIndicator]);

  const applyCachedHomeData = useCallback(() => {
    setItems(cachedItems ?? []);
    setNotifications(cachedNotifications ?? []);
    setUnreadCount(cachedUnreadCount || 0);
    setInstitutions(cachedInstitutions ?? []);
    setInstitutionItems(cachedInstitutionItems ?? []);
    setNearbyItems(cachedNearbyItems ?? []);
    setError(cachedHomeErrorKey ? t(cachedHomeErrorKey) : null);
  }, [t]);

  const fetchNearbyItems = async (api, lat, lng) => {
    try {
      const data = await api.getItems({ type: 'LOST', near: `${lat},${lng}`, radius: '50' });
      const items = data?.items ?? [];
      cachedNearbyItems = items;
      setNearbyItems(items);
    } catch (err) {
      console.error('Error fetching nearby items:', err);
    }
  };

  const fetchInstitutionItems = async (api, instList) => {
    if (!instList || instList.length === 0) return [];
    try {
      const promises = instList.map(inst =>
        api.getItems({ institution: inst._id }).then(res => res?.items ?? [])
      );
      const results = await Promise.all(promises);
      const allItems = results.flat();
      cachedInstitutionItems = allItems;
      setInstitutionItems(allItems);
    } catch (err) {
      console.error('Error fetching institution items:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setLoading(true);
    setError(null);
    try {
      const token = await getTokenRef.current({ skipCache: true }).catch(err => {
        console.error('getToken failed:', err);
        return null;
      });
      const api = getAuthenticatedApi(token, getTokenRef.current);

      const itemsPromise = api.getItems();
      const notificationsPromise = token ? api.getNotifications() : Promise.resolve({ notifications: [], unreadCount: 0 });
      const institutionsPromise = api.getMyInstitutions();

      const [itemsData, notificationsData, instData] = await Promise.all([itemsPromise, notificationsPromise, institutionsPromise]);

      setItems(itemsData?.items ?? []);
      cachedItems = itemsData?.items ?? [];
      setNotifications(notificationsData?.notifications ?? []);
      setUnreadCount(notificationsData?.unreadCount ?? 0);
      cachedNotifications = notificationsData?.notifications ?? [];
      cachedUnreadCount = notificationsData?.unreadCount || 0;

      const instList = instData?.institutions ?? [];
      setInstitutions(instList);
      cachedInstitutions = instList;

      api.getItems({ type: 'LOST', near: `${37.7749},${-122.4194}`, radius: '50' }).then(res => {
        const nearby = res?.items ?? [];
        cachedNearbyItems = nearby;
        setNearbyItems(nearby);
      }).catch(() => {});

      fetchInstitutionItems(api, instList);

      cachedHomeErrorKey = null;
      hasFetchedHomeDataOnce = true;
    } catch (err) {
      console.error('Error fetching data:', err?.response?.status, err?.response?.data || err?.message);
      cachedHomeErrorKey = 'home.loadErrorShort';
      setError(t('home.loadErrorShort'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const hydrateOnce = async () => {
      setLoading(true);

      if (cachedHomeUserId && cachedHomeUserId !== user?.id) {
        cachedItems = null;
        cachedNotifications = null;
        cachedUnreadCount = 0;
        cachedInstitutions = null;
        cachedInstitutionItems = null;
        cachedNearbyItems = null;
        hasFetchedHomeDataOnce = false;
        homeDataFetchPromise = null;
        cachedHomeErrorKey = null;
      }

      if (hasFetchedHomeDataOnce) {
        if (mounted) {
          applyCachedHomeData();
          setLoading(false);
        }
        return;
      }

      if (!homeDataFetchPromise) {
        homeDataFetchPromise = (async () => {
          try {
            const token = await getTokenRef.current({ skipCache: true }).catch(err => {
              console.error('getToken failed:', err);
              return null;
            });
            const api = getAuthenticatedApi(token, getTokenRef.current);

            const itemsPromise = api.getItems();
            const notificationsPromise = token ? api.getNotifications() : Promise.resolve({ notifications: [], unreadCount: 0 });
            const institutionsPromise = api.getMyInstitutions();

            const [itemsData, notificationsData, instData] = await Promise.all([itemsPromise, notificationsPromise, institutionsPromise]);

            cachedItems = itemsData?.items ?? [];
            cachedNotifications = notificationsData?.notifications ?? [];
            cachedUnreadCount = notificationsData?.unreadCount || 0;

            const instList = instData?.institutions ?? [];
            cachedInstitutions = instList;

            api.getItems({ type: 'LOST', near: `${37.7749},${-122.4194}`, radius: '50' }).then(res => {
              cachedNearbyItems = res?.items ?? [];
            }).catch(() => {});

            fetchInstitutionItems(api, instList);

            cachedHomeUserId = user?.id || null;
            cachedHomeErrorKey = null;
            hasFetchedHomeDataOnce = true;
          } catch (err) {
            console.error('Error during initial fetch:', err?.response?.status, err?.response?.data || err?.message);
            cachedItems = [];
            cachedNotifications = [];
            cachedUnreadCount = 0;
            cachedInstitutions = [];
            cachedInstitutionItems = [];
            cachedNearbyItems = [];
            cachedHomeErrorKey = 'home.loadError';
            hasFetchedHomeDataOnce = true;
          } finally {
            homeDataFetchPromise = null;
          }
        })();
      }

      await homeDataFetchPromise;

      if (mounted) {
        applyCachedHomeData();
        setLoading(false);
      }
    };

    hydrateOnce();

    return () => { mounted = false; };
  }, [applyCachedHomeData, t, user?.id]);

  useEffect(() => {
    if (activeTab !== 'public') return;
    if (location) return;

    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      setLocation({ latitude, longitude });
      try {
        const token = await getTokenRef.current({ skipCache: true });
        const api = getAuthenticatedApi(token, getTokenRef.current);
        const data = await api.getItems({ type: 'LOST', near: `${latitude},${longitude}`, radius: '50' });
        cachedNearbyItems = data?.items ?? [];
        setNearbyItems(cachedNearbyItems);
      } catch (err) {
        console.error('Error fetching nearby items:', err);
      }
    })();
  }, [activeTab, location, getTokenRef]);

  useEffect(() => {
    if (activeTab !== 'institution') return;
    if (!institutionItems.length && institutions.length) {
      (async () => {
        try {
          const token = await getTokenRef.current({ skipCache: true });
          const api = getAuthenticatedApi(token, getTokenRef.current);
          fetchInstitutionItems(api, institutions);
        } catch (err) {
          console.error('Error refetching institution items:', err);
        }
      })();
    }
  }, [activeTab, institutions, institutionItems.length, getTokenRef]);

  const renderTabContent = () => {
    if (loading) {
      return <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />;
    }
    if (error) {
      return <Text style={{ color: "red", textAlign: 'center', marginTop: 40 }}>{error}</Text>;
    }

    if (activeTab === "my") {
      return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} removeClippedSubviews showsVerticalScrollIndicator={false}>
          <RecentItemsList
            items={getFilteredItems()}
            onDelete={(id) => setItems(prev => prev.filter(i => i._id !== id))}
            showDeleteButton={true}
            currentUserId={user?.id}
          />
        </ScrollView>
      );
    }

    if (activeTab === "institution") {
      if (institutions.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Ionicons name="business" size={48} color="#CBD5E1" style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>{t('home.notMember')}</Text>
          </View>
        );
      }
      return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} removeClippedSubviews showsVerticalScrollIndicator={false}>
          <RecentItemsList
            items={institutionItems}
            onDelete={() => {}}
            showDeleteButton={false}
            currentUserId={user?.id}
          />
        </ScrollView>
      );
    }

    if (activeTab === "public") {
      if (nearbyItems.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Ionicons name="globe" size={48} color="#CBD5E1" style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>{t('home.noRecentActivity')}</Text>
            <Text style={styles.emptySubtitle}>{t('home.noRecentActivity')}</Text>
          </View>
        );
      }
      return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} removeClippedSubviews showsVerticalScrollIndicator={false}>
          <RecentItemsList
            items={nearbyItems}
            onDelete={() => {}}
            showDeleteButton={false}
            currentUserId={user?.id}
          />
        </ScrollView>
      );
    }

    return null;
  };

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/sign-in");
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF8F3" }}>
        <ActivityIndicator size="large" color="#8B4513" />
      </View>
    );
  }

  if (!isSignedIn) return null;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={[styles.headerLogo, {resizeMode: 'contain'}]}
          />
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>{t('home.welcome')}</Text>
            <Text style={styles.usernameText}>
              {user?.emailAddresses[0]?.emailAddress.split("@")[0]}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButtonHeader}
            onPress={() => setNotificationModalVisible(true)}
            accessibilityLabel={t('home.notifications')}
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
            <Text style={styles.sectionTitle}>{t('home.reportTitle')}</Text>
            <Text style={styles.sectionSubtitle}>
              {t('home.reportSubtitle')}
            </Text>

            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.quickAction, { backgroundColor: '#E3F2FD' }]}
                onPress={() => router.push('/(modals)/report-lost')}
              >
                <Ionicons name="search" size={24} color="#1976D2" />
                <Text style={[styles.quickActionText, { color: '#1976D2' }]}>{t('home.lostCta')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickAction, { backgroundColor: '#E8F5E9' }]}
                onPress={() => router.push('/(modals)/report-found')}
              >
                <Ionicons name="eye" size={24} color="#2E7D32" />
                <Text style={[styles.quickActionText, { color: '#2E7D32' }]}>{t('home.foundCta')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.section, { flex: 1 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.sectionTitle}>{t('home.recentActivity')}</Text>
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

            <View style={styles.tabsContainer}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.tabIndicator,
                  {
                    transform: [{ translateX: indicatorX }],
                    width: indicatorWidth,
                  },
                ]}
              />

              <TouchableOpacity
                style={[styles.tab, activeTab === "my" && styles.tabActiveSlider]}
                onPress={() => setActiveTab("my")}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  tabLayouts.current.my = { x, width };
                  if (activeTab === "my") {
                    animateTabIndicator("my");
                  }
                }}
              >
                <Ionicons
                  name="person"
                  size={18}
                  color={activeTab === "my" ? "#4A90E2" : "#999"}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabText, activeTab === "my" && styles.tabTextActive]}>
                  {t('home.myItems')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, activeTab === "institution" && styles.tabActiveSlider]}
                onPress={() => setActiveTab("institution")}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  tabLayouts.current.institution = { x, width };
                  if (activeTab === "institution") {
                    animateTabIndicator("institution");
                  }
                }}
              >
                <Ionicons
                  name="business"
                  size={18}
                  color={activeTab === "institution" ? "#4A90E2" : "#999"}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabText, activeTab === "institution" && styles.tabTextActive]}>
                  {t('home.institution')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, activeTab === "public" && styles.tabActiveSlider]}
                onPress={() => setActiveTab("public")}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  tabLayouts.current.public = { x, width };
                  if (activeTab === "public") {
                    animateTabIndicator("public");
                  }
                }}
              >
                <Ionicons
                  name="globe"
                  size={18}
                  color={activeTab === "public" ? "#4A90E2" : "#999"}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabText, activeTab === "public" && styles.tabTextActive]}>
                  {t('home.publicItems')}
                </Text>
              </TouchableOpacity>
            </View>

            {renderTabContent()}
          </View>

          <Modal visible={notificationModalVisible} transparent animationType="fade" onRequestClose={() => setNotificationModalVisible(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setNotificationModalVisible(false)}>
              <Pressable style={[styles.modalContent, { width: '90%', maxHeight: '70%' }]} onPress={() => {}}>
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>{t('home.notifications')}</Text>

                {(!notifications || notifications.length === 0) ? (
                  <View style={styles.notificationsEmpty}>
                    <Ionicons name="notifications-off" size={48} color="#CBD5E1" />
                    <Text style={styles.notificationsEmptyTitle}>{t('common.noData')}</Text>
                    <Text style={styles.notificationsEmptySubtitle}>{t('home.noRecentActivity')}</Text>
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
                                  const token = await getToken({ skipCache: true });
                                  const api = getAuthenticatedApi(token, getToken);

                                  const matchedItemResponse = await api.getMatchedItemByItems(
                                    n.meta.sourceItemId,
                                    n.meta.matchedItemId
                                  );

                                  const chatResponse = await api.getOrCreateChatForMatch(
                                    matchedItemResponse.matchedItem._id
                                  );

                                  const otherUser = chatResponse.chat.participants.find(
                                    p => p.clerkId !== user.id
                                  );

                                  router.push({
                                    pathname: '/chat-conversation',
                                    params: {
                                      chatId: chatResponse.chat._id,
                                      otherUserName: otherUser?.name || otherUser?.email?.split('@')[0] || t('chat.user')
                                    }
                                  });
                                } catch (err) {
                                  console.error('Error opening chat:', err);
                                  alert(t('chat.sendError'));
                                }
                              }}
                            >
                              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('nav.chat')}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <TouchableOpacity onPress={() => setNotificationModalVisible(false)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <Text style={{ color: '#0F172A', fontWeight: '600' }}>{t('common.close')}</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
      </View>

      <BottomNavBar activeTab="home" />
    </View>
  );
}
