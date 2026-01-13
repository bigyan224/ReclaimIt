import Constants from "expo-constants";

const extra =
  Constants.expoConfig?.extra ??
  Constants.manifest?.extra ??
  {};

export const API_URL = extra.EXPO_PUBLIC_API_URL;
export const CLERK_PUBLISHABLE_KEY =
  extra.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

// HARD FAIL if missing (prevents silent crash)
if (!API_URL) {
  throw new Error("❌ API_URL is missing in app.json");
}

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("❌ CLERK_PUBLISHABLE_KEY is missing in app.json");
}
