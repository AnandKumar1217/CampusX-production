import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, shadows, spacing } from "@/theme";

type CXBottomActionAreaProps = PropsWithChildren<ViewProps>;

export function CXBottomActionArea({
  children,
  style,
  ...props
}: CXBottomActionAreaProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom + spacing.sm, spacing.md) },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: spacing.sm,
    ...shadows.floating,
  },
});
