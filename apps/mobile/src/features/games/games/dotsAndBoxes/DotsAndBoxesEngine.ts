export type Player = 1 | 2;

export interface Move {
  r: number;
  c: number;
  type: "h" | "v"; // horizontal or vertical
}

export class DotsAndBoxesEngine {
  private rows: number;
  private cols: number;
  // hLines[r][c] is true if there is a horizontal line from (r,c) to (r,c+1)
  // vLines[r][c] is true if there is a vertical line from (r,c) to (r+1,c)
  private hLines: boolean[][];
  private vLines: boolean[][];
  // boxes[r][c] contains the player who claimed it, or 0
  private boxes: (Player | 0)[][];
  
  private currentPlayer: Player = 1;
  private winner: Player | "DRAW" | null = null;

  constructor(rows = 4, cols = 4) {
    this.rows = rows;
    this.cols = cols;
    // For a 4x4 grid of boxes, we need 5x4 horizontal lines and 4x5 vertical lines
    this.hLines = Array(rows + 1).fill(null).map(() => Array(cols).fill(false));
    this.vLines = Array(rows).fill(null).map(() => Array(cols + 1).fill(false));
    this.boxes = Array(rows).fill(null).map(() => Array(cols).fill(0));
  }

  getHLines() { return this.hLines; }
  getVLines() { return this.vLines; }
  getBoxes() { return this.boxes; }
  getCurrentPlayer() { return this.currentPlayer; }
  getWinner() { return this.winner; }

  getValidMoves(): Move[] {
    if (this.winner) return [];
    const moves: Move[] = [];
    for (let r = 0; r <= this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.hLines[r][c]) moves.push({ r, c, type: "h" });
      }
    }
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c <= this.cols; c++) {
        if (!this.vLines[r][c]) moves.push({ r, c, type: "v" });
      }
    }
    return moves;
  }

  playMove(move: Move): boolean {
    if (this.winner) return false;
    if (move.type === "h" && this.hLines[move.r][move.c]) return false;
    if (move.type === "v" && this.vLines[move.r][move.c]) return false;

    if (move.type === "h") this.hLines[move.r][move.c] = true;
    if (move.type === "v") this.vLines[move.r][move.c] = true;

    // Check if any boxes were completed
    let boxesCompleted = 0;

    const checkAndCompleteBox = (r: number, c: number) => {
      if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return 0;
      if (this.boxes[r][c] === 0) {
        if (this.hLines[r][c] && this.hLines[r+1][c] && this.vLines[r][c] && this.vLines[r][c+1]) {
          this.boxes[r][c] = this.currentPlayer;
          return 1;
        }
      }
      return 0;
    };

    if (move.type === "h") {
      boxesCompleted += checkAndCompleteBox(move.r - 1, move.c);
      boxesCompleted += checkAndCompleteBox(move.r, move.c);
    } else {
      boxesCompleted += checkAndCompleteBox(move.r, move.c - 1);
      boxesCompleted += checkAndCompleteBox(move.r, move.c);
    }

    if (boxesCompleted === 0) {
      this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    }

    this.checkWin();
    return true;
  }

  private checkWin() {
    let p1 = 0, p2 = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.boxes[r][c] === 1) p1++;
        if (this.boxes[r][c] === 2) p2++;
      }
    }
    if (p1 + p2 === this.rows * this.cols) {
      if (p1 > p2) this.winner = 1;
      else if (p2 > p1) this.winner = 2;
      else this.winner = "DRAW";
    }
  }

  getScore() {
    let p1 = 0, p2 = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.boxes[r][c] === 1) p1++;
        if (this.boxes[r][c] === 2) p2++;
      }
    }
    return { p1, p2 };
  }

  getBestMoveForAI(difficulty: "Easy" | "Medium" | "Hard"): Move | null {
    const moves = this.getValidMoves();
    if (moves.length === 0) return null;

    if (difficulty === "Easy") {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    // Heuristics:
    // 1. If a move completes a box, play it.
    // 2. If a move gives a box to the opponent (creates 3 lines), avoid it.
    // 3. Otherwise, pick randomly.

    const completesBoxMoves: Move[] = [];
    const safeMoves: Move[] = [];

    for (const move of moves) {
      if (this.wouldCompleteBox(move)) {
        completesBoxMoves.push(move);
      } else if (!this.wouldGiveBox(move)) {
        safeMoves.push(move);
      }
    }

    if (completesBoxMoves.length > 0) {
      return completesBoxMoves[Math.floor(Math.random() * completesBoxMoves.length)];
    }

    if (safeMoves.length > 0) {
      return safeMoves[Math.floor(Math.random() * safeMoves.length)];
    }

    // No safe moves
    return moves[Math.floor(Math.random() * moves.length)];
  }

  private wouldCompleteBox(move: Move): boolean {
    if (move.type === "h") {
      if (this.isBoxReady(move.r - 1, move.c, "h", move.r, move.c)) return true;
      if (this.isBoxReady(move.r, move.c, "h", move.r, move.c)) return true;
    } else {
      if (this.isBoxReady(move.r, move.c - 1, "v", move.r, move.c)) return true;
      if (this.isBoxReady(move.r, move.c, "v", move.r, move.c)) return true;
    }
    return false;
  }

  private wouldGiveBox(move: Move): boolean {
    if (move.type === "h") {
      if (this.countLines(move.r - 1, move.c) === 2) return true;
      if (this.countLines(move.r, move.c) === 2) return true;
    } else {
      if (this.countLines(move.r, move.c - 1) === 2) return true;
      if (this.countLines(move.r, move.c) === 2) return true;
    }
    return false;
  }

  private isBoxReady(r: number, c: number, skipType: "h" | "v", skipR: number, skipC: number) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    let lines = 0;
    if (this.hLines[r][c] || (skipType==="h" && skipR===r && skipC===c)) lines++;
    if (this.hLines[r+1][c] || (skipType==="h" && skipR===r+1 && skipC===c)) lines++;
    if (this.vLines[r][c] || (skipType==="v" && skipR===r && skipC===c)) lines++;
    if (this.vLines[r][c+1] || (skipType==="v" && skipR===r && skipC===c+1)) lines++;
    return lines === 4;
  }

  private countLines(r: number, c: number) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return -1;
    let lines = 0;
    if (this.hLines[r][c]) lines++;
    if (this.hLines[r+1][c]) lines++;
    if (this.vLines[r][c]) lines++;
    if (this.vLines[r][c+1]) lines++;
    return lines;
  }
}
