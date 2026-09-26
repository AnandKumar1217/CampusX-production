import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, shadows } from "@/theme";
import { CXText } from "./CXText";

export type CXAction = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** If provided, tapping this action asks for confirmation rather than immediately executing onPress */
  confirmationTitle?: string;
  confirmationMessage?: string;
  confirmationButtonText?: string;
};

export type CXActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: CXAction[];
};

export function CXActionSheet({ visible, onClose, title, actions }: CXActionSheetProps) {
  const insets = useSafeAreaInsets();
  const [confirmAction, setConfirmAction] = useState<CXAction | null>(null);

  // Reset confirmation state when sheet closes
  useEffect(() => {
    if (!visible) {
      setConfirmAction(null);
    }
  }, [visible]);

  if (!visible) return null;

  const handleAction = (action: CXAction) => {
    if (action.disabled) return;
    if (action.destructive && (action.confirmationTitle || action.confirmationMessage)) {
      setConfirmAction(action);
    } else {
      onClose();
      // Use setTimeout to allow modal close animation if we had one,
      // or just to unmount before heavy action
      setTimeout(() => action.onPress(), 50);
    }
  };

  const confirm = () => {
    if (!confirmAction) return;
    onClose();
    setTimeout(() => confirmAction.onPress(), 50);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
              {confirmAction ? (
                // CONFIRMATION VIEW
                <View style={styles.confirmationView}>
                  <View style={styles.iconCircle}>
                    <Ionicons name={confirmAction.icon || "warning"} size={32} color={colors.danger} />
                  </View>
                  <CXText variant="h3" align="center" style={styles.confirmTitle}>
                    {confirmAction.confirmationTitle || "Are you sure?"}
                  </CXText>
                  {confirmAction.confirmationMessage && (
                    <CXText variant="body" color={colors.textMuted} align="center" style={styles.confirmMessage}>
                      {confirmAction.confirmationMessage}
                    </CXText>
                  )}

                  <View style={styles.confirmButtons}>
                    <Pressable style={styles.cancelBtn} onPress={() => setConfirmAction(null)}>
                      <CXText variant="bodyStrong">Cancel</CXText>
                    </Pressable>
                    <Pressable style={styles.destructiveBtn} onPress={confirm}>
                      <CXText variant="bodyStrong" color={colors.white}>
                        {confirmAction.confirmationButtonText || confirmAction.label || "Confirm"}
                      </CXText>
                    </Pressable>
                  </View>
                </View>
              ) : (
                // ACTIONS LIST VIEW
                <>
                  {title && (
                    <View style={styles.titleContainer}>
                      <CXText variant="smallStrong" color={colors.textMuted} align="center">
                        {title}
                      </CXText>
                    </View>
                  )}
                  {actions.map((action, index) => (
                    <Pressable
                      key={action.label + index}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.actionRowPressed,
                        action.disabled && styles.actionRowDisabled
                      ]}
                      onPress={() => handleAction(action)}
                      accessibilityRole="button"
                      disabled={action.disabled}
                    >
                      {action.icon && (
                        <Ionicons
                          name={action.icon}
                          size={22}
                          color={action.destructive ? colors.danger : colors.ink}
                          style={styles.actionIcon}
                        />
                      )}
                      <CXText
                        variant="body"
                        color={action.destructive ? colors.danger : colors.ink}
                        style={action.disabled && styles.disabledText}
                      >
                        {action.label}
                      </CXText>
                    </Pressable>
                  ))}
                  <View style={styles.divider} />
                  <Pressable
                    style={({ pressed }) => [styles.actionRow, styles.cancelRow, pressed && styles.actionRowPressed]}
                    onPress={onClose}
                  >
                    <CXText variant="bodyStrong">Cancel</CXText>
                  </Pressable>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
    ...shadows.floating,
  },
  titleContainer: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  actionRowPressed: {
    backgroundColor: colors.backgroundLavender,
  },
  actionRowDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    marginRight: spacing.md,
  },
  disabledText: {
    color: colors.textMuted,
  },
  divider: {
    height: 8,
    backgroundColor: colors.surfaceLavender,
    marginHorizontal: -spacing.sm,
    marginVertical: spacing.sm,
  },
  cancelRow: {
    justifyContent: "center",
  },
  // Confirmation view styles
  confirmationView: {
    padding: spacing.xl,
    alignItems: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  confirmTitle: {
    marginBottom: spacing.sm,
  },
  confirmMessage: {
    marginBottom: spacing.xl,
  },
  confirmButtons: {
    flexDirection: "row",
    width: "100%",
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceLavender,
    borderRadius: radius.md,
  },
  destructiveBtn: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
    borderRadius: radius.md,
  }
});
