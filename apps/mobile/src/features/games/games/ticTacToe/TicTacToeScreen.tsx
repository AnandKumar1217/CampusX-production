// @ts-nocheck
import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CXScreen, CXHeader, CXIconButton } from "@/components/ui";
import { colors, spacing, radius } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";
import { Ionicons } from "@expo/vector-icons";
import { TicTacToeEngine, Player } from "./TicTacToeEngine";
import { PauseSheet } from "../../components/PauseSheet";
import { ScoreBoard } from "../../components/ScoreBoard";
import { GameStorage } from "../../engine/GameStorage";

type Props = NativeStackScreenProps<any, any>;

export function TicTacToeScreen({ navigation, route }: Props) {
  const { mode, difficulty, matchLength } = route.params as any;
  const isAI = mode === "1P";
  
  const engineRef = useRef(new TicTacToeEngine());
  const [board, setBoard] = useState(engineRef.current.getBoard());
  const [currentPlayer, setCurrentPlayer] = useState(engineRef.current.getCurrentPlayer());
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  
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
      }, 500); // Artificial delay
      return () => clearTimeout(timer);
    }
  }, [currentPlayer]);

  const handlePlay = (index: number) => {
    if (engineRef.current.playMove(index)) {
      setBoard([...engineRef.current.getBoard()]);
      setCurrentPlayer(engineRef.current.getCurrentPlayer());
      
      const winner = engineRef.current.getWinner();
      if (winner) {
        setWinningLine(engineRef.current.getWinningLine());
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
        engineRef.current = new TicTacToeEngine();
        setBoard(engineRef.current.getBoard());
        setCurrentPlayer(1);
        setWinningLine(null);
      } else {
        finishMatch(newScore);
      }
    }, 1500);
  };

  const finishMatch = async (finalScore: {p1: number, p2: number}) => {
    let status = "DRAW";
    if (finalScore.p1 > finalScore.p2) status = isAI ? "WON" : "P1_WIN";
    if (finalScore.p2 > finalScore.p1) status = isAI ? "LOST" : "P2_WIN";
    
    // Save stats offline
    if (isAI) {
      await GameStorage.updateStats("tictactoe", {
        played: 1,
        wins: status === "WON" ? 1 : 0,
        losses: status === "LOST" ? 1 : 0,
        draws: status === "DRAW" ? 1 : 0,
      });
    }

    navigation.replace("GameResult" as any, {
      gameId: "tictactoe",
      status,
      scoreText: `${finalScore.p1} - ${finalScore.p2}`,
      ...route.params as any
    });
  };

  const renderCell = (index: number) => {
    const value = board[index];
    const isWinningCell = winningLine?.includes(index);
    
    return (
      <Pressable 
        key={index} 
        style={[styles.cell, isWinningCell && styles.winningCell]} 
        onPress={() => handlePlay(index)}
        disabled={value !== null || (isAI && currentPlayer === 2)}
      >
        {value === 1 && <Ionicons name="close" size={60} color="#8B5CF6" />}
        {value === 2 && <Ionicons name="ellipse-outline" size={50} color="#F59E0B" />}
      </Pressable>
    );
  };

  return (
    <CXScreen edges={["top", "bottom"]} style={styles.container}>
      <CXHeader 
        title="Tic Tac Toe" 
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
        colorP1="#8B5CF6"
        colorP2="#F59E0B"
      />

      <View style={styles.boardContainer}>
        <View style={styles.board}>
          {[0,1,2,3,4,5,6,7,8].map(i => renderCell(i))}
        </View>
      </View>

      <PauseSheet 
        visible={isPaused}
        onResume={() => setIsPaused(false)}
        onRestart={() => {
          setIsPaused(false);
          engineRef.current = new TicTacToeEngine();
          setBoard(engineRef.current.getBoard());
          setCurrentPlayer(1);
          setWinningLine(null);
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
  boardContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  board: {
    width: 320,
    height: 320,
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: colors.borderSoft,
    gap: 10, // grid lines
  },
  cell: {
    width: 100,
    height: 100,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  winningCell: {
    backgroundColor: "#F3F4F6",
  }
});
