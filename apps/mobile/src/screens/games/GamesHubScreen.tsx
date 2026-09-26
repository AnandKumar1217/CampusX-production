import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import {
  CXCard,
  CXHeader,
  CXScrollScreen,
  CXText,
} from "@/components/ui";
import { colors, radius, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;

const gameTiles = [
  {
    title: "Air Hockey",
    subtitle: "2 Player \u2022 Local",
    route: "AirHockey" as const,
    icon: "disc-outline" as const,
    colors: ["#3B82F6", "#1D4ED8"] as const,
  },
  {
    title: "Reaction Battle",
    subtitle: "2 Player \u2022 Local",
    route: "ReactionBattle" as const,
    icon: "flash-outline" as const,
    colors: ["#EC4899", "#BE185D"] as const,
  },
  {
    title: "Tic-Tac-Toe Glow",
    subtitle: "2 Player \u2022 Local",
    route: "TicTacToeGlow" as const,
    icon: "close-outline" as const,
    colors: ["#8B5CF6", "#6D28D9"] as const,
  },
];

export function GamesHubScreen({ navigation }: StackProps<"GamesHub">) {
  return (
    <CXScrollScreen>
      <CXHeader
        title="Arcade"
        onBack={navigation.goBack}
      />

      <CXCard style={styles.gameHero}>
        <View style={styles.flex}>
          <CXText variant="title" color={colors.primary}>
            Local Multiplayer
          </CXText>
          <CXText variant="small" color={colors.textMuted} style={{ marginTop: 4 }}>
            Play offline with friends on the same screen! Choose a game below to get started.
          </CXText>
        </View>
        <Ionicons name="game-controller" size={50} color={colors.primary} />
      </CXCard>

      <View style={styles.gameGrid}>
        {gameTiles.map((game) => (
          <Pressable
            key={game.title}
            style={({ pressed }) => [
              styles.gameTile,
              pressed && styles.pressed,
            ]}
            onPress={() => navigation.navigate(game.route)}
          >
            <LinearGradient
              colors={game.colors}
              style={styles.gameTileIcon}
            >
              <Ionicons name={game.icon} size={36} color={colors.white} />
            </LinearGradient>
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <CXText variant="bodyStrong">{game.title}</CXText>
              <CXText variant="caption" color={colors.textMuted}>{game.subtitle}</CXText>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </CXScrollScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gameHero: {
    margin: spacing.md,
    padding: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
  },
  gameGrid: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  gameTile: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  gameTileIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
