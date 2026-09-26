import { io, type Socket } from "socket.io-client";
import { requireServiceUrl } from "@/config/runtimeEnvironment";

let socket: Socket | null = null;

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
    transports: ["websocket"],
    auth: { token },
    reconnection: true,
  });
  return socket;
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
