import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { type ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  Text,
  type PressableProps,
  type ViewStyle,
} from "react-native";

import { colors, gradients, radius, spacing } from "@/theme";

import { CXText } from "./CXText";

type IconName = ComponentProps<typeof Ionicons>["name"];
type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = Omit<PressableProps, "style"> & {
  label: string;
  variant?: Variant;
  size?: Size;
  iconLeft?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
};

const heights = { sm: 38, md: 48, lg: 56 } as const;

export function CXButton({
  label,
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  loading,
  disabled,
  fullWidth = true,
  style,
  ...props
}: Props) {
  const foreground =
    variant === "primary" || variant === "danger"
      ? colors.white
      : colors.primary;
  const body = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {iconLeft ? (
            <Ionicons name={iconLeft} size={18} color={foreground} />
          ) : null}
          <CXText variant="button" color={foreground} numberOfLines={1}>
            {label}
          </CXText>
          {iconRight ? (
            <Ionicons name={iconRight} size={20} color={foreground} />
          ) : null}
        </>
      )}
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.pressable,
        {
          height: heights[size],
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      {...props}
    >
      {variant === "primary" ? (
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        >
          {body}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.fill,
            styles[variant],
            variant === "danger" && { backgroundColor: colors.danger },
          ]}
        >
          {body}
        </View>
      )}
    </Pressable>
  );
}

type IconButtonProps = PressableProps & {
  icon: IconName;
  label: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  badge?: number;
};

export function CXIconButton({
  icon,
  label,
  size = 30,
  color = colors.primary,
  backgroundColor = colors.surfaceLavender,
  badge,
  style,
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
        pressed && styles.pressed,
        typeof style === "function" ? style({ pressed }) : style,
      ]}
      {...props}
    >
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={color} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { borderRadius: radius.sm, overflow: "hidden" },
  fill: {
    flex: 1,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  secondary: { backgroundColor: colors.primaryTint },
  outline: {
    backgroundColor: colors.white,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  ghost: { backgroundColor: colors.transparent },
  danger: { backgroundColor: colors.danger },
  pressed: { opacity: 0.82, transform: [{ scale: 0.992 }] },
  disabled: { opacity: 0.5 },
  iconButton: { alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: colors.danger,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "bold",
  },
});
