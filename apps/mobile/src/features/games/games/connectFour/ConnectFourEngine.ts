// @ts-nocheck
export type Player = 1 | 2;
export type BoardState = (Player | null)[][]; // 6 rows, 7 cols

export class ConnectFourEngine {
  private board: BoardState;
  private currentPlayer: Player;
  private winner: Player | "DRAW" | null;

  constructor() {
    this.board = Array(6).fill(null).map(() => Array(7).fill(null));
    this.currentPlayer = 1;
    this.winner = null;
  }

  getBoard() { return this.board; }
  getCurrentPlayer() { return this.currentPlayer; }
  getWinner() { return this.winner; }

  playMove(col: number): boolean {
    if (this.winner || col < 0 || col >= 7) return false;
    
    let rowPlayed = -1;
    for (let r = 5; r >= 0; r--) {
      if (this.board[r][col] === null) {
        this.board[r][col] = this.currentPlayer;
        rowPlayed = r;
        break;
      }
    }
    
    if (rowPlayed === -1) return false; // column full

    if (this.checkWin(rowPlayed, col)) {
      this.winner = this.currentPlayer;
    } else if (this.checkDraw()) {
      this.winner = "DRAW";
    } else {
      this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    }
    return true;
  }

  private checkWin(row: number, col: number): boolean {
    const player = this.board[row]?.[col];
    
    // Check directions: horizontal, vertical, diagonal right, diagonal left
    const dirs = [
      [[0, 1], [0, -1]],
      [[1, 0], [-1, 0]],
      [[1, 1], [-1, -1]],
      [[1, -1], [-1, 1]]
    ];

    for (let dir of dirs) {
      let count = 1;
      for (let d of dir) {
        let r = row + d[0];
        let c = col + d[1];
        while (r >= 0 && r < 6 && c >= 0 && c < 7 && this.board[r]?.[c] === player) {
          count++;
          r += d[0];
          c += d[1];
        }
      }
      if (count >= 4) return true;
    }
    return false;
  }

  private checkDraw(): boolean {
    for (let c = 0; c < 7; c++) {
      if (this.board[0]?.[c] === null) return false;
    }
    return true;
  }

  getBestMoveForAI(difficulty: "Easy" | "Medium" | "Hard"): number {
    const validCols = [];
    for (let c = 0; c < 7; c++) {
      if (this.board[0]?.[c] === null) validCols.push(c);
    }
    
    if (validCols.length === 0) return -1;

    if (difficulty === "Easy") {
      return validCols[Math.floor(Math.random() * validCols.length)]!;
    }

    // Medium/Hard: Simple 1-step lookahead to win or block
    // Can win?
    for (let c of validCols) {
      if (this.canWin(c, this.currentPlayer)) return c;
    }
    
    // Can opponent win? Block them
    const opponent = this.currentPlayer === 1 ? 2 : 1;
    for (let c of validCols) {
      if (this.canWin(c, opponent)) return c;
    }

    return validCols[Math.floor(Math.random() * validCols.length)];
  }

  private canWin(col: number, player: Player): boolean {
    let r = 5;
    while (r >= 0 && this.board[r]?.[col] !== null) r--;
    if (r < 0) return false;

    if (this.board[r]) this.board[r][col] = player;
    const wins = this.checkWin(r, col);
    if (this.board[r]) this.board[r][col] = null;
    return wins;
  }
}
