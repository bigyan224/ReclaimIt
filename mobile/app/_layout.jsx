import { Slot } from "expo-router";
import SafeScreen from "@/components/SafeScreen";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { ActivityIndicator, View, StatusBar } from "react-native";
import {CLERK_PUBLISHABLE_KEY} from "../config/env";
import { I18nProvider } from "../i18n/I18nProvider";
import { COLORS } from "../constants/colors";

export default function RootLayout() {
  return (
    <I18nProvider>
      <ClerkProvider tokenCache={tokenCache} publishableKey={CLERK_PUBLISHABLE_KEY}>
        <StatusBar backgroundColor={COLORS.background} barStyle="dark-content" />
        <SafeScreen>
          <ClerkLoaded>
            <Slot />
          </ClerkLoaded>
        </SafeScreen>
      </ClerkProvider>
    </I18nProvider>
  );
}
