import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import RecentItemCard from "./RecentItemCard";
import { useI18n } from "../i18n/I18nProvider";

function RecentItemsList({ items, onDelete, showDeleteButton = true, currentUserId }) {
  const { t } = useI18n();

  if (!items || items.length === 0) {
    return (
      <View style={styles.activityPlaceholder}>
                    <Ionicons name="time" size={48} color="#E0E0E0" />
                    <Text style={styles.placeholderText}>{t('recent.noRecentActivity')}</Text>
                  </View>
    );
  }

  return (
    <View>
      {items.map((item) => (
        <RecentItemCard
          key={item._id}
          item={item}
          onDelete={onDelete}
          showDeleteButton={showDeleteButton}
          currentUserId={currentUserId}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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

export default memo(RecentItemsList);
