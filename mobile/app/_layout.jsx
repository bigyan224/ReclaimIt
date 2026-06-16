import { Slot } from "expo-router";
import SafeScreen from "@/components/SafeScreen";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import {CLERK_PUBLISHABLE_KEY} from "../config/env";
import { I18nProvider } from "../i18n/I18nProvider";

export default function RootLayout() {
  return (
    <I18nProvider>
      <ClerkProvider tokenCache={tokenCache} publishableKey={CLERK_PUBLISHABLE_KEY}>
        <SafeScreen>
          <ClerkLoaded>
            <Slot />
          </ClerkLoaded>
        </SafeScreen>
        <StatusBar style="dark" />
      </ClerkProvider>
    </I18nProvider>
  );
}
