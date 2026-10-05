// @ts-nocheck
import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CXScreen, CXHeader, CXIconButton } from "@/components/ui";
import { colors, spacing } from "@/theme";
import { CheckersEngine, Move, Player } from "./CheckersEngine";
import { PauseSheet } from "../../components/PauseSheet";
import { ScoreBoard } from "../../components/ScoreBoard";
import { GameStorage } from "../../engine/GameStorage";

const { width } = Dimensions.get("window");
const BOARD_SIZE = width - spacing.screen * 2;
const CELL_SIZE = BOARD_SIZE / 8;

type Props = NativeStackScreenProps<any, any>;

export function CheckersScreen({ navigation, route }: Props) {
  const { mode, difficulty, matchLength } = route.params as any;
  const isAI = mode === "1P";
  
  const engineRef = useRef(new CheckersEngine());
  const [board, setBoard] = useState(engineRef.current.getBoard());
  const [currentPlayer, setCurrentPlayer] = useState(engineRef.current.getCurrentPlayer());
  const [selectedCell, setSelectedCell] = useState<{r: number, c: number} | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [round, setRound] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [winner, setWinner] = useState<Player | "DRAW" | null>(null);

  useEffect(() => {
    if (isAI && currentPlayer === 2 && !winner) {
      const timer = setTimeout(() => {
        const aiMove = engineRef.current.getBestMoveForAI(difficulty);
        if (aiMove) {
          executeMove(aiMove);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, winner]);

  const executeMove = (move: Move) => {
    if (engineRef.current.playMove(move)) {
      setBoard([...engineRef.current.getBoard().map(row => [...row])]);
      setCurrentPlayer(engineRef.current.getCurrentPlayer());
      setSelectedCell(null);
      setValidMoves([]);
      
      const gameWinner = engineRef.current.getWinner();
      if (gameWinner) {
        handleRoundEnd(gameWinner);
      } else {
        // If it's a multi-jump, AI will automatically continue because its turn hasn't changed.
      }
    }
  };

  const handleCellPress = (r: number, c: number) => {
    if (winner || (isAI && currentPlayer === 2)) return;

    // Is it a valid move destination?
    const move = validMoves.find(m => m.toR === r && m.toC === c);
    if (move) {
      executeMove(move);
      return;
    }

    // Is it selecting a piece?
    const piece = board[r][c];
    if (
      (currentPlayer === 1 && (piece === 1 || piece === 3)) ||
      (currentPlayer === 2 && (piece === 2 || piece === 4))
    ) {
      const moves = engineRef.current.getValidMovesForPiece(r, c);
      if (moves.length > 0) {
        setSelectedCell({ r, c });
        setValidMoves(moves);
      } else {
        setSelectedCell(null);
        setValidMoves([]);
      }
    } else {
      setSelectedCell(null);
      setValidMoves([]);
    }
  };

  const handleRoundEnd = (gameWinner: Player | "DRAW") => {
    let newScore = { ...score };
    if (gameWinner === 1) newScore.p1 += 1;
    if (gameWinner === 2) newScore.p2 += 1;
    setScore(newScore);
    setWinner(gameWinner);
  setTimeout(() => {
    handleRematch();
  }, 2000);
  };

  const handleRematch = () => {
    if (round < matchLength) {
      setRound(r => r + 1);
      engineRef.current = new CheckersEngine();
      setBoard(engineRef.current.getBoard());
      setCurrentPlayer(1);
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
      await GameStorage.updateStats("checkers", {
        played: 1,
        wins: status === "WON" ? 1 : 0,
        losses: status === "LOST" ? 1 : 0,
        draws: status === "DRAW" ? 1 : 0,
      });
    }

    navigation.replace("GameResult" as any, {
      gameId: "checkers",
      status,
      scoreText: `${score.p1} - ${score.p2}`,
      ...route.params as any
    });
  };

  const renderCell = (r: number, c: number) => {
    const isDark = (r + c) % 2 === 1;
    const piece = board[r][c];
    const isSelected = selectedCell?.r === r && selectedCell?.c === c;
    const isMoveDest = validMoves.some(m => m.toR === r && m.toC === c);

    return (
      <Pressable 
        key={`${r}-${c}`} 
        style={[
          styles.cell, 
          { backgroundColor: isDark ? "#A0522D" : "#DEB887" },
          isSelected && styles.selectedCell
        ]} 
        onPress={() => handleCellPress(r, c)}
      >
        {isMoveDest && <View style={styles.moveIndicator} />}
        {piece !== 0 && (
          <View style={[
            styles.piece, 
            (piece === 1 || piece === 3) ? styles.pieceP1 : styles.pieceP2,
            (piece === 3 || piece === 4) && styles.pieceKing
          ]}>
            {(piece === 3 || piece === 4) && <View style={styles.kingCrown} />}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <CXScreen edges={["top", "bottom"]} style={styles.container}>
      <CXHeader 
        title="Checkers" 
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
        colorP1="#FFFFFF"
        colorP2="#000000"
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
          engineRef.current = new CheckersEngine();
          setBoard(engineRef.current.getBoard());
          setCurrentPlayer(1);
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
    borderWidth: 4,
    borderColor: "#5C4033",
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
    borderWidth: 3,
    borderColor: "#3B82F6",
  },
  moveIndicator: {
    width: CELL_SIZE * 0.3,
    height: CELL_SIZE * 0.3,
    borderRadius: CELL_SIZE * 0.15,
    backgroundColor: "rgba(0,0,0,0.3)",
    position: "absolute",
  },
  piece: {
    width: CELL_SIZE * 0.8,
    height: CELL_SIZE * 0.8,
    borderRadius: CELL_SIZE * 0.4,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  pieceP1: {
    backgroundColor: "#F87171", // Red
    borderWidth: 2,
    borderColor: "#991B1B",
  },
  pieceP2: {
    backgroundColor: "#374151", // Black/Dark gray
    borderWidth: 2,
    borderColor: "#111827",
  },
  pieceKing: {
    borderWidth: 4,
    borderColor: "#FBBF24", // Gold rim for king
  },
  kingCrown: {
    width: CELL_SIZE * 0.4,
    height: CELL_SIZE * 0.4,
    borderRadius: CELL_SIZE * 0.2,
    backgroundColor: "#FBBF24",
  }
});
