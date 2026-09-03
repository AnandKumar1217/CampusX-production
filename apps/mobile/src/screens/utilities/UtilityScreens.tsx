import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  Alert,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

import {
  CXAvatar,
  CXButton,
  CXCard,
  CXChip,
  CXHeader,
  CXIconButton,
  CXListRow,
  CXRow,
  CXScreen,
  CXScrollScreen,
  CXSectionHeader,
  CXText,
} from "@/components/ui";

import { api } from "@/services/api";
import { useAppStore } from "@/store/appStore";
import { colors, gradients, radius, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;

type NotificationItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  time: string;
  unread: boolean;
  route: keyof RootStackParamList | "Chats";
};

const notifications: NotificationItem[] = [
  {
    id: "n1",
    icon: "person-add-outline",
    color: "#6338F2",
    title: "Ananya Iyer accepted your friend request.",
    time: "2m ago",
    unread: true,
    route: "Friends",
  },
  {
    id: "n2",
    icon: "people-outline",
    color: "#3B82F6",
    title: "CSE AIML 2026 group posted a new announcement.",
    time: "15m ago",
    unread: true,
    route: "StudyGroups",
  },
  {
    id: "n3",
    icon: "chatbubble-outline",
    color: "#22C55E",
    title: "Rohit Verma sent you a message.",
    time: "25m ago",
    unread: true,
    route: "Chats",
  },
  {
    id: "n4",
    icon: "airplane-outline",
    color: "#F59E0B",
    title: "Manali Trip dates have been updated.",
    time: "1h ago",
    unread: false,
    route: "Trips",
  },
  {
    id: "n5",
    icon: "at-outline",
    color: "#EC4899",
    title: "Neha Kapoor mentioned you in a post.",
    time: "2h ago",
    unread: false,
    route: "Feed",
  },
  {
    id: "n6",
    icon: "ticket-outline",
    color: "#A855F7",
    title: "CodeX Club: event reminder — Hackathon 2025.",
    time: "Yesterday",
    unread: false,
    route: "Events",
  },
];

export function NotificationsScreen({
  navigation,
}: StackProps<"Notifications">) {
  const [items, setItems] = useState(
    notifications.map((item) => ({ ...item })),
  );
  const [activeFilter, setActiveFilter] = useState<"All" | "Unread" | "Mentions" | "Other">("All");
  const markAll = () => {
    setItems((value) => value.map((item) => ({ ...item, unread: false })));
    void api.patch("/notifications/read-all").catch(() => undefined);
  };
  return (
    <CXScreen>
      <CXHeader
        title="Notifications"
        onBack={navigation.goBack}
        right={
          <CXRow>
            <CXIconButton
              icon="checkmark-done-outline"
              label="Mark all read"
              backgroundColor={colors.transparent}
              onPress={markAll}
            />
            <CXIconButton
              icon="settings-outline"
              label="Notification settings"
              backgroundColor={colors.transparent}
              onPress={() => navigation.navigate("Settings")}
            />
          </CXRow>
        }
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXRow style={styles.filters}>
          {(["All", "Unread", "Mentions", "Other"] as const).map((f) => (
            <Pressable key={f} onPress={() => setActiveFilter(f)}>
              <CXChip label={f} active={activeFilter === f} />
            </Pressable>
          ))}
        </CXRow>
        <CXSectionHeader title={activeFilter === "All" ? "New" : activeFilter} />
        {items.filter((item) => {
          if (activeFilter === "Unread") return item.unread;
          if (activeFilter === "Mentions") return item.icon === "at-outline";
          if (activeFilter === "Other") return item.icon !== "at-outline";
          return true; // "All"
        }).map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              setItems((value) =>
                value.map((entry) =>
                  entry.id === item.id ? { ...entry, unread: false } : entry,
                ),
              );
              if (item.route === "Chats")
                navigation.navigate("Main", { screen: "Chats" });
              else navigation.navigate(item.route as never);
            }}
          >
            <CXRow
              style={[
                styles.notification,
                item.unread && styles.notificationUnread,
              ]}
            >
              <View
                style={[
                  styles.notificationIcon,
                  { backgroundColor: `${item.color}18` },
                ]}
              >
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <View style={styles.flex}>
                <CXText variant={item.unread ? "bodyStrong" : "body"}>
                  {item.title}
                </CXText>
                <CXText variant="caption" color={colors.textMuted}>
                  {item.time}
                </CXText>
              </View>
              {item.unread ? <View style={styles.unreadDot} /> : null}
            </CXRow>
          </Pressable>
        ))}
      </ScrollView>
    </CXScreen>
  );
}

