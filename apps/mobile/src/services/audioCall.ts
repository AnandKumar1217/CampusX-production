import { PermissionsAndroid, Platform } from "react-native";
import type { Socket } from "socket.io-client";
import type { MediaStream, RTCPeerConnection } from "react-native-webrtc";
import { useAppStore } from "@/store/appStore";

type Phase = "idle" | "calling" | "ringing" | "incoming" | "connecting" | "connected" |
  "declined" | "busy" | "unavailable" | "failed" | "ended";
export type AudioCallState = {
  phase: Phase;
  ownerId?: string;
  callId?: string;
  conversationId?: string;
  peerId?: string;
  name?: string;
  avatarUrl?: string;
  muted: boolean;
  connectedAt?: number;
  error?: string;
};

type Signal = { callId: string; kind: "offer" | "answer" | "ice"; data: any };
type Incoming = { callId: string; conversationId: string; caller: { id: string; name: string; avatarUrl?: string } };
type Ack = { ok: boolean; callId?: string; reason?: string };

const idle: AudioCallState = { phase: "idle", muted: false };
let state: AudioCallState = idle;
let socket: Socket | null = null;
let peer: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let preparePromise: Promise<RTCPeerConnection> | null = null;
let pendingIce: any[] = [];
let sequence = 0;
let resetTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(next: AudioCallState) => void>();

function publish(next: AudioCallState) {
  state = next;
  listeners.forEach((listener) => listener(next));
}
function update(patch: Partial<AudioCallState>) { publish({ ...state, ...patch }); }
function cleanMedia() {
  preparePromise = null;
  pendingIce = [];
  peer?.close();
  peer = null;
  localStream?.getTracks().forEach((track) => track.stop());
  localStream?.release();
  localStream = null;
}
function terminal(phase: Phase, error?: string) {
  ++sequence;
  cleanMedia();
  publish({ ...state, phase, muted: false, error });
  if (resetTimer) clearTimeout(resetTimer);
  resetTimer = setTimeout(() => { if (state.phase === phase) publish(idle); }, 3000);
}
function sendSignal(kind: Signal["kind"], data: any) {
  if (state.callId && socket?.connected) socket.emit("call:signal", { callId: state.callId, kind, data });
}
function iceServers() {
  const servers: { urls: string; username?: string; credential?: string }[] = [{ urls: "stun:stun.l.google.com:19302" }];
  const turn = process.env.EXPO_PUBLIC_TURN_URL;
  if (turn) servers.push({ urls: turn, username: process.env.EXPO_PUBLIC_TURN_USERNAME, credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL });
  return servers;
}
async function prepareMedia(expectedCallId: string): Promise<RTCPeerConnection> {
  if (peer) return peer;
  if (preparePromise) return preparePromise;
  preparePromise = (async () => {
    if (Platform.OS === "web") throw new Error("Audio calling requires the CampusX mobile app.");
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error("Microphone permission is required for an audio call.");
    }
    const rtc = await import("react-native-webrtc");
    const stream = await rtc.mediaDevices.getUserMedia({ audio: true, video: false });
    if (state.callId !== expectedCallId || !["connecting", "connected"].includes(state.phase)) {
      stream.getTracks().forEach((track) => track.stop());
      stream.release();
      throw new Error("Call ended");
    }
    const connection = new rtc.RTCPeerConnection({ iceServers: iceServers() });
    stream.getAudioTracks().forEach((track) => connection.addTrack(track, stream));
    (connection as any).addEventListener("icecandidate", (event: { candidate?: { toJSON: () => any } }) => {
      if (event.candidate) sendSignal("ice", event.candidate.toJSON());
    });
    (connection as any).addEventListener("connectionstatechange", () => {
      if (state.callId !== expectedCallId || !["connecting", "connected"].includes(state.phase)) return;
      if (connection.connectionState === "connected" && state.phase !== "connected") {
        update({ phase: "connected", connectedAt: Date.now() });
        socket?.emit("call:connected", { callId: expectedCallId });
      } else if (connection.connectionState === "failed") {
        socket?.emit("call:end", { callId: expectedCallId });
        terminal("failed", "Audio connection failed. Try again.");
      }
    });
    localStream = stream;
    peer = connection;
    return connection;
  })();
  try { return await preparePromise; }
  finally { preparePromise = null; }
}
async function flushIce() {
  if (!peer?.remoteDescription) return;
  const candidates = pendingIce;
  pendingIce = [];
  for (const candidate of candidates) {
    try { await peer.addIceCandidate(candidate); }
    catch (error) { console.warn("Call ICE candidate rejected", error); }
  }
}
async function handleSignal(signal: Signal) {
  if (signal.callId !== state.callId || !["connecting", "connected"].includes(state.phase)) return;
  if (signal.kind === "ice") {
    if (peer?.remoteDescription) {
      try { await peer.addIceCandidate(signal.data); }
      catch (error) { console.warn("Call ICE candidate rejected", error); }
    }
    else pendingIce.push(signal.data);
    return;
  }
  const connection = await prepareMedia(signal.callId);
  if (signal.callId !== state.callId) return;
  if (signal.kind === "offer") {
    await connection.setRemoteDescription(signal.data);
    await flushIce();
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    sendSignal("answer", answer);
  } else {
    await connection.setRemoteDescription(signal.data);
    await flushIce();
  }
}
function reasonState(reason?: string): Phase {
  if (reason === "busy") return "busy";
  if (reason === "declined") return "declined";
  if (reason === "unavailable") return "unavailable";
  return reason === "ended" ? "ended" : "failed";
}
function onIncoming(payload: Incoming) {
  if (!payload.callId || !payload.caller?.id) return;
  if (!["idle", "ended", "declined", "busy", "unavailable", "failed"].includes(state.phase)) {
    socket?.emit("call:decline", { callId: payload.callId });
    return;
  }
  if (resetTimer) clearTimeout(resetTimer);
  publish({ phase: "incoming", ownerId: useAppStore.getState().user?.id, callId: payload.callId, conversationId: payload.conversationId,
    peerId: payload.caller.id, name: payload.caller.name, avatarUrl: payload.caller.avatarUrl, muted: false });
}
async function onAccepted(payload: { callId: string }) {
  if (payload.callId !== state.callId || !["calling", "ringing"].includes(state.phase)) return;
  update({ phase: "connecting" });
  try {
    const connection = await prepareMedia(payload.callId);
    if (payload.callId !== state.callId) return;
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    sendSignal("offer", offer);
  } catch (error) {
    if (payload.callId !== state.callId) return;
    socket?.emit("call:end", { callId: payload.callId });
    terminal("failed", error instanceof Error ? error.message : "Microphone unavailable");
  }
}
function onEnded(payload: { callId: string; reason?: string }) {
  if (payload.callId === state.callId) terminal(reasonState(payload.reason), payload.reason === "failed" ? "Call could not connect." : undefined);
}
function onSignal(payload: Signal) {
  void handleSignal(payload).catch((error) => {
    if (payload.callId !== state.callId) return;
    socket?.emit("call:end", { callId: payload.callId });
    terminal("failed", error instanceof Error ? error.message : "Audio connection failed");
  });
}
function onDisconnect() {
  if (["incoming", "calling", "ringing", "connecting", "connected"].includes(state.phase)) terminal("failed", "Connection lost.");
}
function onElsewhere(payload: { callId: string }) {
  if (payload.callId === state.callId && state.phase === "incoming") terminal("ended");
}

