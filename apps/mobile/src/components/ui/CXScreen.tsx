import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewProps,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

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
  edges = ["top", "right", "left"],
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
        padded && styles.padded,
        style,
      ]}
      {...props}
    >
      {children}
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
  return (
    <SafeAreaView edges={edges} style={[styles.screen, { backgroundColor }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          padded && styles.padded,
          contentContainerStyle,
        ]}
        {...props}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function CXKeyboardScreen({ children, style, ...props }: ScreenProps) {
  return (
    <CXScreen style={style} {...props}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        style={styles.screen}
      >
        {children}
      </KeyboardAvoidingView>
    </CXScreen>
  );
}

export function CXRow({ style, ...props }: ViewProps) {
  return <View style={[styles.row, style]} {...props} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  padded: { paddingHorizontal: spacing.screen },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxxl },
  row: { flexDirection: "row", alignItems: "center" },
});
