import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState, useRef } from "react";
import { Pressable, StyleSheet, View, Text } from "react-native";
import type { RootStackParamList } from "@/types/navigation";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;

type GameState = "idle" | "waiting" | "ready" | "finished";

export function ReactionBattleScreen({ navigation }: StackProps<"ReactionBattle">) {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [winner, setWinner] = useState<"p1" | "p2" | null>(null);
  const [message, setMessage] = useState("Tap to Start");

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startRound = () => {
    setGameState("waiting");
    setWinner(null);
    setMessage("Wait for GREEN...");

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const delay = Math.floor(Math.random() * 4000) + 2000; // 2 to 6 seconds
    timeoutRef.current = setTimeout(() => {
      setGameState("ready");
      setMessage("TAP NOW!");
    }, delay);
  };

  const handleTap = (player: "p1" | "p2") => {
    if (gameState === "idle" || gameState === "finished") {
      if (gameState === "finished") {
        startRound();
      } else {
        startRound();
      }
      return;
    }

    if (gameState === "waiting") {
      // False start
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setGameState("finished");
      const other = player === "p1" ? "p2" : "p1";
      setWinner(other);
      setScore(prev => ({ ...prev, [other]: prev[other] + 1 }));
      setMessage(`False Start! P${other === "p1" ? "1" : "2"} Wins!`);
      return;
    }

    if (gameState === "ready") {
      setGameState("finished");
      setWinner(player);
      setScore(prev => ({ ...prev, [player]: prev[player] + 1 }));
      setMessage(`Player ${player === "p1" ? "1" : "2"} Wins!`);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getBgColor = () => {
    if (gameState === "ready") return "#22C55E"; // Neon Green
    if (gameState === "waiting") return "#EF4444"; // Red
    return "#0F172A"; // Idle/Finished
  };

  return (
    <View style={[styles.container, { backgroundColor: getBgColor() }]}>

      {/* Back button */}
      <Pressable style={styles.backButton} onPress={navigation.goBack}>
        <Ionicons name="close" size={32} color="#FFF" />
      </Pressable>

      {/* Player 1 (Top) - Rotated 180 degrees */}
      <Pressable
        style={styles.half}
        onPress={() => handleTap("p1")}
      >
        <View style={[styles.content, { transform: [{ rotate: "180deg" }] }]}>
          <Text style={styles.scoreText}>{score.p1}</Text>
          <Text style={styles.messageText}>
            {winner === "p1" ? "WINNER!" : winner === "p2" ? "TOO SLOW" : message}
          </Text>
        </View>
      </Pressable>

      <View style={styles.divider} />

      {/* Player 2 (Bottom) */}
      <Pressable
        style={styles.half}
        onPress={() => handleTap("p2")}
      >
        <View style={styles.content}>
          <Text style={styles.messageText}>
            {winner === "p2" ? "WINNER!" : winner === "p1" ? "TOO SLOW" : message}
          </Text>
          <Text style={styles.scoreText}>{score.p2}</Text>
        </View>
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: 50,
    zIndex: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  half: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    width: "100%",
  },
  scoreText: {
    fontSize: 80,
    fontWeight: "bold",
    color: "rgba(255,255,255,0.3)",
    marginBottom: 20,
  },
  messageText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 10,
  }
});
