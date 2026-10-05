import React, { useEffect } from "react";
import { View, StyleSheet, BackHandler } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CXScreen, CXText, CXButton } from "@/components/ui";
import { colors, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";
import { CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<any, any>;

export function GameResultScreen({ navigation, route }: Props) {
  const { status, scoreText, onRematch, gameId } = route.params as any;

  // Prevent physical back button from doing weird things on result screen
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => handler.remove();
  }, []);

  const getTheme = () => {
    if (status === "WON") return { color: colors.success, icon: "trophy" as const, title: "YOU WON" };
    if (status === "LOST") return { color: colors.danger, icon: "sad" as const, title: "YOU LOST" };
    if (status === "P1_WIN") return { color: "#3B82F6", icon: "medal" as const, title: "PLAYER 1 WINS" };
    if (status === "P2_WIN") return { color: "#EC4899", icon: "medal" as const, title: "PLAYER 2 WINS" };
    return { color: colors.textMuted, icon: "hand-left" as const, title: "IT'S A DRAW" };
  };

  const theme = getTheme();

  return (
    <CXScreen edges={["top", "bottom"]}>
      <View style={styles.container}>
        <Ionicons name={theme.icon} size={80} color={theme.color} style={styles.icon} />
        
        <CXText variant="h1" color={theme.color} style={styles.title}>
          {theme.title}
        </CXText>
        
        {!!scoreText && (
          <CXText variant="title" color={colors.textMuted} style={styles.score}>
            {scoreText}
          </CXText>
        )}

        <View style={styles.actions}>
          <CXButton 
            label="Rematch" 
            onPress={() => {
              // Replace GameResult with a fresh ActiveGame screen
              navigation.replace("ActiveGame" as any, route.params as any);
            }} 
            style={styles.btn}
          />
          <CXButton 
            label="Change Mode" 
            variant="outline"
            onPress={() => {
              // Collapse back to GameSetup
              navigation.dispatch((state: any) => {
                const setupIndex = state.routes.findIndex((r: any) => r.name === "GameSetup");
                if (setupIndex !== -1) {
                  return CommonActions.reset({
                    ...state,
                    routes: state.routes.slice(0, setupIndex + 1),
                    index: setupIndex,
                  });
                }
                return CommonActions.navigate("GameSetup" as any, { gameId });
              });
            }} 
            style={styles.btn}
          />
          <CXButton 
            label="Back to Games" 
            variant="ghost"
            onPress={() => {
              // Collapse back to GamesHub
              navigation.dispatch((state: any) => {
                const hubIndex = state.routes.findIndex((r: any) => r.name === "GamesHub");
                if (hubIndex !== -1) {
                  return CommonActions.reset({
                    ...state,
                    routes: state.routes.slice(0, hubIndex + 1),
                    index: hubIndex,
                  });
                }
                return CommonActions.navigate("GamesHub" as any);
              });
            }} 
            style={styles.btn}
          />
        </View>
      </View>
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.screen,
  },
  icon: {
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  score: {
    marginBottom: spacing.xxxl,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    maxWidth: 320,
    gap: spacing.md,
  },
  btn: {
    width: "100%",
  }
});
