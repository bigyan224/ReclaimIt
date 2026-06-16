import { Redirect, Stack } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { ActivityIndicator, View } from "react-native";

export default function AuthRoutesLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (isSignedIn) return <Redirect href={"/"} />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
