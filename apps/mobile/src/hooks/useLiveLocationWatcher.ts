import { useEffect, useRef } from "react";
import * as Location from "expo-location";
import { AppState, AppStateStatus } from "react-native";
import { useAppStore } from "../store/appStore";
import { api } from "../services/api";
import { BACKGROUND_LOCATION_TASK } from "../services/locationTask";
import * as TaskManager from "expo-task-manager";

export function useLiveLocationWatcher() {
  const locationSharingEnabled = useAppStore((state) => state.locationSharingEnabled);
  const user = useAppStore((state) => state.user);
  const watcherSubscription = useRef<Location.LocationSubscription | null>(null);
  const appState = useRef(AppState.currentState);
  const inFlight = useRef(false);
  const lastPush = useRef(0);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function pushLocation(loc: Location.LocationObject, source: string) {
      if (inFlight.current) return;
      const now = Date.now();
      if (now - lastPush.current < 5000) return; // Prevent spamming within 5s

      inFlight.current = true;
      try {
        console.log(`[LiveLocation] Pushing position (reason: ${source})`);
        await api.post("/location/position", {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          heading: loc.coords.heading,
          speed: loc.coords.speed,
          source: "foreground",
        });
        useAppStore.getState().setLocationCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
        lastPush.current = Date.now();
      } catch (err) {
        console.error("[LiveLocation] Failed to push position:", err);
      } finally {
        inFlight.current = false;
      }
    }

    async function performHeartbeat(source: string) {
      if (appState.current !== "active" || !locationSharingEnabled || !user) return;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;
        const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (currentLoc) {
          await pushLocation(currentLoc, source);
        }
      } catch (e) {
        console.log("[LiveLocation] Heartbeat failed:", e);
      }
    }

    async function setupLocationTracking() {
      if (!locationSharingEnabled || !user) {
        stopAllTracking();
        return;
      }

      try {
        const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
        if (fgStatus !== "granted") {
          console.warn("[LiveLocation] Foreground permission not granted, cannot start tracking.");
          return;
        }
        
        // Immediate foreground fetch
        performHeartbeat("foreground_init");

        // Start Foreground watcher for movement
        if (!watcherSubscription.current) {
          watcherSubscription.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 60000,
              distanceInterval: 10,
            },
            (loc) => pushLocation(loc, "movement")
          );
        }

        // Start true 60s heartbeat
        if (!heartbeatInterval.current) {
          heartbeatInterval.current = setInterval(() => {
            performHeartbeat("heartbeat");
          }, 60000);
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
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
        if (isRegistered) {
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          console.log("[LiveLocation] Stopped background tracking");
        }
      } catch (err) {}
    }

    // Initialize or stop tracking based on sharing state
    setupLocationTracking();

    let friendSyncInterval: ReturnType<typeof setInterval>;
    if (locationSharingEnabled && user) {
      // Sync friend locations every 60 seconds when location sharing is active
      friendSyncInterval = setInterval(() => {
        useAppStore.getState().fetchInitialFriendLocations().catch(() => {});
      }, 60000);
    }

    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        if (locationSharingEnabled && user) {
          // Immediately perform one fresh current-position push
          performHeartbeat("foreground_resume");
          useAppStore.getState().fetchInitialFriendLocations().catch(() => {});
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      if (friendSyncInterval) clearInterval(friendSyncInterval);
      subscription.remove();
      // We don't stop background tracking here, just foreground watchers
      if (watcherSubscription.current) {
        watcherSubscription.current.remove();
        watcherSubscription.current = null;
      }
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
    };
  }, [locationSharingEnabled, user]);
}
