import { Slot } from "expo-router";
import SafeScreen from "@/components/SafeScreen";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import {CLERK_PUBLISHABLE_KEY} from "../config/env";

export default function RootLayout() {
  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={CLERK_PUBLISHABLE_KEY}>
      <SafeScreen>
        <ClerkLoaded>
          <Slot />
        </ClerkLoaded>
      </SafeScreen>
      <StatusBar style="dark" />
    </ClerkProvider>
  );
}
