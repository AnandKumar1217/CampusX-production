import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { CXAvatar, CXText } from "@/components/ui";
import {
  acceptAudioCall, bindAudioCallSocket, endAudioCall, getAudioCallState,
  subscribeAudioCall, toggleAudioMute,
} from "@/services/audioCall";
import { useAppStore } from "@/store/appStore";
import { colors, spacing } from "@/theme";

const phaseLabel = {
  idle: "", calling: "Calling...", ringing: "Ringing...", incoming: "Incoming audio call",
  connecting: "Connecting audio...", connected: "Connected", declined: "Call declined",
  busy: "User is busy", unavailable: "User unavailable", failed: "Call failed", ended: "Call ended",
};

export function AudioCallOverlay() {
  const boundSocket = useAppStore((state) => state.boundSocketInstance);
  const userId = useAppStore((state) => state.user?.id);
  const [call, setCall] = useState(getAudioCallState);
  const [now, setNow] = useState(Date.now());

  useEffect(() => subscribeAudioCall(setCall), []);
  useEffect(() => {
    bindAudioCallSocket(boundSocket ?? null);
    return () => bindAudioCallSocket(null);
  }, [boundSocket]);
  useEffect(() => {
    if (call.phase !== "connected") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [call.phase]);

  const seconds = call.connectedAt ? Math.max(0, Math.floor((now - call.connectedAt) / 1000)) : 0;
  const duration = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const active = ["incoming", "calling", "ringing", "connecting", "connected"].includes(call.phase);

  return (
    <Modal visible={!!userId && call.ownerId === userId && call.phase !== "idle"} animationType="fade" transparent onRequestClose={endAudioCall}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.avatarRing}><CXAvatar name={call.name || "CampusX user"} source={call.avatarUrl} size={96} /></View>
          <CXText variant="h2" color={colors.white} style={styles.name}>{call.name || "Audio call"}</CXText>
          <CXText variant="body" color="#D9D2EF" style={styles.status}>
            {call.phase === "connected" ? duration : phaseLabel[call.phase]}
          </CXText>
          {!!call.error && <CXText variant="small" color="#FFD2D2" style={styles.error}>{call.error}</CXText>}
          <View style={styles.actions}>
            {call.phase === "connected" && (
              <Pressable onPress={toggleAudioMute} style={styles.secondary} accessibilityRole="button" accessibilityLabel={call.muted ? "Unmute microphone" : "Mute microphone"}>
                <Ionicons name={call.muted ? "mic-off" : "mic"} size={25} color={colors.white} />
                <CXText variant="caption" color={colors.white}>{call.muted ? "Unmute" : "Mute"}</CXText>
              </Pressable>
            )}
            {call.phase === "incoming" && (
              <Pressable onPress={() => void acceptAudioCall()} style={[styles.callButton, styles.accept]} accessibilityRole="button" accessibilityLabel="Accept audio call">
                <Ionicons name="call" size={28} color={colors.white} />
              </Pressable>
            )}
            <Pressable onPress={endAudioCall} style={[styles.callButton, styles.hangup]} accessibilityRole="button" accessibilityLabel={call.phase === "incoming" ? "Decline audio call" : active ? "End audio call" : "Close call"}>
              <Ionicons name="call" size={28} color={colors.white} style={{ transform: [{ rotate: "135deg" }] }} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(17, 12, 38, 0.9)", justifyContent: "center", padding: spacing.xl },
  card: { minHeight: 350, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  avatarRing: { padding: 7, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.12)" },
  name: { textAlign: "center", marginTop: spacing.md },
  status: { textAlign: "center" },
  error: { textAlign: "center", marginTop: spacing.sm },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xl, marginTop: spacing.xxxl },
  callButton: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  accept: { backgroundColor: colors.success },
  hangup: { backgroundColor: colors.danger },
  secondary: { width: 64, alignItems: "center", justifyContent: "center", gap: 4 },
});
