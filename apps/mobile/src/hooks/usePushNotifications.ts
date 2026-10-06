import { useEffect, useRef, useCallback } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { handleNotification } from "../navigation/PushRoutingManager";

export const PUSH_TOKEN_KEY = "campusx.push.token";

// Set how foreground notifications are handled
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications() {
  const responseListener = useRef<any>(null);
  // Track last registered token to avoid redundant backend calls
  const lastRegisteredToken = useRef<string | null>(null);

  /**
   * Obtain the Expo push token and register it with our backend.
   *
   * DEVELOPMENT: intentionally skipped — __DEV__ is true in Metro dev client
   * and the production Firebase client (com.campusx.mobile) is not loaded.
   *
   * PRODUCTION: runs on every call; the backend upsert is idempotent so
   * calling this more than once is safe.
   */
  const registerForPushNotificationsAsync = useCallback(async (): Promise<string | undefined> => {
    // INTENTIONAL: skip push registration in development builds.
    // The development app (com.campusx.mobile.dev) does not include a
    // Firebase client matching the production projectId, so token generation
    // would fail. Do NOT remove this guard.
    if (__DEV__) {
      console.log("[push] Development mode: skipping push registration (intentional).");
      return undefined;
    }

    // Push notifications require a real physical device (not a simulator)
    if (!Device.isDevice) {
      console.log("[push] Not a physical device — push notifications unavailable.");
      return undefined;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#8066FF",
      });
    }

    // Request permission if not already granted
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.log("[push] Notification permission denied — cannot register.");
      return undefined;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId || projectId === "REPLACE_WITH_EAS_PROJECT_ID") {
      console.warn("[push] EAS projectId missing from app config. Cannot get Expo push token.");
      return undefined;
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      return tokenData.data;
    } catch (e: any) {
      // Log the error (excluding the full token if present in error text)
      console.error("[push] Error getting Expo push token:", e?.message ?? e);
      return undefined;
    }
  }, []);

  /**
   * Register a token with the CampusX backend.
   * Skips the network call if the same token is already registered this session.
   */
  const registerToken = useCallback(async (token: string): Promise<void> => {
    if (lastRegisteredToken.current === token) {
      // Already registered this token this session — backend upsert not needed
      return;
    }
    try {
      await api.post("/push/register", {
        token,
        deviceId: Device.osBuildId,
        platform: Platform.OS,
      });
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      lastRegisteredToken.current = token;
    } catch (e) {
      console.warn("[push] Failed to register push token with backend:", e);
    }
  }, []);

  /**
   * Unregister token from backend on logout.
   * Clears the session-level dedup ref so the next login re-registers.
   */
  const unregisterToken = useCallback(async (token: string): Promise<void> => {
    lastRegisteredToken.current = null;
    try {
      await api.post("/push/unregister", { token });
    } catch (e) {
      console.warn("[push] Failed to unregister push token:", e);
    }
  }, []);

  // Wire up notification-tap deep link routing
  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.route) {
          handleNotification(data);
        }
      }
    );

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    registerForPushNotificationsAsync,
    registerToken,
    unregisterToken,
  };
}
