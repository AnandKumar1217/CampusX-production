export type Player = 1 | 2;
export type Piece = 0 | 1 | 2 | 3 | 4; // 0=empty, 1=p1, 2=p2, 3=p1K, 4=p2K
export type BoardState = Piece[][];
export type Move = { fromR: number, fromC: number, toR: number, toC: number, captures: {r: number, c: number}[] };

export class CheckersEngine {
  private board: BoardState;
  private currentPlayer: Player = 1;
  private winner: Player | "DRAW" | null = null;
  private mustJump: {r: number, c: number} | null = null;

  constructor() {
    this.board = Array(8).fill(null).map(() => Array(8).fill(0));
    this.setupBoard();
  }

  private setupBoard() {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 1) {
          if (r < 3) this.board[r][c] = 2; // P2 at top
          else if (r > 4) this.board[r][c] = 1; // P1 at bottom
        }
      }
    }
  }

  getBoard() { return this.board; }
  getCurrentPlayer() { return this.currentPlayer; }
  getWinner() { return this.winner; }

  getValidMovesForPiece(r: number, c: number): Move[] {
    if (this.winner) return [];
    const piece = this.board[r][c];
    if (piece === 0 || (piece === 1 || piece === 3) && this.currentPlayer !== 1) return [];
    if ((piece === 2 || piece === 4) && this.currentPlayer !== 2) return [];

    if (this.mustJump && (this.mustJump.r !== r || this.mustJump.c !== c)) return [];

    const allMoves = this.getAllValidMoves(this.currentPlayer);
    return allMoves.filter(m => m.fromR === r && m.fromC === c);
  }

  getAllValidMoves(player: Player): Move[] {
    let moves: Move[] = [];
    let jumps: Move[] = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece === 0) continue;
        const isP1 = piece === 1 || piece === 3;
        const isP2 = piece === 2 || piece === 4;
        const isKing = piece === 3 || piece === 4;
        
        if (player === 1 && !isP1) continue;
        if (player === 2 && !isP2) continue;

        const dirs = [];
        if (isP1 || isKing) dirs.push([-1, -1], [-1, 1]); // P1 moves up
        if (isP2 || isKing) dirs.push([1, -1], [1, 1]);   // P2 moves down

        for (const [dr, dc] of dirs) {
          // Normal move
          const nr = r + dr, nc = c + dc;
          if (this.inBounds(nr, nc) && this.board[nr][nc] === 0) {
            moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, captures: [] });
          }
          // Jump
          const jr = r + 2 * dr, jc = c + 2 * dc;
          if (this.inBounds(jr, jc) && this.inBounds(nr, nc)) {
            const midPiece = this.board[nr][nc];
            const isEnemy = midPiece !== 0 && (player === 1 ? (midPiece===2 || midPiece===4) : (midPiece===1 || midPiece===3));
            if (isEnemy && this.board[jr][jc] === 0) {
              jumps.push({ fromR: r, fromC: c, toR: jr, toC: jc, captures: [{r: nr, c: nc}] });
            }
          }
        }
      }
    }
    
    // In checkers, jumps are mandatory
    return jumps.length > 0 ? jumps : moves;
  }

  private inBounds(r: number, c: number) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  playMove(move: Move): boolean {
    const valid = this.getValidMovesForPiece(move.fromR, move.fromC).find(m => m.toR === move.toR && m.toC === move.toC);
    if (!valid) return false;

    const piece = this.board[move.fromR][move.fromC];
    this.board[move.fromR][move.fromC] = 0;
    this.board[move.toR][move.toC] = piece;

    for (const cap of valid.captures) {
      this.board[cap.r][cap.c] = 0;
    }

    // Kinging
    let becameKing = false;
    if (piece === 1 && move.toR === 0) {
      this.board[move.toR][move.toC] = 3;
      becameKing = true;
    } else if (piece === 2 && move.toR === 7) {
      this.board[move.toR][move.toC] = 4;
      becameKing = true;
    }

    // Multi-jump check
    if (valid.captures.length > 0 && !becameKing) {
      // Check if this piece can jump again
      this.mustJump = { r: move.toR, c: move.toC };
      const jumps = this.getValidMovesForPiece(move.toR, move.toC).filter(m => m.captures.length > 0);
      if (jumps.length > 0) {
        return true; // Still this player's turn
      }
    }

    this.mustJump = null;
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    this.checkWin();
    return true;
  }

  private checkWin() {
    const p1Moves = this.getAllValidMoves(1);
    const p2Moves = this.getAllValidMoves(2);
    
    let p1Count = 0, p2Count = 0;
    for(let r=0; r<8; r++) {
      for(let c=0; c<8; c++) {
        if(this.board[r][c]===1 || this.board[r][c]===3) p1Count++;
        if(this.board[r][c]===2 || this.board[r][c]===4) p2Count++;
      }
    }

    if (this.currentPlayer === 1 && p1Moves.length === 0) {
      this.winner = p2Count > 0 ? 2 : "DRAW";
    } else if (this.currentPlayer === 2 && p2Moves.length === 0) {
      this.winner = p1Count > 0 ? 1 : "DRAW";
    } else if (p1Count === 0) {
      this.winner = 2;
    } else if (p2Count === 0) {
      this.winner = 1;
    }
  }

  getBestMoveForAI(difficulty: "Easy" | "Medium" | "Hard"): Move | null {
    const moves = this.getAllValidMoves(this.currentPlayer);
    if (moves.length === 0) return null;

    if (difficulty === "Easy") {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    // Prefer jumps for medium/hard
    const jumps = moves.filter(m => m.captures.length > 0);
    if (jumps.length > 0) {
      return jumps[Math.floor(Math.random() * jumps.length)];
    }

    // Simple heuristic for Hard: prefer moving pieces forward and keeping back row
    if (difficulty === "Hard") {
      let bestMove = moves[0];
      let bestScore = -Infinity;
      for (const m of moves) {
        let score = 0;
        const piece = this.board[m.fromR][m.fromC];
        if (this.currentPlayer === 2) {
          score += m.toR; // prefer moving down
          if (m.fromR === 0) score -= 5; // penalize moving from back row
          if (m.toR === 7) score += 10; // Kinging
        } else {
          score += (7 - m.toR);
          if (m.fromR === 7) score -= 5;
          if (m.toR === 0) score += 10;
        }
        // Penalize moving to vulnerable spots (rudimentary)
        if (m.toC === 0 || m.toC === 7) score += 2; // edges are safer
        
        if (score > bestScore) {
          bestScore = score;
          bestMove = m;
        }
      }
      return bestMove;
    }

    return moves[Math.floor(Math.random() * moves.length)];
  }
}
