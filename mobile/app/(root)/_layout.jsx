import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Stack } from "expo-router/stack";
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { registerBannedCallback } from "../../services/api";
import { Ionicons } from "@expo/vector-icons";

export default function Layout() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in");
    }
  }, [isLoaded, isSignedIn]);
  const [isBanned, setIsBanned] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    registerBannedCallback(() => {
      setIsBanned(true);
    });

    return () => {
      registerBannedCallback(null);
    };
  }, []);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      setIsBanned(false);
      router.replace("/sign-in");
    } catch (err) {
      console.error("Sign out failed on ban:", err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isBanned) {
    return (
      <View style={styles.bannedContainer}>
        <View style={styles.bannedCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="alert-circle" size={64} color="#EF4444" />
          </View>
          <Text style={styles.bannedTitle}>Account Suspended</Text>
          <Text style={styles.bannedDescription}>
            Your account has been banned for violating ReclaimIt's community guidelines and terms of service.
          </Text>
          <Text style={styles.bannedSubDescription}>
            If you believe this is a mistake, please reach out to our administration team for support.
          </Text>
          
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleSignOut}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.logoutButtonText}>Log Out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF8F3" }}>
        <ActivityIndicator size="large" color="#8B4513" />
      </View>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  bannedContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  bannedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  bannedTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  bannedDescription: {
    fontSize: 15,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  bannedSubDescription: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 32,
  },
  logoutButton: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: 48,
    borderRadius: 12,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
