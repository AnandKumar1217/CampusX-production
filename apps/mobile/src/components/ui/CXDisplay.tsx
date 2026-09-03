import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewProps,
} from "react-native";

import { colors, radius, shadows, spacing } from "@/theme";

import { CXIconButton } from "./CXButton";
import { CXRow } from "./CXScreen";
import { CXText } from "./CXText";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function CXCard({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

export function CXChip({
  label,
  active,
  icon,
  ...props
}: PressableProps & { label: string; active?: boolean; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.pressed,
      ]}
      {...props}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={active ? colors.white : colors.primary}
        />
      ) : null}
      <CXText
        variant="smallStrong"
        color={active ? colors.white : colors.inkSoft}
      >
        {label}
      </CXText>
    </Pressable>
  );
}

export function CXAvatar({
  source,
  name,
  size = 44,
  online,
}: {
  source?: string | number;
  name: string;
  size?: number;
  online?: boolean;
}) {
  return (
    <View style={{ width: size, height: size }}>
      {source ? (
        <Image
          source={source}
          contentFit="cover"
          transition={160}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View
          style={[
            styles.avatarFallback,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <CXText variant="bodyStrong" color={colors.primary}>
            {name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </CXText>
        </View>
      )}
      {online ? <View style={styles.onlineDot} /> : null}
    </View>
  );
}

export function CXHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <CXRow style={styles.header}>
      {onBack ? (
        <CXIconButton
          icon="chevron-back"
          label="Go back"
          size={38}
          backgroundColor={colors.transparent}
          onPress={onBack}
        />
      ) : null}
      <View style={styles.headerText}>
        <CXText variant="h3" numberOfLines={1}>
          {title}
        </CXText>
        {subtitle ? (
          <CXText variant="caption" color={colors.textMuted} numberOfLines={1}>
            {subtitle}
          </CXText>
        ) : null}
      </View>
      <View style={styles.headerRight}>{right}</View>
    </CXRow>
  );
}

export function CXSectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <CXRow style={styles.sectionHeader}>
      <CXText variant="title" style={styles.flex}>
        {title}
      </CXText>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <CXText variant="smallStrong" color={colors.primary}>
            {action}
          </CXText>
        </Pressable>
      ) : null}
    </CXRow>
  );
}

export function CXListRow({
  icon,
  iconColor = colors.primary,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <CXRow style={styles.listRow}>
      {icon ? (
        <View style={styles.listIcon}>
          <Ionicons name={icon} size={19} color={iconColor} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <CXText variant="bodyStrong">{title}</CXText>
        {subtitle ? (
          <CXText variant="small" color={colors.textMuted} numberOfLines={2}>
            {subtitle}
          </CXText>
        ) : null}
      </View>
      {right ??
        (onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        ) : null)}
    </CXRow>
  );

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function CXState({
  icon,
  title,
  message,
  action,
}: PropsWithChildren<{
  icon: IconName;
  title: string;
  message: string;
  action?: ReactNode;
}>) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <CXText variant="h3" align="center">
        {title}
      </CXText>
      <CXText color={colors.textMuted} align="center">
        {message}
      </CXText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    ...shadows.card,
  },
  chip: {
    minHeight: 34,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.72 },
  avatarFallback: {
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
  header: { minHeight: 54, gap: spacing.xs },
  headerText: { flex: 1 },
  headerRight: { minWidth: 38, alignItems: "flex-end" },
  sectionHeader: { paddingTop: spacing.sm, paddingBottom: spacing.xs },
  listRow: { minHeight: 62, gap: spacing.sm, paddingVertical: spacing.xs },
  listIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  state: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  stateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
});
