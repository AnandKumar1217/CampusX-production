export type Player = 1 | 2;
export type BoardState = (Player | null)[];

export class TicTacToeEngine {
  private board: BoardState;
  private currentPlayer: Player;
  private winner: Player | "DRAW" | null;
  private winningLine: number[] | null;

  constructor() {
    this.board = Array(9).fill(null);
    this.currentPlayer = 1;
    this.winner = null;
    this.winningLine = null;
  }

  getBoard() { return this.board; }
  getCurrentPlayer() { return this.currentPlayer; }
  getWinner() { return this.winner; }
  getWinningLine() { return this.winningLine; }

  playMove(index: number): boolean {
    if (this.winner || this.board[index] !== null) return false;
    
    this.board[index] = this.currentPlayer;
    this.checkWin();
    
    if (!this.winner) {
      this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    }
    return true;
  }

  private checkWin() {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];

    for (let line of lines) {
      const [a, b, c] = line;
      if (a !== undefined && b !== undefined && c !== undefined && this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        this.winner = this.board[a];
        this.winningLine = line;
        return;
      }
    }

    if (!this.board.includes(null)) {
      this.winner = "DRAW";
    }
  }

  getBestMoveForAI(difficulty: "Easy" | "Medium" | "Hard"): number {
    const availableMoves = this.board.map((v, i) => v === null ? i : -1).filter(i => i !== -1);
    if (availableMoves.length === 0) return -1;

    if (difficulty === "Easy") {
      // Random move
      return availableMoves[Math.floor(Math.random() * availableMoves.length)]!;
    }

    if (difficulty === "Medium") {
      // 50% chance optimal, 50% random
      if (Math.random() > 0.5) {
        return this.minimax(this.board, 2).index;
      }
      return availableMoves[Math.floor(Math.random() * availableMoves.length)]!;
    }

    // Hard: Minimax
    return this.minimax(this.board, 2).index;
  }

  private minimax(board: BoardState, player: Player): { index: number, score: number } {
    // Basic minimax implementation for TicTacToe
    const availSpots = board.map((v, i) => v === null ? i : -1).filter(i => i !== -1);

    if (this.checkWinState(board, 1)) return { score: -10, index: -1 };
    if (this.checkWinState(board, 2)) return { score: 10, index: -1 };
    if (availSpots.length === 0) return { score: 0, index: -1 };

    let moves: {index: number, score: number}[] = [];

    for (let i = 0; i < availSpots.length; i++) {
      let spot = availSpots[i]!;
      let move = { index: spot, score: 0 };
      board[spot] = player;

      if (player === 2) {
        let result = this.minimax(board, 1);
        move.score = result.score;
      } else {
        let result = this.minimax(board, 2);
        move.score = result.score;
      }

      board[spot] = null;
      moves.push(move);
    }

    let bestMove = 0;
    if (player === 2) {
      let bestScore = -10000;
      for (let i = 0; i < moves.length; i++) {
        const m = moves[i]!;
        if (m.score > bestScore) {
          bestScore = m.score;
          bestMove = i;
        }
      }
    } else {
      let bestScore = 10000;
      for (let i = 0; i < moves.length; i++) {
        const m = moves[i]!;
        if (m.score < bestScore) {
          bestScore = m.score;
          bestMove = i;
        }
      }
    }

    return moves[bestMove]!;
  }

  private checkWinState(board: BoardState, player: Player) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let line of lines) {
      const a = line[0], b = line[1], c = line[2];
      if (a !== undefined && b !== undefined && c !== undefined && board[a] === player && board[b] === player && board[c] === player) {
        return true;
      }
    }
    return false;
  }
}
