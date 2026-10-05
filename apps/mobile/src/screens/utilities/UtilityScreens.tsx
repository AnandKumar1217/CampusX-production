import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  Alert,
  ActivityIndicator,
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
  CXBottomActionArea,
} from "@/components/ui";

import { api } from "@/services/api";
import { useAppStore } from "@/store/appStore";
import { colors, gradients, radius, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";
import type { Notification } from "@/types/domain";
import { handleNotification } from "@/navigation/PushRoutingManager";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;

export function NotificationsScreen({
  navigation,
}: StackProps<"Notifications">) {
  const queryClient = useQueryClient();
  const fetchUnreadNotifications = useAppStore((state) => state.fetchUnreadNotifications);
  const [activeFilter, setActiveFilter] = useState<string>("All");

  const userId = useAppStore((state) => state.user?.id);
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["notifications", userId, activeFilter],
    enabled: !!userId,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await api.get("/notifications", { 
        params: { page: pageParam, limit: 20, filter: activeFilter } 
      });
      return res.data.data as { items: Notification[]; page: number; limit: number; total: number };
    },
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
  });
  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const filteredItems = items;

  useFocusEffect(React.useCallback(() => {
    if (userId) void refetch();
  }, [refetch, userId]));

  const markAll = async () => {
    try {
      await api.patch("/notifications/read-all");
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      void fetchUnreadNotifications();
    } catch {
      Alert.alert("Couldn't update notifications", "Please try again.");
    }
  };

  const openTarget = (item: Notification) => {
    if (!item.target || !item.target.route) {
      Alert.alert("Content unavailable", "This notification has no available destination.");
      return;
    }
    handleNotification(item.target);
  };
  const getIcon = (type: string) => {
    if (type.startsWith("friend") || type.includes("request") || type.includes("invite")) return { name: "person-add-outline" as any, color: "#6338F2" };
    if (type.startsWith("post")) return { name: "heart-outline" as any, color: "#EC4899" };
    if (type === "message") return { name: "chatbubble-outline" as any, color: "#22C55E" };
    return { name: "notifications-outline" as any, color: "#F59E0B" };
  };

  const getCategoryName = (type: string) => {
    if (type.startsWith("friend") || type.includes("request") || type.includes("invite")) return "Requests";
    if (type.startsWith("post")) return "Posts";
    if (type === "message") return "Messages";
    return "Others";
  };

  const groupedItems = filteredItems.reduce((acc, item) => {
    const category = getCategoryName(item.type);
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof filteredItems>);

  return (
    <CXScreen>
      <CXHeader
        title="Notifications"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="checkmark-done-outline"
            label="Mark all read"
            backgroundColor={colors.transparent}
            onPress={markAll}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXRow style={styles.filters}>
          {(["All", "Unread", "Requests", "Posts", "Messages", "Others"] as const).map((f) => (
            <CXChip 
              key={f} 
              label={f} 
              active={activeFilter === f} 
              onPress={() => setActiveFilter(f)} 
            />
          ))}
        </CXRow>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : isError ? (
          <CXButton label="Retry notifications" onPress={() => void refetch()} />
        ) : filteredItems.length === 0 ? (
          <CXText color={colors.textMuted} align="center">
            {hasNextPage ? "No matches on loaded pages. Load more to check older notifications." : "No notifications here yet."}
          </CXText>
        ) : Object.keys(groupedItems).map((category) => (
          <View key={category}>
            <CXSectionHeader title={category} />
            {(groupedItems[category] ?? []).map((item) => {
              const isUnread = !item.readAt;
              const { name, color } = getIcon(item.type);
              return (
                <Pressable
                  key={item._id}
                  onPress={async () => {
                    if (isUnread) {
                      try {
                        await api.patch(`/notifications/${item._id}/read`);
                        void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
                        void fetchUnreadNotifications();
                      } catch {
                        Alert.alert("Couldn't mark notification as read", "Please try again later.");
                      }
                    }
                    openTarget(item);
                  }}
                >
                  <CXRow
                    style={[
                      styles.notification,
                      isUnread && styles.notificationUnread,
                    ]}
                  >
                    <View style={styles.notificationIconContainer}>
                      {item.actor ? (
                        <CXAvatar
                          source={item.actor.avatarUrl}
                          name={item.actor.name}
                          size={44}
                        />
                      ) : (
                        <View
                          style={[
                            styles.notificationIcon,
                            { backgroundColor: `${color}18` },
                          ]}
                        >
                          <Ionicons name={name} size={20} color={color} />
                        </View>
                      )}
                      {isUnread ? <View style={styles.unreadBadge} /> : null}
                    </View>
                    <View style={styles.flex}>
                      <CXText variant={isUnread ? "bodyStrong" : "body"}>
                        {item.title}
                      </CXText>
                      <CXText variant="caption" color={colors.textMuted}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </CXText>
                    </View>
                  </CXRow>
                </Pressable>
              );
            })}
          </View>
        ))}
        {hasNextPage ? (
          <CXButton label="Load more" loading={isFetchingNextPage} onPress={() => void fetchNextPage()} />
        ) : null}
      </ScrollView>
    </CXScreen>
  );
}

