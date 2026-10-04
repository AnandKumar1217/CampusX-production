import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "@/types/navigation";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pendingRoute: { screen: keyof RootStackParamList; params?: any } | null = null;
let hasProcessedColdStart = false;

export const setPendingRoute = (screen: keyof RootStackParamList, params?: any) => {
  pendingRoute = { screen, params };
};

export const consumePendingRoute = () => {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
};

export const markColdStartProcessed = () => {
  hasProcessedColdStart = true;
};

export const isColdStartProcessed = () => {
  return hasProcessedColdStart;
};

export const handleNotification = (data: any) => {
  if (!data || !data.route) return;
  let screen = data.route as keyof RootStackParamList;
  if (screen as string === "FriendRequests") {
    screen = "People" as keyof RootStackParamList;
  }
  if (screen as string === "PostDetail") {
    screen = "PostDetails" as keyof RootStackParamList;
  }
  if (screen as string === "Message" || screen as string === "Chat") {
    screen = "Conversation" as keyof RootStackParamList;
  }
  const params = screen === "Conversation"
    ? { conversationId: data.params?.conversationId, source: "notification" }
    : data.params;

  if (screen === "Conversation" && !params.conversationId) return;

  if (navigationRef.isReady()) {
    // If navigation is ready, push/navigate immediately
    // @ts-ignore
    navigationRef.navigate(screen, params);
  } else {
    // Otherwise, store it for when navigation container is ready
    setPendingRoute(screen, params);
  }
};
