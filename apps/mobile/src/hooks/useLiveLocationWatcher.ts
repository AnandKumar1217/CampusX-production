import { useEffect, useRef } from "react";
import * as Location from "expo-location";
import { AppState, AppStateStatus } from "react-native";
import { useAppStore } from "@/store/appStore";
import { api } from "@/services/api";
import { BACKGROUND_LOCATION_TASK } from "@/services/locationTask";
import * as TaskManager from "expo-task-manager";

export function useLiveLocationWatcher() {
  const locationSharingEnabled = useAppStore((state) => state.locationSharingEnabled);
  const watcherSubscription = useRef<Location.LocationSubscription | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    async function setupLocationTracking() {
      if (!locationSharingEnabled) {
        stopAllTracking();
        return;
      }

      try {
        const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
        if (fgStatus !== "granted") {
          console.warn("[LiveLocation] Foreground permission not granted, cannot start tracking.");
          return;
        }
        
        // Always try to fetch and push initial position on setup
        try {
          const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (initial) await pushLocation(initial, "foreground");
        } catch (e) {
          // Fallback to last known if current position fails
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) await pushLocation(lastKnown, "foreground");
        }

        // Start Foreground watcher if not started
        if (!watcherSubscription.current) {
          watcherSubscription.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced, // Avoid High to save battery
              timeInterval: 60000,
              distanceInterval: 10,
            },
            (loc) => pushLocation(loc, "foreground")
          );
        }

        // Setup background tracking if permission granted
        const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
        if (bgStatus === "granted") {
          const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
          if (!isRegistered) {
            await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 60000,
              distanceInterval: 0,
              showsBackgroundLocationIndicator: true,
              deferredUpdatesDistance: 0,
              deferredUpdatesInterval: 60000,
              foregroundService: {
                notificationTitle: "CampusX Location",
                notificationBody: "Location sharing is active",
                notificationColor: "#7c3aed"
              }
            });
            console.log("[LiveLocation] Started background tracking");
          }
        }
      } catch (err) {
        console.error("[LiveLocation] Setup error:", err);
      }
    }

    async function stopAllTracking() {
      if (watcherSubscription.current) {
        watcherSubscription.current.remove();
        watcherSubscription.current = null;
      }
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
        if (isRegistered) {
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          console.log("[LiveLocation] Stopped background tracking");
        }
      } catch (err) {}
    }

    async function pushLocation(loc: Location.LocationObject, source: string) {
      try {
        await api.post("/location/position", {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          heading: loc.coords.heading,
          speed: loc.coords.speed,
          source,
        });
        useAppStore.getState().setLocationCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      } catch (err) {
        console.error("[LiveLocation] Failed to push position:", err);
      }
    }

    // Initialize or stop tracking based on sharing state
    setupLocationTracking();

    let friendSyncInterval: ReturnType<typeof setInterval>;
    if (locationSharingEnabled) {
      // Sync friend locations every 60 seconds when location sharing is active
      friendSyncInterval = setInterval(() => {
        useAppStore.getState().fetchInitialFriendLocations().catch(() => {});
      }, 60000);
    }

    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        if (locationSharingEnabled) {
          setupLocationTracking(); // ensures fresh fetch on foreground
          useAppStore.getState().fetchInitialFriendLocations().catch(() => {});
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      if (friendSyncInterval) clearInterval(friendSyncInterval);
      subscription.remove();
      // We don't stop background tracking here, just foreground
      if (watcherSubscription.current) {
        watcherSubscription.current.remove();
        watcherSubscription.current = null;
      }
    };
  }, [locationSharingEnabled]);
}