export function MyQRScreen({ navigation }: StackProps<"MyQR">) {
  const user = useAppStore((state) => state.user);
  const fetchCurrentUser = useAppStore((state) => state.fetchCurrentUser);

  useEffect(() => {
    if (!user?.qrToken) {
      void fetchCurrentUser();
    }
  }, [user?.qrToken, fetchCurrentUser]);

  if (!user?.qrToken) {
    return (
      <CXScreen padded>
        <CXHeader title="My QR Code" onBack={navigation.goBack} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="sync-outline" size={48} color={colors.primary} style={{ marginBottom: spacing.lg }} />
          <CXText variant="h3" align="center" style={{ marginBottom: spacing.sm }}>
            Your CampusX QR is being prepared...
          </CXText>
          <CXText color={colors.textMuted} align="center">
            We are securely syncing your unique identity.
          </CXText>
        </View>
      </CXScreen>
    );
  }

  const value = `campusx://profile/${user.qrToken}`;
  return (
    <CXScreen edges={["top", "left", "right"]}>
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
                message: `Connect with ${user?.name || "someone"} on CampusX: campusx://user/${user?.id}`,
              })
            }
          />
        }
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }}>
        <LinearGradient colors={gradients.primaryStrong} style={styles.qrCard}>
        <CXRow style={{ marginBottom: spacing.md, gap: spacing.xs }}>
          <Ionicons name="school" size={24} color={colors.white} />
          <CXText variant="h3" color={colors.white}>
            CampusX
          </CXText>
        </CXRow>
        <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
          <CXText variant="h1" color={colors.white} align="center" style={{ marginBottom: 4 }}>
            {user?.name || "CampusX User"}
          </CXText>
          <CXText variant="body" color="#EDE9FF">
            @{user?.username || "user"}
          </CXText>
        </View>
        <View style={styles.qrWrap}>
          <QRCode
            value={value}
            size={210}
            color={colors.primaryDark}
            backgroundColor={colors.white}
            quietZone={12}
          />
        </View>
        <CXText color={colors.white} align="center" style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
          Scan to connect with me on CampusX
        </CXText>
        <CXRow style={[styles.qrActions, { justifyContent: "center", gap: spacing.md, flexWrap: "wrap" }]}>
          <CXButton
            label="Share QR"
            iconLeft="share-social-outline"
            variant="secondary"
            fullWidth={false}
            onPress={() =>
              void Share.share({
                message: `Connect with ${user?.name || "someone"} on CampusX: campusx://user/${user?.id}`,
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
      </ScrollView>
      <CXBottomActionArea>
        <CXButton
          style={{ flex: 1 }}
          label="Scan Someone’s QR"
          iconLeft="qr-code-outline"
          onPress={() => navigation.navigate("QRScanner")}
        />
      </CXBottomActionArea>
    </CXScreen>
  );
}

export function QRScannerScreen({ navigation }: StackProps<"QRScanner">) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scan = async ({ data }: { data: string }) => {
    if (locked) return;
    setLocked(true);

    // Strict parsing
    const match = data.match(/^campusx:\/\/profile\/([a-f0-9\-]{36})$/i);
    if (!match) {
      setError("This is not a valid CampusX user QR code.");
      setTimeout(() => {
        setLocked(false);
        setError(null);
      }, 1800);
      return;
    }

    const qrToken = match[1];

    try {
      const { api } = await import("@/services/api");
      const res = await api.get(`/users/qr/${qrToken}`);
      const scannedUser = res.data.data.user;

      if (scannedUser._id === useAppStore.getState().user?.id) {
        setError("This is your own CampusX QR code.");
        setTimeout(() => setLocked(false), 1800);
        return;
      }

      navigation.replace("UserProfile", { userId: scannedUser._id });
    } catch (err: any) {
      setError(err.response?.data?.message || "CampusX profile not found");
      setTimeout(() => setLocked(false), 2500);
    }
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
          source={user?.avatar as any}
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
          onPress={() => navigation.navigate("LocationSettings")}
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
  notificationIconContainer: {
    marginRight: spacing.xs,
    position: "relative",
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadge: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.primary,
  },
  qrCard: {
    margin: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
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
