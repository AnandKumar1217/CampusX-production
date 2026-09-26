import { useEffect, useRef } from "react";
import * as Location from "expo-location";
import { useAppStore } from "@/store/appStore";
import { api } from "@/services/api";

export function useLiveLocationWatcher() {
  const locationSharingEnabled = useAppStore((state) => state.locationSharingEnabled);
  const watcherSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    async function startWatching() {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("[LiveLocation] Permission not granted, cannot start watcher.");
          return;
        }

        // Push initial location immediately
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        await pushLocation(initial);

        // Start watcher for meaningful movement (e.g. 20 meters or every 15s)
        watcherSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 60000,
            distanceInterval: 20,
          },
          (loc) => {
            pushLocation(loc);
          }
        );
      } catch (err) {
        console.error("[LiveLocation] Failed to start watcher:", err);
      }
    }

    async function pushLocation(loc: Location.LocationObject) {
      try {
        await api.post("/location/position", {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        useAppStore.getState().setLocationCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      } catch (err) {
        console.error("[LiveLocation] Failed to push position:", err);
      }
    }

    if (locationSharingEnabled) {
      startWatching();
    } else {
      if (watcherSubscription.current) {
        watcherSubscription.current.remove();
        watcherSubscription.current = null;
      }
    }

    return () => {
      if (watcherSubscription.current) {
        watcherSubscription.current.remove();
        watcherSubscription.current = null;
      }
    };
  }, [locationSharingEnabled]);
}
