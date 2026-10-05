// @ts-nocheck
export type Card = {
  id: number;
  value: number; // e.g., icon id
  isFlipped: boolean;
  isMatched: boolean;
};

export class MemoryEngine {
  mode: "1P" | "2P" | "3P" | "4P";
  cards: Card[] = [];
  
  level = 1;
  moves = 0;
  
  players: number;
  scores: number[] = [0, 0, 0, 0];
  currentPlayer = 0;
  
  flippedIndices: number[] = [];
  isProcessing = false;
  
  onStateChange: () => void;
  onMatch: () => void;
  onGameOver: (winner: number | "DRAW" | "WIN", scores: number[]) => void;

  constructor(
    mode: "1P" | "2P" | "3P" | "4P",
    onStateChange: () => void,
    onMatch: () => void,
    onGameOver: (winner: number | "DRAW" | "WIN", scores: number[]) => void
  ) {
    this.mode = mode;
    this.players = parseInt(mode[0]);
    this.onStateChange = onStateChange;
    this.onMatch = onMatch;
    this.onGameOver = onGameOver;
  }

  startLevel(level: number) {
    this.level = level;
    this.moves = 0;
    this.scores = [0, 0, 0, 0];
    this.currentPlayer = 0;
    this.flippedIndices = [];
    this.isProcessing = false;
    
    // Level scaling: 
    // L1: 4 cards
    // L2: 6 cards
    // L3: 8 cards
    // L4: 12 cards
    // L5: 16 cards
    // Multiplayer defaults to 16 or 20 cards.
    let numPairs = 2; // Level 1
    if (this.mode !== "1P") {
      numPairs = 8;
    } else {
      numPairs = Math.min(10, 2 + Math.floor(level / 2) * 2 + (level % 2 === 0 ? 0 : 2)); 
      // L1:2, L2:4, L3:4, L4:6, L5:6, L6:8, L7:8, L8:10... wait
      numPairs = Math.min(12, level + 1); // L1:2(4), L2:3(6), L3:4(8), L4:5(10), L5:6(12), etc
    }

    const values = [];
    for (let i = 0; i < numPairs; i++) {
      values.push(i, i);
    }
    // Shuffle
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }

    this.cards = values.map((v, i) => ({
      id: i,
      value: v,
      isFlipped: false,
      isMatched: false
    }));

    this.onStateChange();
  }

  flipCard(index: number) {
    if (this.isProcessing) return;
    if (this.cards[index].isFlipped || this.cards[index].isMatched) return;

    this.cards[index].isFlipped = true;
    this.flippedIndices.push(index);
    this.onStateChange();

    if (this.flippedIndices.length === 2) {
      this.moves++;
      this.isProcessing = true;
      setTimeout(() => this.checkMatch(), 800);
    }
  }

  private checkMatch() {
    const [i1, i2] = this.flippedIndices;
    if (this.cards[i1].value === this.cards[i2].value) {
      this.cards[i1].isMatched = true;
      this.cards[i2].isMatched = true;
      this.scores[this.currentPlayer]++;
      this.onMatch();
    } else {
      this.cards[i1].isFlipped = false;
      this.cards[i2].isFlipped = false;
      this.currentPlayer = (this.currentPlayer + 1) % this.players;
    }

    this.flippedIndices = [];
    this.isProcessing = false;
    this.onStateChange();

    this.checkGameOver();
  }

  private checkGameOver() {
    const allMatched = this.cards.every(c => c.isMatched);
    if (allMatched) {
      if (this.mode === "1P") {
        this.onGameOver("WIN", this.scores);
      } else {
        const maxScore = Math.max(...this.scores.slice(0, this.players));
        const winners = [];
        for (let i = 0; i < this.players; i++) {
          if (this.scores[i] === maxScore) winners.push(i + 1);
        }
        if (winners.length > 1) this.onGameOver("DRAW", this.scores);
        else this.onGameOver(winners[0], this.scores);
      }
    }
  }
}
