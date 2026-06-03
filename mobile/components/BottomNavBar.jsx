import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useI18n } from '../i18n/I18nProvider';

export const BottomNavBar = ({ activeTab = 'home' }) => {
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <Link href="/" asChild>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons 
            name="home" 
            size={24} 
            color={activeTab === 'home' ? '#4A90E2' : '#666'} 
          />
          <Text style={[styles.navText, activeTab === 'home' && styles.activeNavText]}>{t('nav.home')}</Text>
        </TouchableOpacity>
      </Link>
      
      <Link href="/chat" asChild>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons 
            name="chatbubble-ellipses" 
            size={24} 
            color={activeTab === 'chat' ? '#4A90E2' : '#666'} 
          />
          <Text style={[styles.navText, activeTab === 'chat' && styles.activeNavText]}>{t('nav.chat')}</Text>
        </TouchableOpacity>
      </Link>
      
      <Link href="/profile" asChild>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons 
            name="person" 
            size={24} 
            color={activeTab === 'profile' ? '#4A90E2' : '#666'} 
          />
          <Text style={[styles.navText, activeTab === 'profile' && styles.activeNavText]}>{t('nav.profile')}</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingVertical: 12,
    paddingHorizontal: 20,
    height: 70,
  },
  navItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  navText: {
    fontSize: 12,
    marginTop: 4,
    color: '#666',
  },
  activeNavText: {
    color: '#4A90E2',
    fontWeight: '600',
  },
});
