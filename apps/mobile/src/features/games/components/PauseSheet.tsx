import React from "react";
import { View, StyleSheet, Modal, Pressable } from "react-native";
import { CXText, CXButton } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";

interface PauseSheetProps {
  visible: boolean;
  onResume: () => void;
  onRestart: () => void;
  onSettings?: () => void;
  onQuit: () => void;
}

export function PauseSheet({ visible, onResume, onRestart, onSettings, onQuit }: PauseSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <CXText variant="h3" style={styles.title}>Game Paused</CXText>
          
          <View style={styles.actions}>
            <CXButton label="Resume" onPress={onResume} />
            <CXButton label="Restart" variant="outline" onPress={onRestart} />
            {onSettings && <CXButton label="Settings" variant="outline" onPress={onSettings} />}
            <CXButton label="Quit Game" variant="ghost" onPress={onQuit} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl, // safe area padding
  },
  title: {
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  actions: {
    gap: spacing.md,
  }
});
