import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppNavigator } from "@/navigation/AppNavigator";
import { queryClient } from "@/query/queryClient";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAppStore } from "@/store/appStore";
import { useEffect } from "react";

LogBox.ignoreLogs([
  "Non-serializable values were found in the navigation state",
]);

export default function App() {
  const { accessToken } = useAppStore();
  const { registerForPushNotificationsAsync, registerToken, unregisterToken } = usePushNotifications();

  useEffect(() => {
    if (accessToken) {
      registerForPushNotificationsAsync().then((token) => {
        if (token) registerToken(token);
      });
    }
    // We don't automatically unregister on logout here because we might not have the token anymore,
    // but we can let the backend handle expired/invalid tokens, or we could store the push token in app store.
  }, [accessToken]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" translucent backgroundColor="transparent" />
        <AppNavigator />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
