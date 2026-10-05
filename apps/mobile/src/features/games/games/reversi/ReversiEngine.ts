export type Player = 1 | 2; // 1 = Black, 2 = White
export type BoardState = (Player | 0)[][];
export type Move = { r: number, c: number, flips: {r: number, c: number}[] };

export class ReversiEngine {
  private board: BoardState;
  private currentPlayer: Player = 1;
  private winner: Player | "DRAW" | null = null;
  private validMovesCache: Move[] | null = null;

  constructor() {
    this.board = Array(8).fill(null).map(() => Array(8).fill(0));
    this.board[3][3] = 2;
    this.board[3][4] = 1;
    this.board[4][3] = 1;
    this.board[4][4] = 2;
  }

  getBoard() { return this.board; }
  getCurrentPlayer() { return this.currentPlayer; }
  getWinner() { return this.winner; }

  private inBounds(r: number, c: number) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  getValidMoves(): Move[] {
    if (this.winner) return [];
    if (this.validMovesCache) return this.validMovesCache;

    const moves: Move[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r]![c]! !== 0) continue;
        const flips = this.getFlipsForMove(r, c, this.currentPlayer);
        if (flips.length > 0) {
          moves.push({ r, c, flips });
        }
      }
    }
    
    this.validMovesCache = moves;
    return moves;
  }

  private getFlipsForMove(r: number, c: number, player: Player): {r: number, c: number}[] {
    const flips: {r: number, c: number}[] = [];
    const opponent = player === 1 ? 2 : 1;
    const dirs = [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]];

    for (const [dr, dc] of dirs) {
      let cr = r + dr;
      let cc = c + dc;
      const potentialFlips: {r: number, c: number}[] = [];
      
      while (this.inBounds(cr, cc) && this.board[cr][cc] === opponent) {
        potentialFlips.push({r: cr, c: cc});
        cr += dr;
        cc += dc;
      }
      
      if (this.inBounds(cr, cc) && this.board[cr][cc] === player && potentialFlips.length > 0) {
        flips.push(...potentialFlips);
      }
    }
    return flips;
  }

  playMove(r: number, c: number): boolean {
    const moves = this.getValidMoves();
    const move = moves.find(m => m.r === r && m.c === c);
    if (!move) return false;

    // Apply move
    this.board[r]![c]! = this.currentPlayer;
    for (const flip of move.flips) {
      this.board[flip.r][flip.c] = this.currentPlayer;
    }

    this.validMovesCache = null;
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;

    // If next player has no moves, skip turn.
    if (this.getValidMoves().length === 0) {
      this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
      this.validMovesCache = null; // Recompute for original player
      
      // If still no moves, game over
      if (this.getValidMoves().length === 0) {
        this.checkWin();
      }
    }

    return true;
  }

  private checkWin() {
    let p1Count = 0, p2Count = 0;
    for(let r=0; r<8; r++) {
      for(let c=0; c<8; c++) {
        if(this.board[r]![c]! === 1) p1Count++;
        if(this.board[r]![c]! === 2) p2Count++;
      }
    }
    if (p1Count > p2Count) this.winner = 1;
    else if (p2Count > p1Count) this.winner = 2;
    else this.winner = "DRAW";
  }

  getScore() {
    let p1Count = 0, p2Count = 0;
    for(let r=0; r<8; r++) {
      for(let c=0; c<8; c++) {
        if(this.board[r]![c]! === 1) p1Count++;
        if(this.board[r]![c]! === 2) p2Count++;
      }
    }
    return { p1: p1Count, p2: p2Count };
  }

  getBestMoveForAI(difficulty: "Easy" | "Medium" | "Hard"): {r: number, c: number} | null {
    const moves = this.getValidMoves();
    if (moves.length === 0) return null;

    if (difficulty === "Easy") {
      return moves[Math.floor(Math.random() * moves.length)] as Move;
    }

    let bestMove = moves[0] as Move;
    let bestScore = -Infinity;

    // Corner weights and edge weights
    const getPosScore = (r: number, c: number) => {
      if ((r === 0 || r === 7) && (c === 0 || c === 7)) return 20; // Corners are great
      if (r === 0 || r === 7 || c === 0 || c === 7) return 5; // Edges are good
      if ((r === 1 || r === 6) && (c === 1 || c === 6)) return -10; // X-squares are bad
      return 1;
    };

    for (const move of moves) {
      let score = move.flips.length; // baseline greedy
      score += getPosScore(move.r, move.c);
      
      if (difficulty === "Hard") {
        // Evaluate opponent's mobility roughly (minimize their options)
        const opponent = this.currentPlayer === 1 ? 2 : 1;
        // Apply flip on copy
        const boardCopy = this.board.map(row => [...row]);
        boardCopy[move.r][move.c] = this.currentPlayer;
        for (const f of move.flips) boardCopy[f.r][f.c] = this.currentPlayer;
        
        let opponentMoves = 0;
        for (let r=0; r<8; r++) {
          for (let c=0; c<8; c++) {
            if (boardCopy[r][c] !== 0) continue;
            // quick check flips
            let hasFlip = false;
            const dirs = [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]];
            for (const [dr, dc] of dirs) {
              let cr = r + dr, cc = c + dc;
              let potential = 0;
              while (cr>=0 && cr<8 && cc>=0 && cc<8 && boardCopy[cr][cc] === this.currentPlayer) {
                potential++; cr += dr; cc += dc;
              }
              if (cr>=0 && cr<8 && cc>=0 && cc<8 && boardCopy[cr][cc] === opponent && potential > 0) {
                hasFlip = true; break;
              }
            }
            if (hasFlip) opponentMoves++;
          }
        }
        score -= opponentMoves * 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }
}
