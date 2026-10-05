// @ts-nocheck
import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Dimensions, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CXScreen, CXHeader, CXIconButton, CXText } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";
import { MancalaEngine, Player } from "./MancalaEngine";
import { PauseSheet } from "../../components/PauseSheet";
import { ScoreBoard } from "../../components/ScoreBoard";
import { GameStorage } from "../../engine/GameStorage";

const { width } = Dimensions.get("window");

type Props = NativeStackScreenProps<any, any>;

export function MancalaScreen({ navigation, route }: Props) {
  const { mode, difficulty, matchLength } = route.params as any;
  const isAI = mode === "1P";
  
  const engineRef = useRef(new MancalaEngine());
  const [board, setBoard] = useState(engineRef.current.getBoard());
  const [currentPlayer, setCurrentPlayer] = useState(engineRef.current.getCurrentPlayer());
  const [extraTurnMsg, setExtraTurnMsg] = useState(false);
  
  // matchScore vs gameScore
  const [matchScore, setMatchScore] = useState({ p1: 0, p2: 0 });
  const [gameScore, setGameScore] = useState(engineRef.current.getScore());
  
  const [round, setRound] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [winner, setWinner] = useState<Player | "DRAW" | null>(null);

  useEffect(() => {
    if (isAI && currentPlayer === 2 && !winner) {
      const timer = setTimeout(() => {
        const aiMove = engineRef.current.getBestMoveForAI(difficulty);
        if (aiMove !== null) {
          executeMove(aiMove);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, winner]);

  const executeMove = (pitIndex: number) => {
    if (engineRef.current.playMove(pitIndex)) {
      setBoard([...engineRef.current.getBoard()]);
      setCurrentPlayer(engineRef.current.getCurrentPlayer());
      setGameScore(engineRef.current.getScore());
      
      setExtraTurnMsg(engineRef.current.hasExtraTurn());
      if (engineRef.current.hasExtraTurn()) {
        setTimeout(() => setExtraTurnMsg(false), 1500);
      }

      const gameWinner = engineRef.current.getWinner();
      if (gameWinner) {
        handleRoundEnd(gameWinner);
      }
    }
  };

  const handleCellPress = (pitIndex: number) => {
    if (winner || (isAI && currentPlayer === 2)) return;
    executeMove(pitIndex);
  };

  const handleRoundEnd = (gameWinner: Player | "DRAW") => {
    let newScore = { ...matchScore };
    if (gameWinner === 1) newScore.p1 += 1;
    if (gameWinner === 2) newScore.p2 += 1;
    setMatchScore(newScore);
    setWinner(gameWinner);
  setTimeout(() => {
    handleRematch();
  }, 2000);
  };

  const handleRematch = () => {
    if (round < matchLength) {
      setRound(r => r + 1);
      engineRef.current = new MancalaEngine();
      setBoard(engineRef.current.getBoard());
      setCurrentPlayer(1);
      setGameScore({ p1: 0, p2: 0 });
      setWinner(null);
    } else {
      finishMatch();
    }
  };

  const finishMatch = async () => {
    let status = "DRAW";
    if (matchScore.p1 > matchScore.p2) status = isAI ? "WON" : "P1_WIN";
    if (matchScore.p2 > matchScore.p1) status = isAI ? "LOST" : "P2_WIN";
    
    if (isAI) {
      await GameStorage.updateStats("mancala", {
        played: 1,
        wins: status === "WON" ? 1 : 0,
        losses: status === "LOST" ? 1 : 0,
        draws: status === "DRAW" ? 1 : 0,
      });
    }

    navigation.replace("GameResult" as any, {
      gameId: "mancala",
      status,
      scoreText: `${matchScore.p1} - ${matchScore.p2}`,
      ...route.params as any
    });
  };

  const renderPit = (index: number, isP1: boolean) => {
    const seeds = board[index];
    const isClickable = currentPlayer === (isP1 ? 1 : 2) && seeds > 0;
    
    return (
      <Pressable 
        key={index} 
        style={[styles.pit, isClickable && styles.clickablePit]} 
        onPress={() => isClickable && handleCellPress(index)}
      >
        <Text style={styles.seedText}>{seeds}</Text>
      </Pressable>
    );
  };

  const p1Pits = [0, 1, 2, 3, 4, 5];
  const p2Pits = [12, 11, 10, 9, 8, 7]; // reversed for top row

  return (
    <CXScreen edges={["top", "bottom"]} style={styles.container}>
      <CXHeader 
        title="Mancala" 
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
        scoreP1={matchScore.p1} 
        scoreP2={matchScore.p2} 
        nameP1="Player 1" 
        nameP2={isAI ? "AI" : "Player 2"}
        round={round}
        maxRounds={matchLength}
        colorP1="#8B5CF6"
        colorP2="#F59E0B"
      />

      <View style={styles.boardWrapper}>
        {extraTurnMsg && (
          <CXText variant="bodyStrong" align="center" style={styles.extraTurnText}>
            {currentPlayer === 1 ? "Player 1" : isAI ? "AI" : "Player 2"} gets an extra turn!
          </CXText>
        )}
        
        <View style={styles.mancalaBoard}>
          {/* P2 Mancala */}
          <View style={[styles.mancalaStore, styles.mancalaP2]}>
            <Text style={styles.storeText}>{board[13]}</Text>
          </View>
          
          {/* Pits Grid */}
          <View style={styles.pitsGrid}>
            <View style={styles.pitRow}>
              {p2Pits.map(i => renderPit(i, false))}
            </View>
            <View style={styles.pitRow}>
              {p1Pits.map(i => renderPit(i, true))}
            </View>
          </View>

          {/* P1 Mancala */}
          <View style={[styles.mancalaStore, styles.mancalaP1]}>
            <Text style={styles.storeText}>{board[6]}</Text>
          </View>
        </View>
      </View>

      <PauseSheet 
        visible={isPaused}
        onResume={() => setIsPaused(false)}
        onRestart={() => {
          setIsPaused(false);
          engineRef.current = new MancalaEngine();
          setBoard(engineRef.current.getBoard());
          setCurrentPlayer(1);
          setGameScore({ p1: 0, p2: 0 });
          setMatchScore({ p1: 0, p2: 0 });
          setRound(1);
          setWinner(null);
        }}
        onSettings={() => {}}
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
    backgroundColor: "#F8FAFC",
  },
  boardWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  extraTurnText: {
    marginBottom: spacing.md,
    color: "#2563EB",
  },
  mancalaBoard: {
    flexDirection: "row",
    backgroundColor: "#D97706", // Wood color
    padding: spacing.sm,
    borderRadius: 30,
    width: "100%",
    height: 180,
    alignItems: "center",
    justifyContent: "space-between",
  },
  mancalaStore: {
    width: 50,
    height: 140,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  mancalaP1: {
    borderColor: "#8B5CF6",
    borderWidth: 2,
  },
  mancalaP2: {
    borderColor: "#F59E0B",
    borderWidth: 2,
  },
  storeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.white,
  },
  pitsGrid: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    height: 140,
  },
  pitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flex: 1,
    paddingVertical: spacing.xs,
  },
  pit: {
    width: (width - 150) / 6,
    height: "100%",
    borderRadius: 50,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2,
  },
  clickablePit: {
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  seedText: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.white,
  }
});
