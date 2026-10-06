import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { claimLocationRefreshRequest } from "../utils/locationRefreshDedup";
import { api } from "./api";

export const BACKGROUND_LOCATION_TASK = "BACKGROUND_LOCATION_TASK";
export const LOCATION_REFRESH_NOTIFICATION_TASK = "LOCATION_REFRESH_NOTIFICATION_TASK";

// Remove old location updates watcher if it exists
TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK).then(isRegistered => {
  if (isRegistered) {
    Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
  }
}).catch(() => {});

// 3. Define the task BEFORE registering it
TaskManager.defineTask(LOCATION_REFRESH_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
  if (error) {
    console.error("[LocationTask] Background notification task error:", error);
    return;
  }

  try {
    if (!data) return;
    
    // 4. Fix Expo SDK 54 Headless payload parsing
    let notificationData: any = null;
    const typedData = data as any;
    if (typedData.dataString) {
      try {
        notificationData = JSON.parse(typedData.dataString);
      } catch (e) {}
    } else if (typedData.notification?.data) {
      notificationData = typedData.notification.data;
    } else if (typedData.data) { // fallback
      notificationData = typedData.data;
    }
    
    if (typeof notificationData === "string") {
      try {
        notificationData = JSON.parse(notificationData);
      } catch (e) {}
    }

    if (!notificationData || notificationData.type !== "LOCATION_REFRESH_REQUEST") {
      return;
    }

    const { requestId, requesterId } = notificationData;
    if (!requestId || !requesterId) return;

    const canClaim = await claimLocationRefreshRequest(requestId);
    if (!canClaim) return;

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
      return;
    }

    // 5. Fetch actual settings from backend
    try {
      const settingsRes = await api.get("/location/settings", { headers: { Authorization: token } });
      if (!settingsRes.data?.data?.enabled) {
        return;
      }
    } catch (e) {
      return;
    }

    // 3. Check Location Permissions
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
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
    }
  } catch (err) {
    console.error("[LocationTask] Failed to process background notification task:", err);
  }
});

// Safely register the task only after defining
TaskManager.isTaskRegisteredAsync(LOCATION_REFRESH_NOTIFICATION_TASK).then(isRegistered => {
  if (!isRegistered) {
    Notifications.registerTaskAsync(LOCATION_REFRESH_NOTIFICATION_TASK).catch((err) => {
      console.log("[LocationTask] Failed to register background notification task", err);
    });
  }
}).catch(() => {});
