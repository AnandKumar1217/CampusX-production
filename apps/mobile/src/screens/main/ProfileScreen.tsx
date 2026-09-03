import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRoute } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, Share } from "react-native";

import {
  CXButton,
  CXCard,
  CXIconButton,
  CXListRow,
  CXRow,
  CXScreen,
  CXSectionHeader,
  CXText,
  CXSnackbar,
} from "@/components/ui";
import { useRootNavigation } from "@/hooks/useRootNavigation";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme";

const avatar = require("../../../assets/avatars/anand.png");

export function ProfileScreen() {
  const navigation = useRootNavigation();
  const route = useRoute<any>();
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const user = useAppStore((state) => state.user);
  const postsCount = useAppStore((state) => state.events).filter((e) => e?.author?.id === user?.id).length + useAppStore((state) => state.listings).filter((l) => l?.seller?.id === user?.id).length;
  const connectionsCount = useAppStore((state) => state.friends).length;
  const groupsCount = useAppStore((state) => state.studyGroups).filter((g) => g.joined).length;

  useEffect(() => {
    if (route.params?.profileUpdated) {
      setSnackbarVisible(true);
      navigation.setParams({ profileUpdated: undefined });
    }
  }, [route.params?.profileUpdated, navigation]);

  const clearSession = useAppStore((state) => state.clearSession);
  const logout = async () => {
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${user?.name}'s profile on CampusX! campusx://user/${user?.id}`,
      });
    } catch (error) {
      console.error("Error sharing profile", error);
    }
  };
  return (
    <CXScreen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <CXRow style={styles.header}>
          <View style={styles.flex} />
          <CXIconButton
            icon="qr-code-outline"
            label="My QR code"
            backgroundColor={colors.white}
            onPress={() => navigation.navigate("MyQR")}
          />
        </CXRow>
        <View style={styles.identity}>
          <Pressable onPress={() => navigation.navigate("EditProfile")}>
            <Image source={user?.avatarUrl ? { uri: user.avatarUrl } : avatar} contentFit="cover" style={styles.avatar} />
            <View style={styles.editBadge}>
              <Ionicons name="pencil" size={12} color={colors.white} />
            </View>
          </Pressable>
          <CXRow style={styles.nameRow}>
            <CXText variant="h3">{user?.name || "CampusX User"}</CXText>
            <Ionicons
              name="checkmark-circle"
              size={17}
              color={colors.primary}
            />
          </CXRow>
          <CXText variant="small" color={colors.textMuted}>
            @{user?.username || "campusxuser"}
          </CXText>
          {user?.department || user?.academicYear ? (
            <CXText variant="small" color={colors.textMuted}>
              {[user.department, user.academicYear].filter(Boolean).join(" · ")}
            </CXText>
          ) : null}
          {user?.college ? (
            <CXText variant="small" color={colors.textMuted}>
              {user.college}
            </CXText>
          ) : null}
          {user?.bio ? (
            <CXText variant="body" color={colors.text} style={{ marginTop: spacing.sm, textAlign: "center", paddingHorizontal: spacing.lg }}>
              {user.bio}
            </CXText>
          ) : null}
        </View>
        <CXRow style={styles.actions}>
          <CXButton
            label="Edit Profile"
            iconLeft="pencil-outline"
            variant="outline"
            size="sm"
            fullWidth={false}
            style={styles.actionButton}
            onPress={() => navigation.navigate("EditProfile")}
          />
          <CXButton
            label="Share"
            iconLeft="share-social-outline"
            variant="secondary"
            size="sm"
            fullWidth={false}
            style={styles.actionButton}
            onPress={handleShare}
          />
        </CXRow>
        <CXCard style={styles.stats}>
          {[
            [String(postsCount), "Posts"],
            [String(connectionsCount), "Connections"],
            [String(groupsCount), "Groups"],
          ].map(([value, label], index) => (
            <View
              key={label}
              style={[styles.stat, index > 0 && styles.statBorder]}
            >
              <CXText variant="title" color={colors.primary}>
                {value}
              </CXText>
              <CXText variant="caption" color={colors.textMuted}>
                {label}
              </CXText>
            </View>
          ))}
        </CXCard>

        <CXCard style={styles.links}>
          <CXListRow
            icon="person-outline"
            title="Edit Profile"
            subtitle="Update your info and preferences"
            onPress={() => navigation.navigate("EditProfile")}
          />

          <CXListRow
            icon="bookmark-outline"
            title="Saved Items"
            subtitle="Posts, events and listings"
            onPress={() => navigation.navigate("Saved")}
          />
          <CXListRow
            icon="people-outline"
            title="Friends"
            subtitle="Manage your connections"
            onPress={() => navigation.navigate("Friends")}
          />
        </CXCard>

        <CXSectionHeader title="Settings" />
        <CXCard style={styles.links}>
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
        <CXCard style={styles.links}>
          <CXListRow icon="help-circle-outline" title="Help & Support" />
          <CXListRow
            icon="information-circle-outline"
            title="About CampusX"
            subtitle="Version 1.0.0"
          />
        </CXCard>

        <Pressable onPress={() => void logout()} style={styles.logout}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <CXText variant="bodyStrong" color={colors.danger}>
            Sign Out
          </CXText>
        </Pressable>
      </ScrollView>

      <CXSnackbar
        visible={snackbarVisible}
        message="Profile updated successfully!"
        duration={2000}
        onDismiss={() => setSnackbarVisible(false)}
      />
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  header: { minHeight: 48, gap: spacing.xs },
  identity: { alignItems: "center", gap: spacing.xxs },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  editBadge: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { gap: 4, marginTop: spacing.xs },
  actions: { justifyContent: "center", gap: spacing.sm },
  actionButton: { minWidth: 126 },
  stats: { flexDirection: "row", paddingVertical: spacing.md },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statBorder: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },

  links: { paddingVertical: spacing.xs },

  logout: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.dangerTint,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
});
