import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

export const BACKGROUND_LOCATION_TASK = "BACKGROUND_LOCATION_TASK";

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Background location task error:", error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const latestLocation = locations?.[0];
    if (latestLocation) {
      const { latitude, longitude } = latestLocation.coords;
      try {
        let token = api.defaults.headers.common["Authorization"] as string | undefined;

        // If the app was closed and restarted in background, the token might not be in memory
        if (!token) {
          const ACCESS_TOKEN_KEY = "campusx.auth.access-token";
          const storedToken = Platform.OS === "web"
            ? await AsyncStorage.getItem(ACCESS_TOKEN_KEY)
            : await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

          if (storedToken) {
            token = `Bearer ${storedToken}`;
          }
        }

        if (token) {
          await api.post("/location/position", { 
            latitude, 
            longitude,
            accuracy: latestLocation.coords.accuracy,
            heading: latestLocation.coords.heading,
            speed: latestLocation.coords.speed,
            source: "background"
          }, {
            headers: { Authorization: token }
          });
          console.log(`[BACKGROUND TASK] Pushed location: ${latitude}, ${longitude}`);
        }
      } catch (err) {
        console.error("Failed to push background location:", err);
      }
    }
  }
});