export function MyQRScreen({ navigation }: StackProps<"MyQR">) {
  const user = useAppStore((state) => state.user);
  const value = `campusx://user/${user?.id || "unknown"}`;
  return (
    <CXScrollScreen>
      <CXHeader
        title="My QR Code"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="share-social-outline"
            label="Share QR"
            backgroundColor={colors.transparent}
            onPress={() =>
              void Share.share({
                message: `Connect with ${user?.name || "someone"} on CampusX: ${value}`,
              })
            }
          />
        }
      />
      <LinearGradient colors={gradients.primaryStrong} style={styles.qrCard}>
        <CXRow>
          <Ionicons name="school" size={22} color={colors.white} />
          <CXText variant="title" color={colors.white}>
            CampusX
          </CXText>
        </CXRow>
        <CXText variant="h2" color={colors.white}>
          {user?.name || "CampusX User"}
        </CXText>
        <CXText variant="small" color="#EDE9FF">
          @{user?.username || "user"}
        </CXText>
        <View style={styles.qrWrap}>
          <QRCode
            value={value}
            size={210}
            color={colors.primaryDark}
            backgroundColor={colors.white}
            quietZone={12}
          />
        </View>
        <CXText color={colors.white} align="center">
          Scan to connect with me on CampusX
        </CXText>
        <CXRow style={[styles.qrActions, { justifyContent: "center", gap: spacing.md }]}>
          <CXButton
            label="Share QR"
            iconLeft="share-social-outline"
            variant="secondary"
            fullWidth={false}
            onPress={() =>
              void Share.share({
                message: `Connect with ${user?.name || "someone"} on CampusX: ${value}`,
              })
            }
          />
          <CXButton
            label="Download"
            iconLeft="download-outline"
            variant="secondary"
            fullWidth={false}
            onPress={() =>
              Alert.alert(
                "Save QR Code",
                "Take a screenshot to save your QR code. Direct download is coming soon!"
              )
            }
          />
        </CXRow>
      </LinearGradient>
      <CXButton
        label="Scan Someone’s QR"
        iconLeft="scan-outline"
        variant="outline"
        onPress={() => navigation.navigate("QRScanner")}
      />
      <CXCard style={styles.info}>
        <Ionicons
          name="shield-checkmark-outline"
          size={24}
          color={colors.primary}
        />
        <CXText color={colors.textMuted} style={styles.flex}>
          Your QR contains only a safe CampusX profile link. It never includes
          your email, password, or private account data.
        </CXText>
      </CXCard>
    </CXScrollScreen>
  );
}

export function QRScannerScreen({ navigation }: StackProps<"QRScanner">) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scan = ({ data }: { data: string }) => {
    if (locked) return;
    setLocked(true);
    if (!data.startsWith("campusx://user/")) {
      setError("This is not a valid CampusX user QR code.");
      setTimeout(() => {
        setLocked(false);
        setError(null);
      }, 1800);
      return;
    }
    const userId = data.replace("campusx://user/", "");
    if (userId === useAppStore.getState().user?.id) {
      setError("This is your own CampusX QR code.");
      setTimeout(() => setLocked(false), 1800);
      return;
    }
    navigation.replace("UserProfile", { userId });
  };
  if (!permission)
    return (
      <CXScreen>
        <CXText>Checking camera permission…</CXText>
      </CXScreen>
    );
  if (!permission.granted)
    return (
      <CXScreen padded>
        <CXHeader title="Scan QR Code" onBack={navigation.goBack} />
        <View style={styles.permission}>
          <Ionicons name="camera-outline" size={46} color={colors.primary} />
          <CXText variant="h3" align="center">
            Camera permission required
          </CXText>
          <CXText color={colors.textMuted} align="center">
            CampusX needs camera access only while scanning a QR code.
          </CXText>
          <CXButton
            label="Allow Camera"
            onPress={() => void requestPermission()}
          />
        </View>
      </CXScreen>
    );
  return (
    <CXScreen edges={[]} backgroundColor="#080711">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={locked ? undefined : scan}
      />
      <View style={styles.scanOverlay}>
        <CXRow style={styles.scanHeader}>
          <CXIconButton
            icon="chevron-back"
            label="Go back"
            color={colors.white}
            backgroundColor="rgba(0,0,0,.4)"
            onPress={navigation.goBack}
          />
          <CXText variant="h3" color={colors.white} style={styles.flex}>
            Scan QR Code
          </CXText>
          <CXIconButton
            icon="image-outline"
            label="Choose QR image"
            color={colors.white}
            backgroundColor="rgba(0,0,0,.4)"
          />
        </CXRow>
        <View style={styles.scanner}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          <View style={styles.scanLine} />
        </View>
        <CXText color={colors.white} align="center">
          Position the QR code within the frame to scan
        </CXText>
        {error ? (
          <View style={styles.scanError}>
            <CXText color={colors.white} align="center">
              {error}
            </CXText>
          </View>
        ) : null}
        <CXRow style={styles.scanTools}>
          <CXIconButton
            icon="flash-outline"
            label="Flash"
            color={colors.white}
            backgroundColor="rgba(0,0,0,.35)"
          />
          <CXIconButton
            icon="refresh-outline"
            label="Flip camera"
            color={colors.white}
            backgroundColor="rgba(0,0,0,.35)"
          />
          <CXIconButton
            icon="scan-outline"
            label="Auto focus"
            color={colors.white}
            backgroundColor="rgba(0,0,0,.35)"
          />
        </CXRow>
      </View>
    </CXScreen>
  );
}

