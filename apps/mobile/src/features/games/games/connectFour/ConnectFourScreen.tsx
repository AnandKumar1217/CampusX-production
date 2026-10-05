// @ts-nocheck
import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CXScreen, CXHeader, CXIconButton } from "@/components/ui";
import { colors, spacing, radius } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";
import { ConnectFourEngine, Player } from "./ConnectFourEngine";
import { PauseSheet } from "../../components/PauseSheet";
import { ScoreBoard } from "../../components/ScoreBoard";
import { GameStorage } from "../../engine/GameStorage";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<any, any>;

export function ConnectFourScreen({ navigation, route }: Props) {
  const { mode, difficulty, matchLength } = route.params as any;
  const isAI = mode === "1P";
  
  const engineRef = useRef(new ConnectFourEngine());
  const [board, setBoard] = useState(engineRef.current.getBoard());
  const [currentPlayer, setCurrentPlayer] = useState(engineRef.current.getCurrentPlayer());
  
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [round, setRound] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isAI && currentPlayer === 2 && !engineRef.current.getWinner()) {
      const timer = setTimeout(() => {
        const aiMove = engineRef.current.getBestMoveForAI(difficulty);
        if (aiMove !== -1) {
          handlePlay(aiMove);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer]);

  const handlePlay = (col: number) => {
    if (engineRef.current.playMove(col)) {
      setBoard(engineRef.current.getBoard().map(row => [...row]));
      setCurrentPlayer(engineRef.current.getCurrentPlayer());
      
      const winner = engineRef.current.getWinner();
      if (winner) {
        handleRoundEnd(winner);
      }
    }
  };

  const handleRoundEnd = (winner: Player | "DRAW") => {
    let newScore = { ...score };
    if (winner === 1) newScore.p1 += 1;
    if (winner === 2) newScore.p2 += 1;
    setScore(newScore);

    setTimeout(() => {
      if (round < matchLength) {
        setRound(r => r + 1);
        engineRef.current = new ConnectFourEngine();
        setBoard(engineRef.current.getBoard());
        setCurrentPlayer(1);
      } else {
        finishMatch(newScore);
      }
    }, 1500);
  };

  const finishMatch = async (finalScore: {p1: number, p2: number}) => {
    let status = "DRAW";
    if (finalScore.p1 > finalScore.p2) status = isAI ? "WON" : "P1_WIN";
    if (finalScore.p2 > finalScore.p1) status = isAI ? "LOST" : "P2_WIN";
    
    if (isAI) {
      await GameStorage.updateStats("connectfour", {
        played: 1,
        wins: status === "WON" ? 1 : 0,
        losses: status === "LOST" ? 1 : 0,
        draws: status === "DRAW" ? 1 : 0,
      });
    }

    navigation.replace("GameResult" as any, {
      gameId: "connectfour",
      status,
      scoreText: `${finalScore.p1} - ${finalScore.p2}`,
      ...route.params as any
    });
  };

  const renderCell = (r: number, c: number) => {
    const value = board[r][c];
    return (
      <View key={`${r}-${c}`} style={styles.cell}>
        <View style={[styles.hole, value === 1 && styles.p1Hole, value === 2 && styles.p2Hole]} />
      </View>
    );
  };

  return (
    <CXScreen edges={["top", "bottom"]} style={styles.container}>
      <CXHeader 
        title="Connect Four" 
        onBack={() => setIsPaused(true)}
        right={
            <CXIconButton 
              icon="pause" 
              onPress={() => setIsPaused(true)} 
              backgroundColor={colors.transparent}
              label=""
            />
        }
      />
      
      <ScoreBoard 
        scoreP1={score.p1} 
        scoreP2={score.p2} 
        nameP1="Player 1" 
        nameP2={isAI ? "AI" : "Player 2"}
        round={round}
        maxRounds={matchLength}
        colorP1="#F59E0B"
        colorP2="#EF4444"
      />

      <View style={styles.gameArea}>
        <View style={styles.boardContainer}>
          <View style={styles.board}>
            {board.map((row, r) => (
              <View key={`row-${r}`} style={styles.row}>
                {row.map((_, c) => renderCell(r, c))}
              </View>
            ))}
          </View>
          
          <View style={styles.overlayControls}>
            {[0,1,2,3,4,5,6].map(c => (
              <Pressable 
                key={`col-${c}`} 
                style={styles.colControl} 
                onPress={() => handlePlay(c)}
                disabled={board[0][c] !== null || (isAI && currentPlayer === 2) || engineRef.current.getWinner() !== null}
              >
                {/* Arrow indicator could go here */}
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <PauseSheet 
        visible={isPaused}
        onResume={() => setIsPaused(false)}
        onRestart={() => {
          setIsPaused(false);
          engineRef.current = new ConnectFourEngine();
          setBoard(engineRef.current.getBoard());
          setCurrentPlayer(1);
          setScore({ p1: 0, p2: 0 });
          setRound(1);
        }}
        onQuit={() => {
          setIsPaused(false);
          navigation.dispatch((state) => {
            const hubIndex = state.routes.findIndex((r) => r.name === 'GamesHub');
            if (hubIndex !== -1) {
              return CommonActions.reset({
                ...state,
                routes: state.routes.slice(0, hubIndex + 1),
                index: hubIndex,
              });
            }
            return CommonActions.navigate('GamesHub');
          });
        }}
      />
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  gameArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  boardContainer: {
    position: "relative",
  },
  board: {
    backgroundColor: "#3B82F6", // Blue board
    padding: 8,
    borderRadius: radius.md,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  cell: {
    width: 40,
    height: 40,
    backgroundColor: "#1D4ED8", // Darker blue inside the board around the hole
    borderRadius: 20,
    overflow: "hidden",
  },
  hole: {
    flex: 1,
    backgroundColor: colors.background, // Empty hole shows background
    borderRadius: 20,
  },
  p1Hole: {
    backgroundColor: "#F59E0B", // Yellow
  },
  p2Hole: {
    backgroundColor: "#EF4444", // Red
  },
  overlayControls: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  colControl: {
    flex: 1,
    height: "100%",
  }
});
