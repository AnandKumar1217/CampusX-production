import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Pressable, StyleSheet, View, Text } from "react-native";
import { CXHeader, CXButton } from "@/components/ui";
import type { RootStackParamList } from "@/types/navigation";
import { colors, radius, spacing } from "@/theme";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;

type Player = "X" | "O";
type Cell = Player | null;
type Winner = Player | "DRAW" | null;
const WINNING_COMBOS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export function TicTacToeGlowScreen({ navigation }: StackProps<"TicTacToeGlow">) {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState<Winner>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);

  const checkWinner = (newBoard: Cell[]) => {
    for (let combo of WINNING_COMBOS) {
      const [a, b, c] = combo;
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
        setWinner(newBoard[a]);
        setWinningLine([...combo]);
        return true;
      }
    }
    if (!newBoard.includes(null)) {
      setWinner("DRAW");
    }
    return false;
  };

  const handlePress = (index: number) => {
    if (board[index] || winner) return;

    const newBoard = [...board];
    newBoard[index] = isXNext ? "X" : "O";
    setBoard(newBoard);

    let isWin = false;
    for (let combo of WINNING_COMBOS) {
      const [a, b, c] = combo;
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
        setWinner(newBoard[a]);
        setWinningLine([...combo]);
        isWin = true;
        break;
      }
    }

    if (!isWin && !newBoard.includes(null)) {
      setWinner("DRAW");
    } else {
      setIsXNext(!isXNext);
    }
  };

  const reset = () => {
    setBoard(Array(9).fill(null));
    setWinner(null);
    setWinningLine(null);
    setIsXNext(true);
  };

  const renderCell = (index: number) => {
    const value = board[index];
    const isWinningCell = winningLine?.includes(index);

    return (
      <Pressable
        key={index}
        style={[styles.cell, isWinningCell && styles.winningCell]}
        onPress={() => handlePress(index)}
      >
        <Text style={[
          styles.cellText,
          value === "X" ? styles.xText : styles.oText
        ]}>
          {value}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <CXHeader title="Tic Tac Toe Glow" onBack={navigation.goBack} />
      <View style={styles.content}>

        <View style={styles.statusContainer}>
          {winner === "DRAW" ? (
            <Text style={styles.statusText}>{"It's a Draw!"}</Text>
          ) : winner ? (
            <Text style={[styles.statusText, winner === "X" ? styles.xText : styles.oText]}>
              Player {winner} Wins!
            </Text>
          ) : (
            <Text style={styles.statusText}>
              Turn: <Text style={isXNext ? styles.xText : styles.oText}>{isXNext ? "X" : "O"}</Text>
            </Text>
          )}
        </View>

        <View style={styles.board}>
          {[0, 1, 2].map((row) => (
            <View key={row} style={styles.row}>
              {[0, 1, 2].map((col) => renderCell(row * 3 + col))}
            </View>
          ))}
        </View>

        {(winner || winner === "DRAW") && (
          <View style={styles.resetButton}>
            <CXButton label="Play Again" onPress={reset} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusContainer: {
    marginBottom: spacing.xxxl,
    height: 40,
    justifyContent: "center",
  },
  statusText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textShadowColor: "rgba(255,255,255,0.5)",
    textShadowRadius: 10,
  },
  board: {
    padding: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  row: {
    flexDirection: "row",
  },
  cell: {
    width: 100,
    height: 100,
    margin: 4,
    backgroundColor: "#1E293B",
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  winningCell: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "#FFFFFF",
  },
  cellText: {
    fontSize: 64,
    fontWeight: "bold",
  },
  xText: {
    color: "#F472B6", // Pink
    textShadowColor: "#EC4899",
    textShadowRadius: 15,
  },
  oText: {
    color: "#38BDF8", // Cyan
    textShadowColor: "#0EA5E9",
    textShadowRadius: 15,
  },
  resetButton: {
    marginTop: spacing.xxxl,
    width: 200,
  }
});
