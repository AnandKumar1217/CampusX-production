import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CXScreen, CXHeader, CXIconButton } from "@/components/ui";
import { colors, spacing } from "@/theme";
import { ReversiEngine, Player } from "./ReversiEngine";
import { PauseSheet } from "../../components/PauseSheet";
import { ScoreBoard } from "../../components/ScoreBoard";
import { GameStorage } from "../../engine/GameStorage";

const { width } = Dimensions.get("window");
const BOARD_SIZE = width - spacing.screen * 2;
const CELL_SIZE = BOARD_SIZE / 8;

type Props = NativeStackScreenProps<any, any>;

export function ReversiScreen({ navigation, route }: Props) {
  const { mode, difficulty, matchLength } = route.params as any;
  const isAI = mode === "1P";
  
  const engineRef = useRef(new ReversiEngine());
  const [board, setBoard] = useState(engineRef.current.getBoard());
  const [currentPlayer, setCurrentPlayer] = useState(engineRef.current.getCurrentPlayer());
  const [validMoves, setValidMoves] = useState(engineRef.current.getValidMoves());
  
  // Reversi score is piece count, but match score is match wins
  const [matchScore, setMatchScore] = useState({ p1: 0, p2: 0 });
  const [boardScore, setBoardScore] = useState({ p1: 2, p2: 2 });
  const [round, setRound] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [winner, setWinner] = useState<Player | "DRAW" | null>(null);

  useEffect(() => {
    if (isAI && currentPlayer === 2 && !winner) {
      const timer = setTimeout(() => {
        const aiMove = engineRef.current.getBestMoveForAI(difficulty);
        if (aiMove) {
          executeMove(aiMove.r, aiMove.c);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, winner]);

  const executeMove = (r: number, c: number) => {
    if (engineRef.current.playMove(r, c)) {
      setBoard([...engineRef.current.getBoard().map(row => [...row])]);
      setCurrentPlayer(engineRef.current.getCurrentPlayer());
      setValidMoves(engineRef.current.getValidMoves());
      
      const { p1, p2 } = engineRef.current.getScore();
      setBoardScore({ p1, p2 });

      const gameWinner = engineRef.current.getWinner();
      if (gameWinner) {
        handleRoundEnd(gameWinner);
      }
    }
  };

  const handleCellPress = (r: number, c: number) => {
    if (winner || (isAI && currentPlayer === 2)) return;
    executeMove(r, c);
  };

  const handleRoundEnd = (gameWinner: Player | "DRAW") => {
    let newScore = { ...matchScore };
    if (gameWinner === 1) newScore.p1 += 1;
    if (gameWinner === 2) newScore.p2 += 1;
    setMatchScore(newScore);
    setWinner(gameWinner);
  setTimeout(() => {
    handleRematch(newScore);
  }, 2000);
  };

  const handleRematch = (finalScore: { p1: number, p2: number }) => {
    if (round < matchLength) {
      setRound(r => r + 1);
      engineRef.current = new ReversiEngine();
      setBoard(engineRef.current.getBoard());
      setCurrentPlayer(1);
      setValidMoves(engineRef.current.getValidMoves());
      setBoardScore({ p1: 2, p2: 2 });
      setWinner(null);
    } else {
      finishMatch(finalScore);
    }
  };

  const finishMatch = async (finalScore: { p1: number, p2: number }) => {
    let status = "DRAW";
    if (finalScore.p1 > finalScore.p2) status = isAI ? "WON" : "P1_WIN";
    if (finalScore.p2 > finalScore.p1) status = isAI ? "LOST" : "P2_WIN";
    
    if (isAI) {
      await GameStorage.updateStats("reversi", {
        played: 1,
        wins: status === "WON" ? 1 : 0,
        losses: status === "LOST" ? 1 : 0,
        draws: status === "DRAW" ? 1 : 0,
      });
    }

    navigation.replace("GameResult" as any, {
      gameId: "reversi",
      status,
      scoreText: `${finalScore.p1} - ${finalScore.p2}`,
      ...route.params as any
    });
  };

  const renderCell = (r: number, c: number) => {
    const piece = board[r][c];
    const isMoveDest = validMoves.some(m => m.r === r && m.c === c);

    return (
      <Pressable 
        key={`${r}-${c}`} 
        style={styles.cell} 
        onPress={() => handleCellPress(r, c)}
      >
        {isMoveDest && <View style={styles.moveIndicator} />}
        {piece !== 0 && (
          <View style={[
            styles.piece, 
            piece === 1 ? styles.pieceP1 : styles.pieceP2
          ]} />
        )}
      </Pressable>
    );
  };

  return (
    <CXScreen edges={["top", "bottom"]} style={styles.container}>
      <CXHeader 
        title="Reversi" 
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
        scoreP1={boardScore.p1} 
        scoreP2={boardScore.p2} 
        nameP1="Black" 
        nameP2={isAI ? "AI (White)" : "White"}
        round={round}
        maxRounds={matchLength}
        colorP1="#000000"
        colorP2="#FFFFFF"
      />

      <View style={styles.boardContainer}>
        <View style={styles.board}>
          {board.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((_, c) => renderCell(r, c))}
            </View>
          ))}
        </View>
      </View>

      <PauseSheet 
        visible={isPaused}
        onResume={() => setIsPaused(false)}
        onRestart={() => {
          setIsPaused(false);
          engineRef.current = new ReversiEngine();
          setBoard(engineRef.current.getBoard());
          setCurrentPlayer(1);
          setValidMoves(engineRef.current.getValidMoves());
          setBoardScore({ p1: 2, p2: 2 });
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
    backgroundColor: "#F3F4F6",
  },
  boardContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    backgroundColor: "#22C55E", // Green board
    borderWidth: 4,
    borderColor: "#166534",
  },
  row: {
    flexDirection: "row",
    height: CELL_SIZE,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 1,
    borderColor: "#15803D",
    justifyContent: "center",
    alignItems: "center",
  },
  moveIndicator: {
    width: CELL_SIZE * 0.25,
    height: CELL_SIZE * 0.25,
    borderRadius: CELL_SIZE * 0.125,
    backgroundColor: "rgba(0,0,0,0.2)",
    position: "absolute",
  },
  piece: {
    width: CELL_SIZE * 0.8,
    height: CELL_SIZE * 0.8,
    borderRadius: CELL_SIZE * 0.4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  pieceP1: {
    backgroundColor: "#111827", // Black
  },
  pieceP2: {
    backgroundColor: "#F9FAFB", // White
  }
});
