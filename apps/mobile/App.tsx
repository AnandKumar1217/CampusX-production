import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { LogBox, AppState, AppStateStatus, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect, useRef, useCallback } from "react";

import { AppNavigator } from "@/navigation/AppNavigator";
import { AudioCallOverlay } from "@/components/calls/AudioCallOverlay";
import { queryClient } from "@/query/queryClient";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAppStore } from "@/store/appStore";
import "@/services/locationTask";

LogBox.ignoreLogs([
  "Non-serializable values were found in the navigation state",
]);

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

export default function App() {
  const accessToken = useAppStore(state => state.accessToken);
  const userId = useAppStore(state => state.user?.id);
  const { registerForPushNotificationsAsync, registerToken } = usePushNotifications();

  /**
   * Attempt push registration once we have a logged-in user.
   * registerToken internally deduplicates so this is safe to call
   * multiple times — it will only POST to the backend when the token
   * changes or a new session starts.
   */
  const tryRegisterPush = useCallback(async (currentAccessToken: string | null, currentUserId: string | undefined) => {
    if (!currentAccessToken || !currentUserId) return;
    const token = await registerForPushNotificationsAsync();
    // Guard: make sure this session is still valid before registering
    if (
      token &&
      useAppStore.getState().accessToken === currentAccessToken &&
      useAppStore.getState().user?.id === currentUserId
    ) {
      await registerToken(token);
    }
  }, [registerForPushNotificationsAsync, registerToken]);

  // Register on login / user change
  useEffect(() => {
    let cancelled = false;
    tryRegisterPush(accessToken, userId).catch((err) => {
      if (!cancelled) console.log("[push] Init error:", err);
    });
    return () => { cancelled = true; };
  }, [accessToken, userId, tryRegisterPush]);

  // Reconcile push registration when the app returns to foreground.
  // This ensures the token remains registered after OS kills / recoveries.
  // Production-only: __DEV__ guard is inside registerForPushNotificationsAsync.
  useEffect(() => {
    let lastState = AppState.currentState;

    const subscription = AppState.addEventListener("change", (nextStatus: AppStateStatus) => {
      // Handle React Query focus management
      if (Platform.OS !== "web") {
        focusManager.setFocused(nextStatus === "active");
      }

      // Reconcile push token when coming back to foreground
      if (lastState !== "active" && nextStatus === "active") {
        tryRegisterPush(
          useAppStore.getState().accessToken,
          useAppStore.getState().user?.id
        ).catch((err) => console.log("[push] Foreground reconcile error:", err));
      }
      lastState = nextStatus;
    });

    return () => subscription.remove();
  }, [tryRegisterPush]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <BottomSheetModalProvider>
              <StatusBar style="dark" translucent backgroundColor="transparent" />
              <AppNavigator />
              <AudioCallOverlay />
            </BottomSheetModalProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
