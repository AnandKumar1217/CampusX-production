import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CXScreen, CXHeader, CXIconButton } from "@/components/ui";
import { colors, spacing } from "@/theme";
import { DotsAndBoxesEngine, Move, Player } from "./DotsAndBoxesEngine";
import { PauseSheet } from "../../components/PauseSheet";
import { ScoreBoard } from "../../components/ScoreBoard";
import { GameStorage } from "../../engine/GameStorage";

const { width } = Dimensions.get("window");

const GRID_SIZE = 5; // 5x5 boxes
const BOARD_SIZE = width - spacing.screen * 2;
const DOT_SIZE = 12;
const LINE_LENGTH = (BOARD_SIZE - (GRID_SIZE + 1) * DOT_SIZE) / GRID_SIZE;
const LINE_THICKNESS = 16;

type Props = NativeStackScreenProps<any, any>;

export function DotsAndBoxesScreen({ navigation, route }: Props) {
  const { mode, difficulty, matchLength } = route.params as any;
  const isAI = mode === "1P";
  
  const engineRef = useRef(new DotsAndBoxesEngine(GRID_SIZE, GRID_SIZE));
  const [engineState, setEngineState] = useState(engineRef.current);
  
  // matchScore is overall rounds, gameScore is boxes
  const [matchScore, setMatchScore] = useState({ p1: 0, p2: 0 });
  const [gameScore, setGameScore] = useState({ p1: 0, p2: 0 });
  
  const [round, setRound] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [winner, setWinner] = useState<Player | "DRAW" | null>(null);

  // Trigger re-render by cloning
  const triggerRender = () => {
    setEngineState(Object.assign(Object.create(Object.getPrototypeOf(engineRef.current)), engineRef.current));
  };

  useEffect(() => {
    if (isAI && engineState.getCurrentPlayer() === 2 && !winner) {
      const timer = setTimeout(() => {
        const aiMove = engineRef.current.getBestMoveForAI(difficulty);
        if (aiMove) {
          executeMove(aiMove);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [engineState.getCurrentPlayer(), winner]);

  const executeMove = (move: Move) => {
    if (engineRef.current.playMove(move)) {
      setGameScore(engineRef.current.getScore());
      triggerRender();
      
      const gameWinner = engineRef.current.getWinner();
      if (gameWinner) {
        handleRoundEnd(gameWinner);
      }
    }
  };

  const handleLinePress = (r: number, c: number, type: "h" | "v") => {
    if (winner || (isAI && engineRef.current.getCurrentPlayer() === 2)) return;
    executeMove({ r, c, type });
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
      engineRef.current = new DotsAndBoxesEngine(GRID_SIZE, GRID_SIZE);
      triggerRender();
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
      await GameStorage.updateStats("dotsandboxes", {
        played: 1,
        wins: status === "WON" ? 1 : 0,
        losses: status === "LOST" ? 1 : 0,
        draws: status === "DRAW" ? 1 : 0,
      });
    }

    navigation.replace("GameResult" as any, {
      gameId: "dotsandboxes",
      status,
      scoreText: `${matchScore.p1} - ${matchScore.p2}`,
      ...route.params as any
    });
  };

  const hLines = engineState.getHLines();
  const vLines = engineState.getVLines();
  const boxes = engineState.getBoxes();

  return (
    <CXScreen edges={["top", "bottom"]} style={styles.container}>
      <CXHeader 
        title="Dots & Boxes" 
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
        scoreP1={gameScore.p1} 
        scoreP2={gameScore.p2} 
        nameP1="Player 1" 
        nameP2={isAI ? "AI" : "Player 2"}
        round={round}
        maxRounds={matchLength}
        colorP1="#3B82F6"
        colorP2="#EC4899"
      />

      <View style={styles.boardContainer}>
        <View style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
          {/* Render Boxes */}
          {boxes.map((row, r) =>
            row.map((val, c) => (
              val !== 0 && (
                <View 
                  key={`box-${r}-${c}`}
                  style={[
                    styles.box,
                    { 
                      left: c * (LINE_LENGTH + DOT_SIZE) + DOT_SIZE, 
                      top: r * (LINE_LENGTH + DOT_SIZE) + DOT_SIZE,
                      backgroundColor: val === 1 ? "rgba(59, 130, 246, 0.4)" : "rgba(236, 72, 153, 0.4)"
                    }
                  ]}
                />
              )
            ))
          )}

          {/* Render Horizontal Lines */}
          {hLines.map((row, r) =>
            row.map((val, c) => (
              <Pressable
                key={`h-${r}-${c}`}
                style={[
                  styles.hLine,
                  { 
                    left: c * (LINE_LENGTH + DOT_SIZE) + DOT_SIZE, 
                    top: r * (LINE_LENGTH + DOT_SIZE) - (LINE_THICKNESS - DOT_SIZE) / 2 
                  },
                  val ? styles.lineFilled : styles.lineEmpty
                ]}
                onPress={() => handleLinePress(r, c, "h")}
              />
            ))
          )}

          {/* Render Vertical Lines */}
          {vLines.map((row, r) =>
            row.map((val, c) => (
              <Pressable
                key={`v-${r}-${c}`}
                style={[
                  styles.vLine,
                  { 
                    left: c * (LINE_LENGTH + DOT_SIZE) - (LINE_THICKNESS - DOT_SIZE) / 2, 
                    top: r * (LINE_LENGTH + DOT_SIZE) + DOT_SIZE 
                  },
                  val ? styles.lineFilled : styles.lineEmpty
                ]}
                onPress={() => handleLinePress(r, c, "v")}
              />
            ))
          )}

          {/* Render Dots */}
          {Array(GRID_SIZE + 1).fill(0).map((_, r) =>
            Array(GRID_SIZE + 1).fill(0).map((_, c) => (
              <View 
                key={`dot-${r}-${c}`}
                style={[
                  styles.dot,
                  { 
                    left: c * (LINE_LENGTH + DOT_SIZE), 
                    top: r * (LINE_LENGTH + DOT_SIZE) 
                  }
                ]}
              />
            ))
          )}
        </View>
      </View>

      <PauseSheet 
        visible={isPaused}
        onResume={() => setIsPaused(false)}
        onRestart={() => {
          setIsPaused(false);
          engineRef.current = new DotsAndBoxesEngine(GRID_SIZE, GRID_SIZE);
          triggerRender();
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
  boardContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "#334155",
    zIndex: 10,
  },
  hLine: {
    position: "absolute",
    width: LINE_LENGTH,
    height: LINE_THICKNESS,
    borderRadius: LINE_THICKNESS / 2,
    zIndex: 5,
  },
  vLine: {
    position: "absolute",
    width: LINE_THICKNESS,
    height: LINE_LENGTH,
    borderRadius: LINE_THICKNESS / 2,
    zIndex: 5,
  },
  lineEmpty: {
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  lineFilled: {
    backgroundColor: "#334155",
  },
  box: {
    position: "absolute",
    width: LINE_LENGTH,
    height: LINE_LENGTH,
    zIndex: 1,
  }
});