export function SettingsScreen({ navigation }: StackProps<"Settings">) {
  const user = useAppStore((state) => state.user);
  const clearSession = useAppStore((state) => state.clearSession);
  const logout = async () => {
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };
  return (
    <CXScrollScreen>
      <CXHeader title="Settings" onBack={navigation.goBack} />
      <CXRow style={styles.settingsUser}>
        <CXAvatar
          source={user?.avatarUrl}
          name={user?.name || "User"}
          size={56}
        />
        <View style={styles.flex}>
          <CXText variant="bodyStrong">{user?.name || "CampusX User"}</CXText>
          <CXText variant="caption" color={colors.textMuted}>
            @{user?.username || "user"}
          </CXText>
          <Pressable>
            <CXText variant="smallStrong" color={colors.primary}>
              View Profile
            </CXText>
          </Pressable>
        </View>
      </CXRow>
      <CXSectionHeader title="Account" />
      <CXCard style={styles.settingsCard}>
        <CXListRow icon="person-outline" title="Edit Profile" />
        <CXListRow
          icon="shield-checkmark-outline"
          title="Privacy & Security"
          onPress={() => navigation.navigate("GhostMode")}
        />
        <CXListRow
          icon="notifications-outline"
          title="Notifications"
          onPress={() => navigation.navigate("Notifications")}
        />
        <CXListRow
          icon="location-outline"
          title="Location Settings"
          onPress={() => navigation.navigate("LocationSettings")}
        />
        <CXListRow
          icon="language-outline"
          title="Language"
          right={
            <CXText variant="small" color={colors.textMuted}>
              English
            </CXText>
          }
        />
      </CXCard>
      <CXSectionHeader title="Support" />
      <CXCard style={styles.settingsCard}>
        <CXListRow icon="help-circle-outline" title="Help & Support" />
        <CXListRow
          icon="information-circle-outline"
          title="About CampusX"
          subtitle="Version 1.0.0"
        />
      </CXCard>
      <CXButton
        label="Logout"
        iconLeft="log-out-outline"
        variant="outline"
        onPress={() => void logout()}
      />
    </CXScrollScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  filters: { gap: spacing.xs },
  notification: {
    minHeight: 72,
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  notificationUnread: { backgroundColor: colors.backgroundLavender },
  notificationIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  qrCard: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  qrWrap: {
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: spacing.sm,
    marginVertical: spacing.sm,
  },
  qrActions: { gap: spacing.sm },
  info: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.backgroundLavender,
  },
  permission: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  scanOverlay: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 48,
    paddingBottom: 38,
    justifyContent: "space-between",
  },
  scanHeader: { gap: spacing.sm },
  scanner: {
    alignSelf: "center",
    width: 284,
    height: 284,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,.1)",
  },
  corner: {
    position: "absolute",
    width: 58,
    height: 58,
    borderColor: "#8C52FF",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 24,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 24,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 24,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 24,
  },
  scanLine: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "50%",
    height: 3,
    borderRadius: 2,
    backgroundColor: "#A66CFF",
    shadowColor: "#A66CFF",
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  scanError: {
    alignSelf: "center",
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: "rgba(239,68,68,.82)",
  },
  scanTools: { justifyContent: "space-around" },
  settingsUser: { gap: spacing.sm },
  settingsCard: { paddingVertical: spacing.xs },
});
