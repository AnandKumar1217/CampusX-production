import React, { useState } from "react";
import { View, StyleSheet, TextInput, Modal, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { CXText } from "../ui/CXText";
import { CXButton } from "../ui/CXButton";
import { spacing } from "../../theme/spacing";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/radius";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: (password: string) => void;
  isDeleting: boolean;
};

export function DeleteAccountModal({ visible, onDismiss, onConfirm, isDeleting }: Props) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleConfirm = () => {
    if (password.trim() === "") return;
    onConfirm(password);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning" size={32} color={colors.danger} />
          </View>

          <CXText variant="h3" style={styles.title}>Delete Account</CXText>

          <CXText variant="body" color={colors.textMuted} style={styles.message}>
            This permanently removes your CampusX account and associated data. This action cannot be undone.
          </CXText>

          <View style={styles.inputContainer}>
            <CXText variant="smallStrong" color={colors.textMuted} style={{ marginBottom: spacing.xs }}>
              Confirm Password
            </CXText>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={[styles.input, { paddingRight: 40 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isDeleting}
              />
              <Pressable
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          <View style={styles.actions}>
            <CXButton
              label="Cancel"
              variant="secondary"
              onPress={onDismiss}
              disabled={isDeleting}
              style={styles.actionButton}
            />
            <CXButton
              label={isDeleting ? "Deleting..." : "Delete Account"}
              variant="primary"
              onPress={handleConfirm}
              disabled={isDeleting || !password}
              style={styles.actionButtonDanger}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.screen,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.danger,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  inputContainer: {
    width: "100%",
    marginBottom: spacing.xl,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  passwordWrapper: {
    position: "relative",
    justifyContent: "center",
  },
  eyeIcon: {
    position: "absolute",
    right: spacing.sm,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  actionButton: {
    flex: 1,
  },
  actionButtonDanger: {
    flex: 1,
    backgroundColor: colors.danger,
  },
});
