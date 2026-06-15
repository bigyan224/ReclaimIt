import { View, Text, TouchableOpacity, Image, StyleSheet, Modal, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { getAuthenticatedApi } from "../services/api";
import { useI18n } from "../i18n/I18nProvider";

export default function RecentItemCard({ item, onDelete, showDeleteButton = true, currentUserId }) {
  const router = useRouter();
  const { t } = useI18n();
  const isFound = item.type === "FOUND";

  const getLocationLabel = () => {
    if (!item.location) return null;
    if (typeof item.location === "string") return item.location;
    if (item.location.name) return item.location.name;

    const coords = item.location.coordinates?.coordinates;
    if (Array.isArray(coords) && coords.length === 2) {
      const [lng, lat] = coords;
      return `${lat?.toFixed(3) ?? lat}, ${lng?.toFixed(3) ?? lng}`;
    }

    return null;
  };

  const locationLabel = getLocationLabel();
  const thumbUri = item.image?.url || null;
  const primaryColor = isFound ? '#2E7D32' : '#1976D2';
  const [showModal, setShowModal] = useState(false);
  const formattedDate = item.date ? new Date(item.date).toLocaleString() : null;
  const { getToken } = useAuth();
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="image" size={28} color="#94A3B8" />
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>{item.itemName}</Text>
          <Text style={styles.type}>{isFound ? t('recent.foundItem') : t('recent.lostItem')}</Text>

          {locationLabel ? (
            <Text style={styles.location} numberOfLines={1}>📍 {locationLabel}</Text>
          ) : null}

          {item.description ? (
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowModal(true)}
            accessibilityLabel={t('recent.viewItem')}
          >
            <Ionicons name="eye" size={20} color={primaryColor} />
          </TouchableOpacity>

          {showDeleteButton && (
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: '#FFF1F2' }]}
              onPress={() => setDeleteVisible(true)}
              accessibilityLabel={t('recent.deleteItem')}
            >
              <Ionicons name="trash" size={20} color="#DC2626" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {thumbUri ? (
                <Image source={{ uri: thumbUri }} style={styles.modalImage} />
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <Ionicons name="image" size={40} color="#94A3B8" />
                </View>
              )}

              <Text style={styles.modalTitle}>{item.itemName}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: primaryColor }]}>
                  <Text style={styles.badgeText}>{isFound ? t('recent.found') : t('recent.lost')}</Text>
                </View>
                {formattedDate && <Text style={styles.dateText}>{formattedDate}</Text>}
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('recent.location')}</Text>
                <Text style={styles.detailValue}>{locationLabel || '—'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('recent.category')}</Text>
                <Text style={styles.detailValue}>{item.category || '—'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('recent.brand')}</Text>
                <Text style={styles.detailValue}>{item.brandName || '—'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('recent.color')}</Text>
                <Text style={styles.detailValue}>{item.color || '—'}</Text>
              </View>

              {item.description ? (
                <>
                  <Text style={[styles.detailLabel, { marginTop: 12 }]}>{t('recent.description')}</Text>
                  <Text style={styles.description}>{item.description}</Text>
                </>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              {showDeleteButton && (
                <TouchableOpacity style={styles.actionButton} onPress={() => { setShowModal(false); router.push(`/item/${item._id}/edit`); }}>
                  <Text style={styles.actionButtonText}>{t('recent.edit')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.actionButton, styles.closeButton]} onPress={() => setShowModal(false)}>
                <Text style={[styles.actionButtonText, styles.closeButtonText]}>{t('recent.close')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        visible={deleteVisible}
        animationType="fade"
        transparent
        onRequestClose={() => { setDeleteVisible(false); setConfirmText(''); }}
      >
        <Pressable style={styles.modalOverlay} onPress={() => { setDeleteVisible(false); setConfirmText(''); }}>
          <Pressable style={[styles.modalContent, { padding: 16 }]} onPress={() => {}}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{t('recent.deleteTitle')}</Text>
            <Text style={{ color: '#475569', marginBottom: 12 }}>{t('recent.deleteConfirmHelp')}</Text>

            <TextInput
              placeholder={t('recent.typeDelete')}
              value={confirmText}
              onChangeText={setConfirmText}
              style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 8, marginBottom: 12 }}
              autoCapitalize="none"
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', marginRight: 8 }]} onPress={() => { setDeleteVisible(false); setConfirmText(''); }}>
                <Text style={[styles.actionButtonText, { color: '#0F172A' }]}>{t('recent.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: confirmText.toLowerCase() === 'delete' ? '#DC2626' : '#F3F4F6' }]}
                onPress={async () => {
                  if (confirmText.toLowerCase() !== 'delete') return;
                  try {
                    setIsDeleting(true);
                    const token = await getToken({ skipCache: true });
                    const api = getAuthenticatedApi(token, getToken);
                    await api.deleteItem(item._id);
                    setIsDeleting(false);
                    setDeleteVisible(false);
                    setConfirmText('');
                    // Notify parent to remove from list
                    if (typeof onDelete === 'function') onDelete(item._id);
                  } catch (err) {
                    console.error('Error deleting item:', err);
                    setIsDeleting(false);
                    // show a simple alert
                    alert(t('recent.deleteFailed'));
                  }
                }}
                disabled={confirmText.toLowerCase() !== 'delete' || isDeleting}
              >
                {isDeleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>{t('recent.delete')}</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFF2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  thumbnailPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  type: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  location: {
    marginTop: 6,
    fontSize: 13,
    color: '#334155',
  },
  description: {
    marginTop: 6,
    fontSize: 13,
    color: '#475569',
  },
  actions: {
    marginLeft: 12,
    alignItems: 'center',
  },
  iconButton: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },

  /* Modal styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  modalImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
    backgroundColor: '#F8FAFC',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    color: '#0F172A',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  dateText: {
    color: '#64748B',
    fontSize: 12,
  },
  detailRow: {
    marginTop: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  detailValue: {
    marginTop: 4,
    fontSize: 14,
    color: '#0F172A',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#fff',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  closeButtonText: {
    color: '#0F172A',
  },

});