export function subscribeAudioCall(listener: (next: AudioCallState) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getAudioCallState() { return state; }
export function bindAudioCallSocket(next: Socket | null) {
  if (socket === next) return;
  if (socket) {
    socket.off("call:incoming", onIncoming);
    socket.off("call:accepted", onAccepted);
    socket.off("call:signal", onSignal);
    socket.off("call:ended", onEnded);
    socket.off("call:answered-elsewhere", onElsewhere);
    socket.off("disconnect", onDisconnect);
    if (state.phase !== "idle") {
      ++sequence;
      cleanMedia();
      if (resetTimer) clearTimeout(resetTimer);
      publish(idle);
    }
  }
  socket = next;
  if (socket) {
    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:signal", onSignal);
    socket.on("call:ended", onEnded);
    socket.on("call:answered-elsewhere", onElsewhere);
    socket.on("disconnect", onDisconnect);
  }
}
export async function startAudioCall(input: { conversationId: string; peerId: string; name: string; avatarUrl?: string }) {
  if (!socket?.connected) {
    publish({ ...input, ownerId: useAppStore.getState().user?.id, phase: "unavailable", muted: false });
    return terminal("unavailable", "Connect to the internet to place a call.");
  }
  if (!["idle", "ended", "declined", "busy", "unavailable", "failed"].includes(state.phase)) return;
  if (resetTimer) clearTimeout(resetTimer);
  const startSequence = ++sequence;
  publish({ ...input, ownerId: useAppStore.getState().user?.id, phase: "calling", muted: false });
  const result = await new Promise<Ack>((resolve) => {
    const timeout = setTimeout(() => resolve({ ok: false, reason: "unavailable" }), 10000);
    socket!.emit("call:start", { conversationId: input.conversationId, peerId: input.peerId }, (ack: Ack) => {
      clearTimeout(timeout);
      resolve(ack);
    });
  });
  if (startSequence !== sequence) {
    if (result.callId) socket?.emit("call:end", { callId: result.callId });
    return;
  }
  if (!result.ok || !result.callId) return terminal(reasonState(result.reason));
  update({ callId: result.callId, phase: "ringing" });
}
export async function acceptAudioCall() {
  const callId = state.callId;
  if (state.phase !== "incoming" || !callId || !socket) return;
  update({ phase: "connecting" });
  const result = await new Promise<Ack>((resolve) => {
    const timeout = setTimeout(() => resolve({ ok: false, reason: "unavailable" }), 10000);
    socket!.emit("call:accept", { callId }, (ack: Ack) => { clearTimeout(timeout); resolve(ack); });
  });
  if (state.callId !== callId) return;
  if (!result.ok) return terminal(reasonState(result.reason));
  try { await prepareMedia(callId); }
  catch (error) {
    if (callId !== state.callId) return;
    socket.emit("call:end", { callId });
    terminal("failed", error instanceof Error ? error.message : "Microphone unavailable");
  }
}
export function endAudioCall() {
  const callId = state.callId;
  if (callId) socket?.emit(state.phase === "incoming" ? "call:decline" : "call:end", { callId });
  terminal("ended");
}
export function toggleAudioMute() {
  if (!localStream || state.phase !== "connected") return;
  const muted = !state.muted;
  localStream.getAudioTracks().forEach((track) => { track.enabled = !muted; });
  update({ muted });
}
