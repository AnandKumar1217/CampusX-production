import { io, type Socket } from "socket.io-client";
import { Platform } from "react-native";

let socket: Socket | null = null;

const defaultSocketUrl =
  Platform.OS === "android"
    ? "http://10.0.2.2:5000"
    : "http://localhost:5000";

export function connectSocket(token: string) {
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io(process.env.EXPO_PUBLIC_SOCKET_URL ?? defaultSocketUrl, {
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
