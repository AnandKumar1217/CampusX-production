import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { navigationRef, setPendingRoute, handleNotification } from "../navigation/PushRoutingManager";

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
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  async function registerForPushNotificationsAsync() {
    let token;

    if (__DEV__) {
      console.log("Development mode: skipping push notification registration to avoid FirebaseApp init error.");
      return;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#8066FF",
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        console.log("Failed to get push token for push notification!");
        return;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      if (!projectId || projectId === "REPLACE_WITH_EAS_PROJECT_ID") {
        console.warn("Project ID not found in app.json. Cannot get Expo Push Token.");
        return;
      }

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        token = tokenData.data;
      } catch (e) {
        console.log("Error getting push token", e);
      }
    } else {
      console.log("Must use physical device for Push Notifications");
    }

    return token;
  }

  // Register the token with our backend
  const registerToken = async (token: string) => {
    try {
      await api.post("/push/register", {
        token,
        deviceId: Device.osBuildId,
        platform: Platform.OS,
      });
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    } catch (e) {
      console.warn("Failed to register push token with backend", e);
    }
  };

  // Unregister token from backend
  const unregisterToken = async (token: string) => {
    try {
      await api.post("/push/unregister", {
        token,
      });
    } catch (e) {
      console.warn("Failed to unregister push token", e);
    }
  };

  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data) {
        if (data.route) {
          handleNotification(data);
        } else if (data.url) {
          import("react-native").then(({ Linking }) => {
            Linking.openURL(data.url as string).catch(err => console.log("Failed to open notification url", err));
          });
        }
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    expoPushToken,
    setExpoPushToken,
    registerForPushNotificationsAsync,
    registerToken,
    unregisterToken,
    notificationListener,
    responseListener,
  };
}
