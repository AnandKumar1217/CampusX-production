import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";
import React, { useState } from "react";

import { colors, radius, spacing } from "@/theme";
import type { Post, User } from "@/types/domain";
import { useAppStore } from "@/store/appStore";

import { CXAvatar, CXButton, CXCard, CXRow, CXText, CXIconButton, CXActionSheet } from "../ui";

export function CXUserRow({
  user,
  action = "Message",
  subtitle,
  onPress,
  onAction,
  onRemove,
}: {
  user: User;
  action?: string;
  subtitle?: string;
  onPress?: () => void;
  onAction?: () => void;
  onRemove?: () => void;
}) {
  return (
    <CXRow style={styles.userRow}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm }, pressed && styles.pressed]}
      >
        <CXAvatar source={user.avatarUrl || user.avatar} name={user.name} online={user.online} />
        <View style={styles.flex}>
          <CXRow style={styles.nameRow}>
            <CXText variant="bodyStrong" numberOfLines={1}>
              {user.name}
            </CXText>
            {user.verified ? (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={colors.primary}
              />
            ) : null}
          </CXRow>
          <CXText variant="caption" color={colors.textMuted} numberOfLines={1}>
            {subtitle ?? [user.department, user.academicYear || user.year].filter(Boolean).join(" · ")}
          </CXText>
        </View>
      </Pressable>
      {onRemove && (
          <CXIconButton
            icon="person-remove-outline"
            label="Remove friend"
            color={colors.danger}
            onPress={onRemove}
          />
        )}
        {action ? (
          <CXButton
            label={action}
            size="sm"
            variant={action === "Add Friend" ? "primary" : "outline"}
            disabled={action === "Requested" || action === "Friends"}
            fullWidth={false}
            style={{ alignSelf: "center" }}
            onPress={onAction}
          />
        ) : null}
      </CXRow>
  );
}

export function CXStoryAvatar({
  user,
  onPress,
  add,
}: {
  user: User;
  onPress?: () => void;
  add?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.story}
      accessibilityRole="button"
    >
      <View style={[styles.storyRing, add && styles.storyRingAdd]}>
        <CXAvatar
          source={user.avatarUrl || user.avatar}
          name={user.name}
          size={50}
          online={false}
        />
        {add ? (
          <View style={styles.plusBadge}>
            <Ionicons name="add" size={13} color={colors.white} />
          </View>
        ) : null}
      </View>
      <CXText variant="caption" numberOfLines={1} align="center">
        {add ? "Your Story" : user.name.split(" ")[0]}
      </CXText>
    </Pressable>
  );
}

export function CXPostCard({
  post,
  onOpen,
  onLike,
  onSave,
}: {
  post: Post;
  onOpen?: () => void;
  onLike?: () => void;
  onSave?: () => void;
}) {
  const currentUser = useAppStore(state => state.user);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const isSaved = post.saved;

  return (
    <CXCard style={styles.postCard}>
      <CXRow style={styles.postHeader}>
        <CXAvatar
          source={post.author.avatarUrl || post.author.avatar}
          name={post.author.name}
          size={42}
        />
        <View style={styles.flex}>
          <CXText variant="bodyStrong">{post.author.name}</CXText>
          <CXText variant="caption" color={colors.textMuted}>
            {post.author.department} · {new Date(post.createdAt).toLocaleString()}
          </CXText>
        </View>
        <Pressable onPress={() => setOptionsVisible(true)} hitSlop={10}>
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
      </CXRow>
      <CXActionSheet
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        actions={[
          { label: "Share Post", icon: "share-outline", onPress: () => {} },
          { label: "Save Post", icon: "bookmark-outline", onPress: onSave || (() => {}) },
          { label: "Report", icon: "flag-outline", destructive: true, onPress: () => {} }
        ]}
      />
      <Pressable onPress={onOpen} accessibilityRole="button">
        <CXText style={styles.postBody}>{post.body}</CXText>
        {post.image ? (
          <Image
            source={post.image}
            contentFit="cover"
            style={styles.postImage}
            transition={180}
          />
        ) : null}
      </Pressable>
      <CXRow style={styles.metrics}>
        <CXText variant="caption" color={colors.textMuted}>
          💜 {post.reactions}
        </CXText>
        <CXText variant="caption" color={colors.textMuted}>
          {post.comments} comments
        </CXText>
      </CXRow>
      <View style={styles.divider} />
      <CXRow style={styles.actions}>
        <PostAction
          icon={post.liked ? "heart" : "heart-outline"}
          label="Like"
          active={post.liked}
          onPress={onLike}
        />
        <PostAction
          icon="chatbubble-outline"
          label="Comment"
          onPress={onOpen}
        />
        <PostAction icon="share-social-outline" label="Share" />
        <PostAction
          icon={isSaved ? "bookmark" : "bookmark-outline"}
          label="Save"
          active={isSaved}
          onPress={onSave}
        />
      </CXRow>
    </CXCard>
  );
}

function PostAction({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.action}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? colors.primary : colors.textMuted}
      />
      <CXText
        variant="caption"
        color={active ? colors.primary : colors.textMuted}
      >
        {label}
      </CXText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.72 },
  userRow: { minHeight: 66, gap: spacing.sm, alignItems: "center" },
  nameRow: { gap: spacing.xxs },
  story: { width: 64, alignItems: "center", gap: spacing.xxs },
  storyRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  storyRingAdd: { borderStyle: "dashed", borderColor: colors.border },
  plusBadge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  postCard: { padding: 0, overflow: "hidden" },
  postHeader: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  postBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  postImage: {
    width: "100%",
    aspectRatio: 1.75,
    backgroundColor: colors.surfaceLavender,
  },
  metrics: {
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSoft,
  },
  actions: { justifyContent: "space-around", paddingVertical: spacing.sm },
  action: { minWidth: 54, alignItems: "center", gap: 2 },
});
