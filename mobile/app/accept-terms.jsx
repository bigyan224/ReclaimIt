import { useState } from "react";
import { Text, TouchableOpacity, View, ActivityIndicator, ScrollView, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { API_URL } from "../config/env";
import { useI18n } from "../i18n/I18nProvider";

export default function AcceptTermsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken({ skipCache: true });
      const response = await fetch(`${API_URL}/users/me/terms`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed");
      router.replace("/");
    } catch {
      setError(t('auth.acceptTermsError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: "center", padding: 24 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <Ionicons name="document-text-outline" size={64} color={COLORS.primary} />
        </View>

        <Text style={{ fontSize: 24, fontWeight: "bold", color: COLORS.text, textAlign: "center", marginBottom: 12 }}>
          {t('auth.acceptTermsTitle')}
        </Text>

        <Text style={{ fontSize: 15, color: COLORS.textLight, textAlign: "center", lineHeight: 22, marginBottom: 32 }}>
          {t('auth.acceptTermsDescription')}
        </Text>

        {error ? (
          <View style={{ backgroundColor: "#FFE5E5", padding: 12, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: COLORS.expense, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="alert-circle" size={20} color={COLORS.expense} />
            <Text style={{ color: COLORS.text, marginLeft: 8, flex: 1, fontSize: 14 }}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={() => setAccepted(!accepted)}
          style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, paddingVertical: 8 }}
          activeOpacity={0.7}
        >
          <View style={{ width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: COLORS.primary, justifyContent: "center", alignItems: "center", marginRight: 12, backgroundColor: accepted ? COLORS.primary : "transparent" }}>
            {accepted && <Ionicons name="checkmark" size={18} color="#fff" />}
          </View>
          <Text style={{ color: COLORS.text, fontSize: 14, flex: 1, lineHeight: 20 }}>
            {t('auth.iAgree')}{" "}
            <Text style={{ color: COLORS.primary, textDecorationLine: "underline" }} onPress={() => Linking.openURL("https://bigyan224.github.io/ReclaimIt/")}>
              {t('auth.termsAndPrivacy')}
            </Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAccept}
          disabled={!accepted || loading}
          style={{ backgroundColor: accepted ? COLORS.primary : COLORS.border, borderRadius: 12, padding: 16, alignItems: "center", opacity: accepted ? 1 : 0.6 }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: accepted ? COLORS.white : COLORS.textLight, fontSize: 18, fontWeight: "600" }}>
              {t('auth.acceptTermsButton')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/sign-in")} style={{ alignItems: "center", marginTop: 24 }}>
          <Text style={{ color: COLORS.textLight, fontSize: 14 }}>
            {t('auth.noAccount')} <Text style={{ color: COLORS.primary, fontWeight: "600" }}>{t('auth.signIn')}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
