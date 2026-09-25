import type { PropsWithChildren } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewProps,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets, type Edge } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { colors, spacing } from "@/theme";

type ScreenProps = PropsWithChildren<
  ViewProps & {
    edges?: Edge[];
    padded?: boolean;
    backgroundColor?: string;
  }
>;

export function CXScreen({
  children,
  edges = ["top", "right", "left", "bottom"],
  padded = false,
  backgroundColor = colors.background,
  style,
  ...props
}: ScreenProps) {
  return (
    <SafeAreaView
      edges={edges}
      style={[
        styles.screen,
        { backgroundColor },
        style,
      ]}
      {...props}
    >
      <View style={[styles.contentContainer, padded && styles.padded]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

type ScrollProps = ScrollViewProps & {
  edges?: Edge[];
  padded?: boolean;
  backgroundColor?: string;
};

export function CXScrollScreen({
  children,
  edges = ["top", "right", "left"],
  padded = true,
  backgroundColor = colors.background,
  contentContainerStyle,
  ...props
}: ScrollProps) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={edges} style={[styles.screen, { backgroundColor }]}>
      <View style={styles.contentContainer}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            padded && styles.padded,
            { paddingBottom: Math.max(insets.bottom + spacing.xxl, spacing.xxxl) },
            contentContainerStyle,
          ]}
          {...props}
        >
          {children}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export function CXKeyboardScreen({
  children,
  edges = ["top", "right", "left"],
  padded = true,
  backgroundColor = colors.background,
  contentContainerStyle,
  style,
  ...props
}: ScrollProps) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={edges} style={[styles.screen, { backgroundColor }, style]}>
      <View style={styles.contentContainer}>
        <KeyboardAwareScrollView
          bottomOffset={Platform.OS === "ios" ? 8 : 0}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            padded && styles.padded,
            { paddingBottom: Math.max(insets.bottom + spacing.xxl, spacing.xxxl) },
            contentContainerStyle,
          ]}
          {...props}
        >
          {children}
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  );
}

export function CXRow({ style, ...props }: ViewProps) {
  return <View style={[styles.row, style]} {...props} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  contentContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  padded: { paddingHorizontal: spacing.screen },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxxl },
  row: { flexDirection: "row", alignItems: "center" },
});
