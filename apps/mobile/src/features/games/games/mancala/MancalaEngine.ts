export type Player = 1 | 2;

export class MancalaEngine {
  // P1: 0-5 (pits), 6 (mancala)
  // P2: 7-12 (pits), 13 (mancala)
  private board: number[];
  private currentPlayer: Player = 1;
  private winner: Player | "DRAW" | null = null;
  private extraTurn: boolean = false;

  constructor() {
    this.board = Array(14).fill(4);
    this.board[6] = 0;
    this.board[13] = 0;
  }

  getBoard() { return this.board; }
  getCurrentPlayer() { return this.currentPlayer; }
  getWinner() { return this.winner; }
  hasExtraTurn() { return this.extraTurn; }

  getValidMoves(): number[] {
    if (this.winner) return [];
    const moves: number[] = [];
    const start = this.currentPlayer === 1 ? 0 : 7;
    for (let i = start; i < start + 6; i++) {
      if (this.board[i] > 0) moves.push(i);
    }
    return moves;
  }

  playMove(pit: number): boolean {
    const validMoves = this.getValidMoves();
    if (!validMoves.includes(pit)) return false;

    let seeds = this.board[pit];
    this.board[pit] = 0;
    let currentPit = pit;
    this.extraTurn = false;

    while (seeds > 0) {
      currentPit = (currentPit + 1) % 14;
      // Skip opponent's mancala
      if (this.currentPlayer === 1 && currentPit === 13) continue;
      if (this.currentPlayer === 2 && currentPit === 6) continue;

      this.board[currentPit]++;
      seeds--;
    }

    // Check rules for the last seed
    if ((this.currentPlayer === 1 && currentPit === 6) || (this.currentPlayer === 2 && currentPit === 13)) {
      this.extraTurn = true; // Gets another turn
    } else {
      // Check capture
      const isMySide = this.currentPlayer === 1 ? currentPit >= 0 && currentPit <= 5 : currentPit >= 7 && currentPit <= 12;
      const oppositePit = 12 - currentPit;
      if (isMySide && this.board[currentPit] === 1 && this.board[oppositePit] > 0) {
        const myMancala = this.currentPlayer === 1 ? 6 : 13;
        this.board[myMancala] += 1 + this.board[oppositePit];
        this.board[currentPit] = 0;
        this.board[oppositePit] = 0;
      }
      this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    }

    this.checkWin();
    return true;
  }

  private checkWin() {
    let p1Pits = 0;
    for (let i = 0; i < 6; i++) p1Pits += this.board[i];
    let p2Pits = 0;
    for (let i = 7; i < 13; i++) p2Pits += this.board[i];

    if (p1Pits === 0 || p2Pits === 0) {
      // Gather remaining to mancalas
      for (let i = 0; i < 6; i++) {
        this.board[6] += this.board[i];
        this.board[i] = 0;
      }
      for (let i = 7; i < 13; i++) {
        this.board[13] += this.board[i];
        this.board[i] = 0;
      }
      
      const p1Score = this.board[6];
      const p2Score = this.board[13];
      if (p1Score > p2Score) this.winner = 1;
      else if (p2Score > p1Score) this.winner = 2;
      else this.winner = "DRAW";
    }
  }

  getScore() {
    return { p1: this.board[6], p2: this.board[13] };
  }

  getBestMoveForAI(difficulty: "Easy" | "Medium" | "Hard"): number | null {
    const moves = this.getValidMoves();
    if (moves.length === 0) return null;

    if (difficulty === "Easy") {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    let bestMove = moves[0];
    let bestScore = -Infinity;
    
    // Depth 3 or 5 depending on difficulty (minimax is very fast for Mancala)
    const depth = difficulty === "Hard" ? 5 : 3;

    for (const move of moves) {
      const clone = this.clone();
      clone.playMove(move);
      const isMaximizing = clone.currentPlayer === this.currentPlayer;
      const score = this.minimax(clone, depth - 1, -Infinity, Infinity, isMaximizing);
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    return bestMove;
  }

  private minimax(game: MancalaEngine, depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
    if (depth === 0 || game.winner) {
      const score = game.getScore();
      return this.currentPlayer === 1 ? score.p1 - score.p2 : score.p2 - score.p1;
    }

    const moves = game.getValidMoves();
    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const clone = game.clone();
        clone.playMove(move);
        const nextIsMaximizing = clone.currentPlayer === game.currentPlayer;
        const ev = this.minimax(clone, depth - 1, alpha, beta, nextIsMaximizing);
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const clone = game.clone();
        clone.playMove(move);
        const nextIsMaximizing = clone.currentPlayer !== game.currentPlayer; // if turn changes, it flips
        const ev = this.minimax(clone, depth - 1, alpha, beta, !nextIsMaximizing);
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  private clone(): MancalaEngine {
    const clone = new MancalaEngine();
    clone.board = [...this.board];
    clone.currentPlayer = this.currentPlayer;
    clone.winner = this.winner;
    clone.extraTurn = this.extraTurn;
    return clone;
  }
}
