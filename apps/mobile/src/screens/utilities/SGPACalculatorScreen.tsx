import React from "react";
import { View, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { CXScreen, CXText, CXIconButton, CXRow } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";
import { useAppStore } from "@/store/appStore";
import { useRootNavigation } from "@/hooks/useRootNavigation";

export function SGPACalculatorScreen() {
  const navigation = useRootNavigation();
  const sgpas = useAppStore(state => state.sgpas);
  const updateSgpa = useAppStore(state => state.updateSgpa);

  const sgpaValues = Object.values(sgpas).filter((val): val is number => typeof val === 'number' && !isNaN(val) && val > 0);
  const calculatedCgpa = sgpaValues.length > 0
    ? (sgpaValues.reduce((a, b) => a + b, 0) / sgpaValues.length).toFixed(2)
    : "0.00";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => navigation.goBack()}
      >
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <CXRow style={{ justifyContent: "space-between", marginBottom: spacing.md }}>
            <CXText variant="h3">Calculate CGPA</CXText>
            <CXIconButton
              icon="close"
              label="Close"
              onPress={() => navigation.goBack()}
            />
          </CXRow>

          <CXText variant="body" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
            Enter your SGPA for each semester to automatically calculate your overall CGPA.
          </CXText>

          <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
            <CXText variant="caption" color={colors.textMuted}>Current CGPA</CXText>
            <CXText variant="h1" color={colors.primary}>{calculatedCgpa}</CXText>
          </View>

          <ScrollView style={{ maxHeight: 300, marginBottom: spacing.md }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <View key={sem} style={styles.sgpaInputRow}>
                <CXText variant="bodyStrong">Semester {sem}</CXText>
                <TextInput
                  style={styles.sgpaInput}
                  placeholder="e.g. 8.5"
                  keyboardType="decimal-pad"
                  defaultValue={sgpas[sem] ? sgpas[sem].toString() : ""}
                  onChangeText={(text) => {
                    if (text.trim() === "") {
                      updateSgpa(sem, undefined as any);
                      return;
                    }
                    const val = parseFloat(text);
                    if (!isNaN(val) && val <= 10 && val >= 0) {
                      updateSgpa(sem, val);
                    }
                  }}
                />
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.screen,
    maxHeight: "80%",
  },
  sgpaInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  sgpaInput: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: 80,
    textAlign: "center",
    fontFamily: "Inter-SemiBold",
  },
});
