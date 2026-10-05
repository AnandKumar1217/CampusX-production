import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider , focusManager } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { LogBox, AppState, AppStateStatus, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppNavigator } from "@/navigation/AppNavigator";
import { AudioCallOverlay } from "@/components/calls/AudioCallOverlay";
import { queryClient } from "@/query/queryClient";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAppStore } from "@/store/appStore";
import { useEffect } from "react";
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

  useEffect(() => {
    if (!accessToken || !userId) return;
    let cancelled = false;
    registerForPushNotificationsAsync().then((token) => {
      if (token && !cancelled && useAppStore.getState().accessToken === accessToken && useAppStore.getState().user?.id === userId) {
        return registerToken(token);
      }
    }).catch((err) => console.log("Push init error:", err));
    return () => { cancelled = true; };
  }, [accessToken, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, []);

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
