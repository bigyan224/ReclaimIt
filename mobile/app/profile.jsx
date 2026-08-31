import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUser, useAuth } from '@clerk/clerk-expo';
import { BottomNavBar } from '../components/BottomNavBar';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useI18n } from '../i18n/I18nProvider';
import { getAuthenticatedApi } from '../services/api';

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut, getToken } = useAuth();
  const [image, setImage] = useState(null);
  const [stats, setStats] = useState({ found: 0, lost: 0, matches: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    setStatsLoading(true);
    try {
      const token = await getTokenRef.current({ skipCache: true });
      const api = getAuthenticatedApi(token, getTokenRef.current);
      const [itemsRes, countRes] = await Promise.all([
        api.getItems().catch(() => ({ items: [] })),
        api.getMyMatchesCount().catch(() => ({ count: 0 })),
      ]);
      const allItems = itemsRes?.items ?? [];
      const myItems = allItems.filter((it) => {
        const clerkId = typeof it.user === 'object' ? it.user?.clerkId : null;
        if (clerkId) return clerkId === user.id;
        return false;
      });
      const found = myItems.filter((it) => it.type === 'FOUND').length;
      const lost = myItems.filter((it) => it.type === 'LOST').length;
      const matches = countRes?.count ?? 0;
      setStats({ found, lost, matches });
    } catch (e) {
      console.error('Failed to load profile stats:', e);
    } finally {
      setStatsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );
  

  const pickImage = async () => {
    // Request camera roll permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(t('profile.permissionRequired'), t('profile.cameraPermissionMsg'));
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

const handleSignOut = async () => {
  try {
    await signOut();
    router.replace('/sign-in');
  } catch (error) {
    console.error('Error signing out:', error);
    Alert.alert(t('common.error'), t('profile.signOutFailed'));
  }
};

  return (
           <View style={[styles.container, { paddingBottom: insets.bottom }]}>
    
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
      </View>

      <View style={styles.profileContainer}>
        <View style={styles.avatarContainer}>
          <Image
            source={image ? { uri: image } : require('../assets/images/user-avatar.png')}
            style={styles.avatar}
          />
          <TouchableOpacity 
            style={styles.editButton}
            onPress={pickImage}
          >
            <Ionicons name="camera" size={18} color="#4A90E2" />
          </TouchableOpacity>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.userEmail}>
            {user?.emailAddresses[0]?.emailAddress}
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            {statsLoading ? <ActivityIndicator size="small" color="#4A90E2" /> : <Text style={styles.statNumber}>{stats.found}</Text>}
            <Text style={styles.statLabel}>{t('profile.itemsFound')}</Text>
          </View>
          <View style={styles.statItem}>
            {statsLoading ? <ActivityIndicator size="small" color="#4A90E2" /> : <Text style={styles.statNumber}>{stats.lost}</Text>}
            <Text style={styles.statLabel}>{t('profile.itemsLost')}</Text>
          </View>
          <View style={styles.statItem}>
            {statsLoading ? <ActivityIndicator size="small" color="#4A90E2" /> : <Text style={styles.statNumber}>{stats.matches}</Text>}
            <Text style={styles.statLabel}>{t('profile.matches')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL('mailto:bigyanacharya224@gmail.com')}>
          <Ionicons name="help-circle-outline" size={24} color="#333" />
          <Text style={styles.menuText}>{t('profile.helpSupport')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="information-circle-outline" size={24} color="#333" />
          <Text style={styles.menuText}>{t('profile.about')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.menuItem, styles.logoutButton]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={24} color="#E74C3C" />
          <Text style={[styles.menuText, styles.logoutText]}>{t('profile.signOut')}</Text>
        </TouchableOpacity>
      </View>

      <BottomNavBar activeTab="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffffff',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  profileContainer: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e0e0e0',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4A90E2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
  },
  logoutButton: {
    marginTop: 8,
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#E74C3C',
  },
});
