import { Ionicons } from "@expo/vector-icons";
import { useRoute, useFocusEffect } from "@react-navigation/native";
import { useEffect, useState, useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, View, Share, BackHandler } from "react-native";

import {
  CXButton,
  CXAvatar,
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
import { DeleteAccountModal } from "@/components/modals/DeleteAccountModal";
import { api } from "@/services/api";
import { queryClient } from "@/query/queryClient";
import { useQuery } from "@tanstack/react-query";

export function ProfileScreen() {
  const navigation = useRootNavigation();

  const route = useRoute<any>();
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const user = useAppStore((state) => state.user);
  
  const { data: stats } = useQuery({
    queryKey: ["profile-summary", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const response = await api.get<{
        data: { stats: { eventsCount: number; friendsCount: number; groupsCount: number } };
      }>(`/users/${user!.id}/profile-summary`);
      return response.data.data.stats;
    },
  });
  const eventsCount = stats?.eventsCount ?? 0;
  const connectionsCount = stats?.friendsCount ?? 0;
  const groupsCount = stats?.groupsCount ?? 0;


  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["profile-summary", user.id] });
      }
    }, [user?.id])
  );

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

  const handleDeleteAccount = async (password: string) => {
    setIsDeleting(true);
    try {
      await api.delete("/users/me", { data: { password } });
      await clearSession();
      queryClient.clear();
      setDeleteModalVisible(false);
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch (error: any) {
      console.error("Failed to delete account", error);
      alert(error.response?.data?.message || "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
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
            <View style={styles.avatar}>
              <CXAvatar source={user?.avatarUrl || undefined} name={user?.name || "CampusX user"} size={90} />
            </View>
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
          <CXText variant="small" color={colors.textMuted} align="center">
            @{user?.username || "campusxuser"}
          </CXText>
          {user?.department || user?.academicYear ? (
            <CXText variant="small" color={colors.textMuted} align="center">
              {[user.department, user.academicYear].filter(Boolean).join(" · ")}
            </CXText>
          ) : null}
          {user?.college ? (
            <CXText variant="small" color={colors.textMuted} align="center">
              {user.college}
            </CXText>
          ) : null}
          {user?.bio ? (
            <CXText variant="body" color={colors.ink} style={{ marginTop: spacing.sm, textAlign: "center", paddingHorizontal: spacing.lg }}>
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
            [String(eventsCount), "Events", "MyEvents"],
            [String(connectionsCount), "Connections", "Friends"],
            [String(groupsCount), "Groups", "StudyGroups"],
          ].map(([value, label, target], index) => (
            <Pressable
              key={label}
              style={[styles.stat, index > 0 && styles.statBorder]}
              accessibilityRole="button"
              onPress={() => target === "StudyGroups"
                ? navigation.navigate("StudyGroups", { initialCategory: "My Groups" })
                : navigation.navigate(target as "MyPosts" | "Friends" | "MyEvents")}
            >
              <CXText variant="title" color={colors.primary}>
                {value}
              </CXText>
              <CXText variant="caption" color={colors.textMuted}>
                {label}
              </CXText>
            </Pressable>
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
            subtitle="Events and listings"
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
            icon="location-outline"
            title="Location Sharing"
            onPress={() => navigation.navigate("LocationSettings")}
          />
          <CXListRow
            icon="notifications-outline"
            title="Notifications"
            onPress={() => navigation.navigate("Notifications")}
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
        <CXSectionHeader title="Account" />
        <View style={{ gap: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.sm }}>
          <CXButton
            label="Sign Out"
            iconLeft="log-out-outline"
            variant="outline"
            onPress={() => void logout()}
          />
          <CXButton
            label="Delete Account"
            iconLeft="trash-outline"
            variant="primary"
            style={{ backgroundColor: colors.danger, borderColor: colors.danger }}
            onPress={() => setDeleteModalVisible(true)}
          />
        </View>
      </ScrollView>

      <DeleteAccountModal
        visible={deleteModalVisible}
        onDismiss={() => setDeleteModalVisible(false)}
        onConfirm={handleDeleteAccount}
        isDeleting={isDeleting}
      />

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
});
