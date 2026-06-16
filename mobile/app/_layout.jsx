import { Slot, Redirect } from "expo-router";
import SafeScreen from "@/components/SafeScreen";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import {CLERK_PUBLISHABLE_KEY} from "../config/env";
import { I18nProvider } from "../i18n/I18nProvider";

function RootContent() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return <Slot />;
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <ClerkProvider tokenCache={tokenCache} publishableKey={CLERK_PUBLISHABLE_KEY}>
        <SafeScreen>
          <RootContent />
        </SafeScreen>
        <StatusBar style="dark" />
      </ClerkProvider>
    </I18nProvider>
  );
}
