export type ReactionState = "READY" | "WAITING" | "GO" | "FINISHED";

export class ReactionEngine {
  mode: "2P" | "3P" | "4P";
  players: number;
  
  state: ReactionState = "READY";
  scores: number[];
  
  delayTimeout: NodeJS.Timeout | null = null;
  startTime: number = 0;
  
  targetScore = 5;
  winner: number | null = null;
  roundWinner: number | null = null;
  roundLoser: number | null = null;
  
  onStateChange: () => void;
  onGameOver: (winner: number) => void;

  constructor(mode: "2P" | "3P" | "4P", onStateChange: () => void, onGameOver: (winner: number) => void) {
    this.mode = mode;
    this.players = parseInt(mode[0]);
    this.scores = new Array(this.players).fill(0);
    this.onStateChange = onStateChange;
    this.onGameOver = onGameOver;
  }

  startRound() {
    this.state = "WAITING";
    this.roundWinner = null;
    this.roundLoser = null;
    this.onStateChange();
    
    // Random delay between 2 and 6 seconds
    const delay = 2000 + Math.random() * 4000;
    this.delayTimeout = setTimeout(() => {
      this.state = "GO";
      this.startTime = Date.now();
      this.onStateChange();
    }, delay);
  }

  tap(playerId: number) { // playerId is 1-indexed
    if (this.state === "WAITING") {
      // Early tap penalty
      if (this.delayTimeout) clearTimeout(this.delayTimeout);
      this.state = "FINISHED";
      this.roundLoser = playerId;
      
      // Everyone else gets a point, or just the early tapper loses a point?
      // Penalty: deduct point, or round ends and nobody scores. 
      // Let's deduct a point.
      this.scores[playerId - 1] = Math.max(0, this.scores[playerId - 1] - 1);
      this.onStateChange();
      
      setTimeout(() => this.startRound(), 2000);
    } else if (this.state === "GO") {
      // Winner
      this.state = "FINISHED";
      this.roundWinner = playerId;
      this.scores[playerId - 1]++;
      this.onStateChange();
      
      if (this.scores[playerId - 1] >= this.targetScore) {
        this.winner = playerId;
        this.onGameOver(this.winner);
      } else {
        setTimeout(() => this.startRound(), 2000);
      }
    }
  }

  cleanup() {
    if (this.delayTimeout) clearTimeout(this.delayTimeout);
  }
}
