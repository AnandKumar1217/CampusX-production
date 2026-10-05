import { Chess, Move as ChessMove } from "chess.js";

export type Player = "w" | "b";
export type Difficulty = "Easy" | "Medium" | "Hard";

export class ChessEngine {
  private chess: Chess;
  
  constructor() {
    this.chess = new Chess();
  }

  getBoard() { return this.chess.board(); }
  getCurrentPlayer(): Player { return this.chess.turn(); }
  getWinner(): Player | "DRAW" | null {
    if (this.chess.isCheckmate()) {
      return this.chess.turn() === "w" ? "b" : "w";
    }
    if (this.chess.isDraw() || this.chess.isStalemate() || this.chess.isThreefoldRepetition()) {
      return "DRAW";
    }
    return null;
  }
  
  isCheck() {
    return this.chess.inCheck();
  }

  getValidMoves(square: string): ChessMove[] {
    return this.chess.moves({ square, verbose: true }) as ChessMove[];
  }

  playMove(move: string | { from: string, to: string, promotion?: string }): boolean {
    try {
      const result = this.chess.move(move);
      return result !== null;
    } catch {
      return false;
    }
  }
  
  loadFen(fen: string) {
    this.chess.load(fen);
  }
  
  getFen() {
    return this.chess.fen();
  }

  getBestMoveForAI(difficulty: Difficulty): ChessMove | null {
    const moves = this.chess.moves({ verbose: true }) as ChessMove[];
    if (moves.length === 0) return null;

    if (difficulty === "Easy") {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    let bestMove = moves[0];
    let bestValue = -Infinity;
    
    // Depth 2 for Medium, 3 for Hard
    const depth = difficulty === "Medium" ? 2 : 3;

    for (const move of moves) {
      this.chess.move(move);
      const boardValue = -this.minimax(depth - 1, -10000, 10000, false);
      this.chess.undo();
      if (boardValue > bestValue) {
        bestValue = boardValue;
        bestMove = move;
      }
    }

    return bestMove;
  }

  private minimax(depth: number, alpha: number, beta: number, isMaximizingPlayer: boolean): number {
    if (depth === 0) {
      return this.evaluateBoard();
    }

    const moves = this.chess.moves();
    
    if (isMaximizingPlayer) {
      let bestVal = -9999;
      for (const move of moves) {
        this.chess.move(move);
        bestVal = Math.max(bestVal, this.minimax(depth - 1, alpha, beta, !isMaximizingPlayer));
        this.chess.undo();
        alpha = Math.max(alpha, bestVal);
        if (beta <= alpha) {
          break;
        }
      }
      return bestVal;
    } else {
      let bestVal = 9999;
      for (const move of moves) {
        this.chess.move(move);
        bestVal = Math.min(bestVal, this.minimax(depth - 1, alpha, beta, !isMaximizingPlayer));
        this.chess.undo();
        beta = Math.min(beta, bestVal);
        if (beta <= alpha) {
          break;
        }
      }
      return bestVal;
    }
  }

  private evaluateBoard(): number {
    let totalEvaluation = 0;
    const board = this.chess.board();
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        totalEvaluation = totalEvaluation + this.getPieceValue(board[i][j]);
      }
    }
    return totalEvaluation;
  }

  private getPieceValue(piece: { type: string, color: string } | null): number {
    if (piece === null) {
      return 0;
    }
    const getVal = (type: string) => {
      if (type === 'p') return 10;
      if (type === 'r') return 50;
      if (type === 'n') return 30;
      if (type === 'b') return 30;
      if (type === 'q') return 90;
      if (type === 'k') return 900;
      return 0;
    };
    const val = getVal(piece.type);
    return piece.color === this.chess.turn() ? val : -val;
  }
}
