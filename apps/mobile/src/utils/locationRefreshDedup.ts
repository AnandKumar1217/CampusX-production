import AsyncStorage from "@react-native-async-storage/async-storage";

const DEDUP_KEY = "campusx.location.refresh.processed";

export async function claimLocationRefreshRequest(requestId: string): Promise<boolean> {
  try {
    const processedRaw = await AsyncStorage.getItem(DEDUP_KEY);
    let processedIds: Record<string, number> = {};
    if (processedRaw) {
      try {
        processedIds = JSON.parse(processedRaw);
      } catch (e) {}
    }

    const now = Date.now();
    if (processedIds[requestId] && now - processedIds[requestId] < 60000) {
      return false; // Already processed recently
    }

    // Clean up old entries
    for (const key in processedIds) {
      if (now - processedIds[key] > 300000) {
        delete processedIds[key];
      }
    }
    processedIds[requestId] = now;
    await AsyncStorage.setItem(DEDUP_KEY, JSON.stringify(processedIds));
    return true;
  } catch (e) {
    console.error("Failed to dedup location refresh request:", e);
    return true; // fail open
  }
}
