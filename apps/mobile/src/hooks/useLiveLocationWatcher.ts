import { useEffect, useRef } from "react";
import * as Location from "expo-location";
import { AppState, AppStateStatus } from "react-native";
import { useAppStore } from "../store/appStore";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { claimLocationRefreshRequest } from "../utils/locationRefreshDedup";

export function useLiveLocationWatcher() {
  const locationSharingEnabled = useAppStore((state) => state.locationSharingEnabled);
  const user = useAppStore((state) => state.user);
  const inFlight = useRef(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // We do not start any continuous tracking here anymore.
    // The old BACKGROUND_LOCATION_TASK is stopped during locationTask.ts initialization.

    // 1. Listen for on-demand location refresh requests via socket when the app is active
    const socket = getSocket();
    
    const handleRefreshRequest = async (payload: any) => {
      // payload = { requestId, requesterId }
      if (!payload?.requestId) return;
      
      const isEnabled = useAppStore.getState().locationSharingEnabled;
      if (!isEnabled || !user) return;

      if (appState.current !== "active") {
        // If backgrounded, the push notification task handles this
        return;
      }

      const canClaim = await claimLocationRefreshRequest(payload.requestId);
      if (!canClaim) return;

      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;

        console.log(`[LiveLocation] Socket requested refresh ${payload.requestId}`);
        const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        
        if (currentLoc) {
          await api.post("/location/position", {
            latitude: currentLoc.coords.latitude,
            longitude: currentLoc.coords.longitude,
            accuracy: currentLoc.coords.accuracy,
            heading: currentLoc.coords.heading,
            speed: currentLoc.coords.speed,
            source: "on_demand",
            requestId: payload.requestId,
          });
          useAppStore.getState().setLocationCoords({ lat: currentLoc.coords.latitude, lon: currentLoc.coords.longitude });
        }
      } catch (err) {
        console.error("[LiveLocation] Failed on-demand push via socket:", err);
      }
    };

    if (socket) {
      socket.on("location:refresh_request", handleRefreshRequest);
    }

    // 2. Fetch fresh friends location on foreground resume
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        if (user) {
          // When user foregrounds the app, simply grab the latest known locations from backend.
          // Note: we do NOT force a location update of our own just because we foregrounded.
          useAppStore.getState().fetchInitialFriendLocations().catch(() => {});
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      if (socket) {
        socket.off("location:refresh_request", handleRefreshRequest);
      }
      subscription.remove();
    };
  }, [locationSharingEnabled, user]);
}
