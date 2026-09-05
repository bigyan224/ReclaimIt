// Cached Clerk token with retries.
//
// Every screen was calling getToken({ skipCache: true }), forcing a network
// roundtrip to Clerk per screen — and right after sign-in the session can be
// momentarily unavailable, so a single attempt returns null and the whole
// screen errors (fixed only by manual refresh). This helper uses the cached
// token (the api.js 401 interceptor already refreshes on expiry) and retries
// a few times before giving up.
export async function getApiToken(getTokenFn, { fresh = false, tries = 4, delayMs = 300 } = {}) {
  if (typeof getTokenFn !== "function") return null;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      const token = await getTokenFn(fresh ? { skipCache: true } : {});
      if (token) return token;
    } catch (err) {
      if (__DEV__) console.warn("getApiToken attempt failed:", err?.message || err);
    }
    if (attempt < tries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}
