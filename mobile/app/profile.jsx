import { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Modal, Pressable, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUser, useAuth } from '@clerk/clerk-expo';
import { BottomNavBar } from '../components/BottomNavBar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useI18n } from '../i18n/I18nProvider';

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [image, setImage] = useState(null);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage } = useI18n();
  

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
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>{t('profile.itemsFound')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>{t('profile.itemsLost')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>{t('profile.matches')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem} onPress={() => setLanguageModalVisible(true)}>
          <Ionicons name="settings-outline" size={24} color="#333" />
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuText}>{t('profile.appLanguage')}</Text>
            <Text style={styles.menuSubText}>
              {t('profile.currentLanguage', { language: language === 'hi' ? t('common.hindi') : t('common.english') })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

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

      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setLanguageModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t('common.chooseLanguage')}</Text>

            <TouchableOpacity
              style={styles.languageOption}
              onPress={() => {
                setLanguage('en');
                setLanguageModalVisible(false);
              }}
            >
              <Text style={styles.languageOptionText}>{t('common.english')}</Text>
              {language === 'en' ? <Ionicons name="checkmark-circle" size={22} color="#4A90E2" /> : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.languageOption}
              onPress={() => {
                setLanguage('hi');
                setLanguageModalVisible(false);
              }}
            >
              <Text style={styles.languageOptionText}>{t('common.hindi')}</Text>
              {language === 'hi' ? <Ionicons name="checkmark-circle" size={22} color="#4A90E2" /> : null}
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeModalButton} onPress={() => setLanguageModalVisible(false)}>
              <Text style={styles.closeModalText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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
  },
  menuTextWrap: {
    flex: 1,
    marginLeft: 16,
  },
  menuSubText: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  logoutButton: {
    marginTop: 8,
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#E74C3C',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  languageOptionText: {
    fontSize: 16,
    color: '#1F2937',
  },
  closeModalButton: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
  },
  closeModalText: {
    color: '#334155',
    fontWeight: '600',
  },
});
