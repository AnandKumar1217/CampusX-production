import React from "react";
import { View, StyleSheet } from "react-native";
import { CXText } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";

interface ScoreBoardProps {
  scoreP1: number;
  scoreP2: number;
  nameP1?: string;
  nameP2?: string;
  colorP1?: string;
  colorP2?: string;
  round?: number;
  maxRounds?: number;
}

export function ScoreBoard({ 
  scoreP1, 
  scoreP2, 
  nameP1 = "Player 1", 
  nameP2 = "Player 2", 
  colorP1 = "#3B82F6", 
  colorP2 = "#EC4899",
  round,
  maxRounds 
}: ScoreBoardProps) {
  return (
    <View style={styles.container}>
      {round !== undefined && maxRounds !== undefined && (
        <CXText variant="caption" color={colors.textMuted} style={styles.round}>
          Round {round} / {maxRounds}
        </CXText>
      )}
      
      <View style={styles.scoreRow}>
        <View style={styles.playerBlock}>
          <CXText variant="h2" color={colorP1}>{scoreP1}</CXText>
          <CXText variant="caption" color={colors.textMuted}>{nameP1}</CXText>
        </View>

        <CXText variant="h3" color={colors.border}>-</CXText>

        <View style={styles.playerBlock}>
          <CXText variant="h2" color={colorP2}>{scoreP2}</CXText>
          <CXText variant="caption" color={colors.textMuted}>{nameP2}</CXText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignSelf: "center",
    minWidth: 200,
    marginVertical: spacing.md,
  },
  round: {
    textAlign: "center",
    marginBottom: spacing.xxs,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  playerBlock: {
    alignItems: "center",
    minWidth: 60,
  }
});
