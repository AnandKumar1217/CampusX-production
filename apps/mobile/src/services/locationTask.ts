import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { api } from "./api";

export const BACKGROUND_LOCATION_TASK = "BACKGROUND_LOCATION_TASK";
export const LOCATION_REFRESH_NOTIFICATION_TASK = "LOCATION_REFRESH_NOTIFICATION_TASK";

// Remove old location updates watcher if it exists
TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK).then(isRegistered => {
  if (isRegistered) {
    Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(err => {
      console.log("[LocationTask] Failed to stop old background location task", err);
    });
  }
}).catch(() => {});

// Register the notification background task
Notifications.registerTaskAsync(LOCATION_REFRESH_NOTIFICATION_TASK).catch((err) => {
  console.log("[LocationTask] Failed to register background notification task", err);
});


TaskManager.defineTask(LOCATION_REFRESH_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
  if (error) {
    console.error("[LocationTask] Background notification task error:", error);
    return;
  }

  try {
    if (!data) return;
    const notificationData = (data as any)?.notification?.data;
    if (!notificationData) return;

    if (notificationData.type === "LOCATION_REFRESH_REQUEST") {
      const { requestId, requesterId } = notificationData;
      if (!requestId || !requesterId) return;
      console.log(`[LocationTask] Received location refresh request: ${requestId} from ${requesterId}`);

      // 1. Get Token
      let token = api.defaults.headers.common["Authorization"] as string | undefined;
      if (!token) {
        const ACCESS_TOKEN_KEY = "campusx.auth.access-token";
        const storedToken = Platform.OS === "web"
          ? await AsyncStorage.getItem(ACCESS_TOKEN_KEY)
          : await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        if (storedToken) {
          token = `Bearer ${storedToken}`;
        }
      }

      if (!token) {
        console.log("[LocationTask] No token available, aborting");
        return;
      }

      // 2. Check local location sharing state
      const STATE_KEY = "app-store";
      const appStoreRaw = Platform.OS === "web"
        ? await AsyncStorage.getItem(STATE_KEY)
        : await AsyncStorage.getItem(STATE_KEY); // zustand persist uses AsyncStorage by default for react-native
      
      console.log("[LocationTask] appStoreRaw read:", appStoreRaw);
      
      let sharingEnabled = false;
      if (appStoreRaw) {
        try {
          const parsed = JSON.parse(appStoreRaw);
          sharingEnabled = !!parsed?.state?.locationSharingEnabled;
        } catch (e) {}
      } else {
        // Fallback: assume we can't reliably determine, or use zustand memory if running
        // If JS context was alive, we could just check useAppStore.getState().locationSharingEnabled
        // but we are in a background task, so we read from storage.
      }
      
      if (!sharingEnabled) {
        console.log("[LocationTask] Location sharing is OFF locally, aborting refresh");
        return;
      }

      // 3. Check Location Permissions
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("[LocationTask] Location foreground permission not granted, aborting refresh");
        return;
      }

      // 4. Request location (exactly one fetch)
      const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (currentLoc) {
        await api.post("/location/position", { 
          latitude: currentLoc.coords.latitude, 
          longitude: currentLoc.coords.longitude,
          accuracy: currentLoc.coords.accuracy,
          heading: currentLoc.coords.heading,
          speed: currentLoc.coords.speed,
          source: "on_demand",
          requestId
        }, {
          headers: { Authorization: token }
        });
        console.log(`[LocationTask] Successfully pushed on-demand location for request ${requestId}`);
      }
    }
  } catch (err) {
    console.error("[LocationTask] Failed to process background notification task:", err);
  }
});
