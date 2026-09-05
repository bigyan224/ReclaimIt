import { Slot } from "expo-router";
import SafeScreen from "@/components/SafeScreen";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { ActivityIndicator, View, StatusBar } from "react-native";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import {CLERK_PUBLISHABLE_KEY} from "../config/env";
import { I18nProvider } from "../i18n/I18nProvider";
import { COLORS } from "../constants/colors";
import OfflineBanner from "@/components/OfflineBanner";

// Keep the splash visible until Clerk finishes initializing — otherwise the
// transparent root shows the raw native window (gray flash) on cold starts
// with no cached session.
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoaded]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <ClerkProvider tokenCache={tokenCache} publishableKey={CLERK_PUBLISHABLE_KEY}>
        <StatusBar backgroundColor={COLORS.background} barStyle="dark-content" />
        <SafeScreen>
          <OfflineBanner />
          <ClerkLoaded>
            <RootNavigator />
          </ClerkLoaded>
        </SafeScreen>
      </ClerkProvider>
    </I18nProvider>
  );
}
