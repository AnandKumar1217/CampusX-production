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
  // Track last registered identity to avoid redundant backend calls
  const lastRegisteredIdentity = useRef<{ token: string; userId: string } | null>(null);

  /**
   * Obtain the Expo push token and register it with our backend.
   */
  const registerForPushNotificationsAsync = useCallback(async (isForeground: boolean = false): Promise<string | undefined> => {
    if (__DEV__) {
      console.log("[push] Development mode: skipping push registration (intentional).");
      return undefined;
    }

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

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      if (isForeground) {
        return undefined; // Never request permission merely because app foregrounded
      }
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
      console.error("[push] Error getting Expo push token:", e?.message ?? e);
      return undefined;
    }
  }, []);

  const registerToken = useCallback(async (token: string, userId: string): Promise<void> => {
    if (
      lastRegisteredIdentity.current?.token === token &&
      lastRegisteredIdentity.current?.userId === userId
    ) {
      return;
    }
    try {
      await api.post("/push/register", {
        token,
        deviceId: Device.osBuildId,
        platform: Platform.OS,
      });
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      lastRegisteredIdentity.current = { token, userId };
    } catch (e) {
      console.warn("[push] Failed to register push token with backend:", e);
    }
  }, []);

  const unregisterToken = useCallback(async (token: string): Promise<void> => {
    lastRegisteredIdentity.current = null;
    try {
      await api.post("/push/unregister", { token });
    } catch (e) {
      console.warn("[push] Failed to unregister push token:", e);
    }
  }, []);

  const clearDedupState = useCallback(() => {
    lastRegisteredIdentity.current = null;
  }, []);

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.route) {
          handleNotification(data);
        } else if (typeof data?.url === "string") {
          import("react-native").then(({ Linking }) => {
            Linking.openURL(data.url as string).catch(err => console.log("Failed to open notification url", err));
          });
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
    clearDedupState,
  };
}
