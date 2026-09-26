import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";

import { Server } from "socket.io";

import mongoose from "mongoose";

import { corsOptions } from "../config/cors.js";
import { Conversation } from "../models/Chat.js";
import { User } from "../models/User.js";
import { Friendship } from "../models/Social.js";
import { GroupMembership } from "../models/Group.js";
import { Trip, TripMember } from "../models/Trip.js";
import { verifyAccessToken } from "../services/tokenService.js";

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: corsOptions,
  });
  io.use(async (socket, next) => {
    try {
      const token = String(socket.handshake.auth.token ?? "");
      const payload = verifyAccessToken(token);
      if (payload.type !== "access" || !mongoose.isValidObjectId(payload.sub))
        throw new Error("Invalid access token");
      if (!await User.exists({ _id: payload.sub }))
        throw new Error("Account no longer exists");
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });
  type ActiveCall = {
    id: string;
    callerId: string;
    calleeId: string;
    callerSocketId: string;
    calleeSocketId?: string;
    conversationId: string;
    phase: "ringing" | "connecting" | "connected";
    connectedSockets: Set<string>;
    timeout: ReturnType<typeof setTimeout>;
  };
  const calls = new Map<string, ActiveCall>();
  const callByUser = new Map<string, string>();
  const finishCall = (call: ActiveCall, reason: string) => {
    if (!calls.has(call.id)) return;
    clearTimeout(call.timeout);
    calls.delete(call.id);
    callByUser.delete(call.callerId);
    callByUser.delete(call.calleeId);
    io.to(call.callerSocketId).emit("call:ended", { callId: call.id, reason });
    io.to(call.calleeSocketId || `user:${call.calleeId}`).emit("call:ended", { callId: call.id, reason });
  };
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
      conversations.map((conversation) => socket.join(`conversation:${conversation._id.toString()}`)),
    );
    const memberships = await GroupMembership.find({ user: userId, status: "active" }).select("group");
    await Promise.all(memberships.map(async (membership) => {
      const groupId = membership.group.toString();
      await socket.join(`group:${groupId}`);
      // Removal may race with this connection's initial room join.
      const stillActive = await GroupMembership.exists({ group: groupId, user: userId, status: "active" });
      if (!stillActive) await socket.leave(`group:${groupId}`);
    }));

    // Broadcast presence:changed to accepted friends and cross-device
    const relations = await Friendship.find({ users: userId });
    const acceptedFriendIds = relations.flatMap((r) => r.users).filter((id) => id.toString() !== userId);
    io.to(`user:${userId}`).emit("presence:changed", { userId, status: "online" });
    acceptedFriendIds.forEach((friendId) => {
      io.to(`user:${friendId.toString()}`).emit("presence:changed", { userId, status: "online" });
    });

    const getCanonicalVirtualRoom = (peerId: string) => {
      const sorted = [userId, peerId].sort();
      return `conversation:virtual-${sorted[0]}-${sorted[1]}`;
    };

    const handleVirtualTyping = async (
      event: "typing:start" | "typing:stop",
      conversationId: unknown,
    ) => {
      if (typeof conversationId !== "string") return;
      if (mongoose.isValidObjectId(conversationId)) {
        const allowed = await Conversation.exists({ _id: conversationId, participants: userId });
        if (allowed) socket.to(`conversation:${conversationId}`).emit(event, { conversationId, userId });
      } else if (conversationId.startsWith("conversation-")) {
        const peerId = conversationId.slice("conversation-".length);
        if (!mongoose.isValidObjectId(peerId) || peerId === userId) return;
        const allowed = await Friendship.exists({ users: { $all: [userId, peerId] } });
        if (allowed) socket.to(getCanonicalVirtualRoom(peerId)).emit(event, { conversationId: `conversation-${userId}`, userId });
      }
    };

    socket.on("typing:start", (payload: unknown) => void handleVirtualTyping("typing:start", (payload as any)?.conversationId));
    socket.on("typing:stop", (payload: unknown) => void handleVirtualTyping("typing:stop", (payload as any)?.conversationId));
    socket.on("group:join", async (payload: unknown) => {
      try {
        const groupId = (payload as any)?.groupId;
        if (typeof groupId !== "string" || !mongoose.isValidObjectId(groupId)) return;
        const isActive = await GroupMembership.exists({
          group: groupId,
          user: userId,
          status: "active"
        });
        if (isActive) {
          await socket.join(`group:${String(groupId)}`);
          const stillActive = await GroupMembership.exists({ group: groupId, user: userId, status: "active" });
          if (!stillActive) await socket.leave(`group:${String(groupId)}`);
        }
      } catch (err) {
        console.error("[Sockets] group:join error", err);
      }
    });

    socket.on("group:leave", (payload: unknown) => {
      const groupId = (payload as any)?.groupId;
      if (typeof groupId === "string" && mongoose.isValidObjectId(groupId)) void socket.leave(`group:${groupId}`);
    });
    socket.on("join:trip", async (payload: unknown) => {
      const id = String((payload as any)?.tripId ?? "");
      if (!mongoose.isValidObjectId(id)) return;
      const [membership, created] = await Promise.all([
        TripMember.exists({ trip: id, user: userId, status: { $in: ["invited", "accepted"] } }),
        Trip.exists({ _id: id, createdBy: userId }),
      ]);
      if (membership || created) {
        await socket.join(`trip:${id}`);
        const [stillMember, stillCreator] = await Promise.all([
          TripMember.exists({ trip: id, user: userId, status: { $in: ["invited", "accepted"] } }),
          Trip.exists({ _id: id, createdBy: userId }),
        ]);
        if (!stillMember && !stillCreator) await socket.leave(`trip:${id}`);
      }
    });
    socket.on("leave:trip", (payload: unknown) => {
      const id = String((payload as any)?.tripId ?? "");
      if (mongoose.isValidObjectId(id)) void socket.leave(`trip:${id}`);
    });
    socket.on("conversation:join", async (conversationId) => {
      try {
        if (!conversationId) return;

        const convIdStr = String(conversationId);
        if (mongoose.isValidObjectId(convIdStr)) {
          const isParticipant = await Conversation.exists({
            _id: convIdStr,
            participants: userId,
          });
          if (isParticipant) {
            await socket.join(`conversation:${convIdStr}`);
          }
        } else if (convIdStr.startsWith('conversation-')) {
          const peerId = convIdStr.slice('conversation-'.length);
          if (mongoose.isValidObjectId(peerId) && peerId !== userId) {
            const peerUser = await User.exists({ _id: peerId });
            if (peerUser) {
              const isFriend = await Friendship.exists({
                users: { $all: [userId, peerId] }
              });
              if (isFriend) {
                await socket.join(getCanonicalVirtualRoom(peerId));
              } else {
                console.log(`[Sockets] Friendship not found between ${userId} and ${peerId}`);
              }
            } else {
              console.log(`[Sockets] Peer not found: ${peerId}`);
            }
          }
        }
      } catch (err) {
        console.error("[Sockets] conversation:join error", err);
      }
    });
    socket.on("conversation:leave", (conversationId: unknown) => {
      if (typeof conversationId === "string" && mongoose.isValidObjectId(conversationId)) {
        void socket.leave(`conversation:${conversationId}`);
      }
    });
    socket.on("call:start", async (payload: unknown, ack?: (result: { ok: boolean; callId?: string; reason?: string }) => void) => {
      const reply = (result: { ok: boolean; callId?: string; reason?: string }) => { if (typeof ack === "function") ack(result); };
      try {
        const { conversationId, peerId } = (payload || {}) as { conversationId?: unknown; peerId?: unknown };
        if (typeof conversationId !== "string" || typeof peerId !== "string" ||
            !mongoose.isValidObjectId(conversationId) || !mongoose.isValidObjectId(peerId) || peerId === userId) {
          return reply({ ok: false, reason: "invalid" });
        }
        const [conversation, friendship, caller] = await Promise.all([
          Conversation.exists({ _id: conversationId, type: "direct", participants: { $all: [userId, peerId], $size: 2 } }),
          Friendship.exists({ users: { $all: [userId, peerId] } }),
          User.findById(userId).select("name avatarUrl"),
        ]);
        if (!conversation || !friendship || !caller) return reply({ ok: false, reason: "forbidden" });
        if (callByUser.has(userId) || callByUser.has(peerId)) return reply({ ok: false, reason: "busy" });
        const peerSockets = await io.in(`user:${peerId}`).fetchSockets();
        if (!peerSockets.length) return reply({ ok: false, reason: "unavailable" });
        if (callByUser.has(userId) || callByUser.has(peerId)) return reply({ ok: false, reason: "busy" });
        const id = randomUUID();
        const call: ActiveCall = {
          id, callerId: userId, calleeId: peerId, callerSocketId: socket.id, conversationId,
          phase: "ringing",
          connectedSockets: new Set(),
          timeout: setTimeout(() => {
            const pending = calls.get(id);
            if (pending?.phase === "ringing") finishCall(pending, "unavailable");
          }, 45000),
        };
        calls.set(id, call);
        callByUser.set(userId, id);
        callByUser.set(peerId, id);
        reply({ ok: true, callId: id });
        io.to(`user:${peerId}`).emit("call:incoming", {
          callId: id, conversationId,
          caller: { id: userId, name: caller.name, avatarUrl: caller.avatarUrl },
        });
      } catch (error) {
        console.error("[Sockets] call:start error", error);
        reply({ ok: false, reason: "failed" });
      }
    });
    socket.on("call:accept", async (payload: unknown, ack?: (result: { ok: boolean; reason?: string }) => void) => {
      const { callId } = (payload || {}) as { callId?: unknown };
      const call = typeof callId === "string" ? calls.get(callId) : undefined;
      if (!call || call.calleeId !== userId || call.phase !== "ringing") {
        if (typeof ack === "function") ack({ ok: false, reason: "unavailable" });
        return;
      }
      let stillFriends;
      try {
        stillFriends = await Friendship.exists({ users: { $all: [call.callerId, call.calleeId] } });
      } catch (error) {
        console.error("[Sockets] call:accept error", error);
        finishCall(call, "failed");
        if (typeof ack === "function") ack({ ok: false, reason: "failed" });
        return;
      }
      if (!stillFriends) {
        finishCall(call, "forbidden");
        if (typeof ack === "function") ack({ ok: false, reason: "forbidden" });
        return;
      }
      if (!calls.has(call.id) || call.phase !== "ringing") {
        if (typeof ack === "function") ack({ ok: false, reason: "unavailable" });
        return;
      }
      call.phase = "connecting";
      call.calleeSocketId = socket.id;
      clearTimeout(call.timeout);
      call.timeout = setTimeout(() => finishCall(call, "failed"), 60000);
      if (typeof ack === "function") ack({ ok: true });
      io.to(call.callerSocketId).emit("call:accepted", { callId: call.id });
      socket.to(`user:${userId}`).emit("call:answered-elsewhere", { callId: call.id });
    });
    socket.on("call:decline", (payload: unknown) => {
      const { callId } = (payload || {}) as { callId?: unknown };
      const call = typeof callId === "string" ? calls.get(callId) : undefined;
      if (call?.calleeId === userId && call.phase === "ringing") finishCall(call, "declined");
    });
    socket.on("call:signal", (payload: unknown) => {
      const { callId, kind, data } = (payload || {}) as { callId?: unknown; kind?: unknown; data?: unknown };
      const call = typeof callId === "string" ? calls.get(callId) : undefined;
      if (!call || (call.phase !== "connecting" && call.phase !== "connected") || !["offer", "answer", "ice"].includes(String(kind))) return;
      const senderIsCaller = socket.id === call.callerSocketId && userId === call.callerId;
      const senderIsCallee = socket.id === call.calleeSocketId && userId === call.calleeId;
      if (!senderIsCaller && !senderIsCallee) return;
      if ((kind === "offer" && !senderIsCaller) || (kind === "answer" && !senderIsCallee)) return;
      if (!data || typeof data !== "object" || JSON.stringify(data).length > 30000) return;
      const target = senderIsCaller ? call.calleeSocketId : call.callerSocketId;
      if (target) io.to(target).emit("call:signal", { callId: call.id, kind, data });
    });
    socket.on("call:connected", (payload: unknown) => {
      const { callId } = (payload || {}) as { callId?: unknown };
      const call = typeof callId === "string" ? calls.get(callId) : undefined;
      if (!call || call.phase !== "connecting") return;
      if (socket.id !== call.callerSocketId && socket.id !== call.calleeSocketId) return;
      call.connectedSockets.add(socket.id);
      if (call.connectedSockets.size === 2) {
        call.phase = "connected";
        clearTimeout(call.timeout);
      }
    });
    socket.on("call:end", (payload: unknown) => {
      const { callId } = (payload || {}) as { callId?: unknown };
      const call = typeof callId === "string" ? calls.get(callId) : undefined;
      if (call && (socket.id === call.callerSocketId || socket.id === call.calleeSocketId)) finishCall(call, "ended");
    });
    socket.on("disconnect", async () => {
      const activeCallId = callByUser.get(userId);
      const activeCall = activeCallId ? calls.get(activeCallId) : undefined;
      if (activeCall && (activeCall.callerSocketId === socket.id || activeCall.calleeSocketId === socket.id)) finishCall(activeCall, "ended");
      const remainingSockets = await io.in(`user:${userId}`).fetchSockets();
      if (remainingSockets.length > 0) return;
      await User.updateOne(
        { _id: userId },
        { $set: { online: false, lastSeenAt: new Date() } },
      );

      const relations = await Friendship.find({ users: userId });
      const acceptedFriendIds = relations.flatMap((r) => r.users).filter((id) => id.toString() !== userId);
      const lastSeenAt = new Date();
      io.to(`user:${userId}`).emit("presence:changed", { userId, status: "offline", lastSeenAt });
      acceptedFriendIds.forEach((friendId) => {
        io.to(`user:${friendId.toString()}`).emit("presence:changed", { userId, status: "offline", lastSeenAt });
      });
    });
  });
  return io;
}
