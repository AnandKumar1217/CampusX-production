// @ts-nocheck
import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Dimensions, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CXScreen, CXHeader, CXIconButton, CXText } from "@/components/ui";
import { colors, spacing } from "@/theme";
import { ChessEngine, Player } from "./ChessEngine";
import { PauseSheet } from "../../components/PauseSheet";
import { ScoreBoard } from "../../components/ScoreBoard";
import { GameStorage } from "../../engine/GameStorage";
import { Move as ChessMove } from "chess.js";

const { width } = Dimensions.get("window");
const BOARD_SIZE = width - spacing.screen * 2;
const CELL_SIZE = BOARD_SIZE / 8;

const UNICODE_PIECES: Record<string, string> = {
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟"
};

type Props = NativeStackScreenProps<any, any>;

export function ChessScreen({ navigation, route }: Props) {
  const { mode, difficulty, matchLength } = route.params as any;
  const isAI = mode === "1P";
  
  const engineRef = useRef(new ChessEngine());
  const [board, setBoard] = useState(engineRef.current.getBoard());
  const [currentPlayer, setCurrentPlayer] = useState(engineRef.current.getCurrentPlayer());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<ChessMove[]>([]);
  
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [round, setRound] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [winner, setWinner] = useState<Player | "DRAW" | null>(null);

  useEffect(() => {
    if (isAI && currentPlayer === "b" && !winner) {
      const timer = setTimeout(() => {
        const aiMove = engineRef.current.getBestMoveForAI(difficulty);
        if (aiMove) {
          executeMove(aiMove);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, winner]);

  const executeMove = (move: string | {from: string, to: string, promotion?: string}) => {
    if (engineRef.current.playMove(move)) {
      setBoard(engineRef.current.getBoard());
      setCurrentPlayer(engineRef.current.getCurrentPlayer());
      setSelectedSquare(null);
      setValidMoves([]);
      
      const gameWinner = engineRef.current.getWinner();
      if (gameWinner) {
        handleRoundEnd(gameWinner);
      }
    }
  };

  const indexToSquare = (r: number, c: number) => {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    return `${files[c]}${8 - r}`;
  };

  const handleCellPress = (r: number, c: number) => {
    if (winner || (isAI && currentPlayer === "b")) return;

    const square = indexToSquare(r, c);

    // Is it a valid move destination?
    const move = validMoves.find(m => m.to === square);
    if (move) {
      executeMove(move.promotion ? { from: move.from, to: move.to, promotion: "q" } : move);
      return;
    }

    // Selecting a piece
    const piece = board[r][c];
    if (piece && piece.color === currentPlayer) {
      const moves = engineRef.current.getValidMoves(square);
      if (moves.length > 0) {
        setSelectedSquare(square);
        setValidMoves(moves);
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  const handleRoundEnd = (gameWinner: Player | "DRAW") => {
    let newScore = { ...score };
    if (gameWinner === "w") newScore.p1 += 1;
    if (gameWinner === "b") newScore.p2 += 1;
    setScore(newScore);
    setWinner(gameWinner);
  setTimeout(() => {
    handleRematch();
  }, 2000);
  };

  const handleRematch = () => {
    if (round < matchLength) {
      setRound(r => r + 1);
      engineRef.current = new ChessEngine();
      setBoard(engineRef.current.getBoard());
      setCurrentPlayer("w");
      setWinner(null);
    } else {
      finishMatch();
    }
  };

  const finishMatch = async () => {
    let status = "DRAW";
    if (score.p1 > score.p2) status = isAI ? "WON" : "P1_WIN";
    if (score.p2 > score.p1) status = isAI ? "LOST" : "P2_WIN";
    
    if (isAI) {
      await GameStorage.updateStats("chess", {
        played: 1,
        wins: status === "WON" ? 1 : 0,
        losses: status === "LOST" ? 1 : 0,
        draws: status === "DRAW" ? 1 : 0,
      });
    }

    navigation.replace("GameResult" as any, {
      gameId: "chess",
      status,
      scoreText: `${score.p1} - ${score.p2}`,
      ...route.params as any
    });
  };

  const renderCell = (r: number, c: number) => {
    const isDark = (r + c) % 2 === 1;
    const piece = board[r][c];
    const square = indexToSquare(r, c);
    const isSelected = selectedSquare === square;
    const isMoveDest = validMoves.some(m => m.to === square);
    const isCheck = piece && piece.type === 'k' && piece.color === currentPlayer && engineRef.current.isCheck();

    return (
      <Pressable 
        key={`${r}-${c}`} 
        style={[
          styles.cell, 
          { backgroundColor: isDark ? "#769656" : "#eeeed2" },
          isSelected && styles.selectedCell,
          isCheck && styles.checkCell
        ]} 
        onPress={() => handleCellPress(r, c)}
      >
        {isMoveDest && (
          <View style={[styles.moveIndicator, piece ? styles.captureIndicator : null]} />
        )}
        {piece && (
          <Text style={[
            styles.pieceText, 
            { color: piece.color === "w" ? "#ffffff" : "#000000" },
            piece.color === "w" && styles.pieceShadow
          ]}>
            {UNICODE_PIECES[piece.type]}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <CXScreen edges={["top", "bottom"]} style={styles.container}>
      <CXHeader 
        title="Chess" 
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
        nameP1="White" 
        nameP2={isAI ? "AI (Black)" : "Black"}
        round={round}
        maxRounds={matchLength}
        colorP1="#FFFFFF"
        colorP2="#000000"
      />

      {engineRef.current.isCheck() && !winner && (
        <CXText variant="bodyStrong" color="#EF4444" align="center" style={styles.checkText}>
          CHECK!
        </CXText>
      )}

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
          engineRef.current = new ChessEngine();
          setBoard(engineRef.current.getBoard());
          setCurrentPlayer("w");
          setScore({ p1: 0, p2: 0 });
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
    borderWidth: 2,
    borderColor: "#333",
  },
  row: {
    flexDirection: "row",
    height: CELL_SIZE,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedCell: {
    backgroundColor: "rgba(255, 255, 0, 0.5)",
  },
  checkCell: {
    backgroundColor: "rgba(239, 68, 68, 0.5)",
  },
  moveIndicator: {
    width: CELL_SIZE * 0.3,
    height: CELL_SIZE * 0.3,
    borderRadius: CELL_SIZE * 0.15,
    backgroundColor: "rgba(0,0,0,0.2)",
    position: "absolute",
  },
  captureIndicator: {
    width: CELL_SIZE * 0.9,
    height: CELL_SIZE * 0.9,
    borderRadius: CELL_SIZE * 0.45,
    borderWidth: 4,
    borderColor: "rgba(0,0,0,0.2)",
    backgroundColor: "transparent",
  },
  pieceText: {
    fontSize: CELL_SIZE * 0.7,
    lineHeight: CELL_SIZE * 0.8, // fixes clipping
    textAlign: "center",
  },
  pieceShadow: {
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  checkText: {
    marginVertical: spacing.sm,
  }
});
