import type { Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import { env } from "../config/env.js";
import { Conversation } from "../models/Chat.js";
import { User } from "../models/User.js";
import { verifyAccessToken } from "../services/tokenService.js";

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
  });
  io.use((socket, next) => {
    try {
      const token = String(socket.handshake.auth.token ?? "");
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });
  io.on("connection", async (socket) => {
    const userId = String(socket.data.userId);
    await socket.join(`user:${userId}`);
    await User.updateOne(
      { _id: userId },
      { $set: { online: true, lastSeenAt: new Date() } },
    );
    const conversations = await Conversation.find({
      participants: userId,
    }).select("_id");
    await Promise.all(
      conversations.map((conversation) =>
        socket.join(`conversation:${conversation._id.toString()}`),
      ),
    );
    socket.broadcast.emit("user:online", { userId });
    socket.on("typing:start", ({ conversationId }) =>
      socket
        .to(`conversation:${String(conversationId)}`)
        .emit("typing:start", { conversationId, userId }),
    );
    socket.on("typing:stop", ({ conversationId }) =>
      socket
        .to(`conversation:${String(conversationId)}`)
        .emit("typing:stop", { conversationId, userId }),
    );
    socket.on(
      "join:group",
      ({ groupId }) => void socket.join(`group:${String(groupId)}`),
    );
    socket.on(
      "join:trip",
      ({ tripId }) => void socket.join(`trip:${String(tripId)}`),
    );
    socket.on("disconnect", async () => {
      await User.updateOne(
        { _id: userId },
        { $set: { online: false, lastSeenAt: new Date() } },
      );
      socket.broadcast.emit("user:offline", { userId, lastSeenAt: new Date() });
    });
  });
  return io;
}
