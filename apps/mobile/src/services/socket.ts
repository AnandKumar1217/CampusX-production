import { io, type Socket } from "socket.io-client";
import { requireServiceUrl } from "@/config/runtimeEnvironment";

let socket: Socket | null = null;
type SocketEventHandler = (...args: any[]) => void;
const subscriptions = new Map<string, Set<SocketEventHandler>>();

const configuredSocketUrl = requireServiceUrl(
  "EXPO_PUBLIC_SOCKET_URL",
  process.env.EXPO_PUBLIC_SOCKET_URL,
);

export function connectSocket(token: string) {
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io(configuredSocketUrl, {
    auth: { token },
    reconnection: true,
  });

  if (__DEV__) {
    console.info("[SOCKET_INIT]", {
      url: configuredSocketUrl,
      hasToken: !!token,
    });
    
    socket.on("connect", () => {
      console.info("[SOCKET_CONNECTED]", { socketId: socket?.id });
    });
    
    socket.on("connect_error", (error) => {
      console.error("[SOCKET_CONNECT_ERROR]", { message: error.message });
    });
    
    socket.on("disconnect", (reason) => {
      console.warn("[SOCKET_DISCONNECTED]", { reason });
    });
    
    socket.io.on("reconnect_attempt", () => {
      console.info("[SOCKET_RECONNECT_ATTEMPT]");
    });
    
    socket.io.on("reconnect", () => {
      console.info("[SOCKET_RECONNECTED]", { socketId: socket?.id });
    });
  }

  for (const [event, handlers] of subscriptions) {
    for (const handler of handlers) socket.on(event, handler);
  }
  return socket;
}

/**
 * Subscribes through the shared authenticated socket even when the socket is
 * created after the calling screen mounts (for example, notification entry).
 */
export function subscribeSocketEvent(event: string, handler: SocketEventHandler) {
  let handlers = subscriptions.get(event);
  if (!handlers) {
    handlers = new Set();
    subscriptions.set(event, handlers);
  }
  handlers.add(handler);
  socket?.on(event, handler);

  return () => {
    subscriptions.get(event)?.delete(handler);
    if (subscriptions.get(event)?.size === 0) subscriptions.delete(event);
    socket?.off(event, handler);
  };
}

export function emitSocketEvent(event: string, ...args: any[]) {
  socket?.emit(event, ...args);
}

export function updateSocketAuthToken(token: string) {
  if (socket) socket.auth = { token };
}

export function disconnectSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}
