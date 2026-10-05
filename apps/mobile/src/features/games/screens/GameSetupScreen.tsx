import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CXScreen, CXHeader, CXButton, CXSectionHeader, CXRow, CXChip } from "@/components/ui";
import { spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";

type Props = NativeStackScreenProps<any, any>;

export function GameSetupScreen({ navigation, route }: Props) {
  const gameId = (route.params as any)?.gameId || "unknown";
  
  const [mode, setMode] = useState<"1P" | "2P" | "3P" | "4P">("1P");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [matchLength, setMatchLength] = useState<"1" | "3" | "5">("1");

  const gameTitles: Record<string, string> = {
    tictactoe: "Tic Tac Toe",
    connectfour: "Connect Four",
    checkers: "Checkers",
    chess: "Chess",
    reversi: "Reversi",
    mancala: "Mancala",
    dotsandboxes: "Dots & Boxes",
    pong: "Pong Battle",
    airhockey: "Air Hockey",
    snake: "Snake Battle",
    football: "Finger Football",


    reaction: "Reaction Tap",
    quiz: "Quick Quiz Battle",
    maze: "Color Maze"
  };

  const title = gameTitles[gameId] || "Game Setup";

  const handleStart = () => {
    navigation.navigate("ActiveGame" as any, { 
      gameId, 
      mode, 
      difficulty, 
      matchLength: parseInt(matchLength, 10) 
    });
  };

  let modes = ["1P", "2P"];
  if (["checkers", "chess", "dotsandboxes"].includes(gameId)) {
    modes = ["2P"];
  } else if (["quiz"].includes(gameId)) {
    modes = ["1P", "2P", "3P", "4P"];
  } else if (["reaction"].includes(gameId)) {
    modes = ["2P", "3P", "4P"];
  } else if (["maze"].includes(gameId)) {
    modes = ["1P"];
  }

  // Ensure default mode is valid for the game
  React.useEffect(() => {
    if (!modes.includes(mode)) {
      setMode(modes[0] as any);
    }
  }, [gameId]);

  return (
    <CXScreen edges={["top", "bottom"]}>
      <CXHeader title={title} subtitle="Match Setup" onBack={navigation.goBack} />
      
      <View style={styles.content}>
        <CXSectionHeader title="Mode" />
        <CXRow style={styles.options}>
          {modes.includes("1P") && <CXChip label="Solo" active={mode === "1P"} onPress={() => setMode("1P")} />}
          {modes.includes("2P") && <CXChip label="2 Players" active={mode === "2P"} onPress={() => setMode("2P")} />}
          {modes.includes("3P") && <CXChip label="3 Players" active={mode === "3P"} onPress={() => setMode("3P")} />}
          {modes.includes("4P") && <CXChip label="4 Players" active={mode === "4P"} onPress={() => setMode("4P")} />}
        </CXRow>

        {mode === "1P" && (
          <>
            <CXSectionHeader title="Difficulty" />
            <CXRow style={styles.options}>
              <CXChip label="Easy" active={difficulty === "Easy"} onPress={() => setDifficulty("Easy")} />
              <CXChip label="Medium" active={difficulty === "Medium"} onPress={() => setDifficulty("Medium")} />
              <CXChip label="Hard" active={difficulty === "Hard"} onPress={() => setDifficulty("Hard")} />
            </CXRow>
          </>
        )}

        <CXSectionHeader title="Match Length" />
        <CXRow style={styles.options}>
          <CXChip label="Single Round" active={matchLength === "1"} onPress={() => setMatchLength("1")} />
          <CXChip label="Best of 3" active={matchLength === "3"} onPress={() => setMatchLength("3")} />
          <CXChip label="Best of 5" active={matchLength === "5"} onPress={() => setMatchLength("5")} />
        </CXRow>

        <View style={styles.spacer} />

        <CXButton label="Start Game" onPress={handleStart} style={styles.actionBtn} />
        <CXButton label="Back" variant="outline" onPress={navigation.goBack} style={styles.actionBtn} />
      </View>
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.screen,
    flex: 1,
  },
  options: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  spacer: {
    flex: 1,
  },
  actionBtn: {
    marginBottom: spacing.md,
  }
});
