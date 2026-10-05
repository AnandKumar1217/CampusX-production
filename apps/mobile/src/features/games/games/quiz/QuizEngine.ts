export type Question = {
  text: string;
  answer: boolean;
};

export const QUIZ_QUESTIONS: Question[] = [
  { text: "Paris is the capital of France.", answer: true },
  { text: "Water boils at 90 degrees Celsius.", answer: false },
  { text: "5 + 7 = 12", answer: true },
  { text: "A triangle has 4 sides.", answer: false },
  { text: "Python is a compiled language.", answer: false },
  { text: "React is developed by Facebook.", answer: true },
  { text: "Mount Everest is the tallest mountain.", answer: true },
  { text: "Light travels faster than sound.", answer: true },
  { text: "Spiders have 6 legs.", answer: false },
  { text: "The Earth is flat.", answer: false },
];

export class QuizEngine {
  mode: "1P" | "2P" | "3P" | "4P";
  players: number;
  
  questions: Question[] = [];
  currentQ = 0;
  
  scores: number[];
  answered: boolean[]; // Has player answered current question?
  
  roundOver = false;
  winner: number | null = null;
  
  onStateChange: () => void;
  onGameOver: (winner: number | "DRAW", scores: number[]) => void;

  constructor(mode: "1P" | "2P" | "3P" | "4P", onStateChange: () => void, onGameOver: (winner: number | "DRAW", scores: number[]) => void) {
    this.mode = mode;
    this.players = parseInt(mode[0]);
    this.scores = new Array(this.players).fill(0);
    this.answered = new Array(this.players).fill(false);
    this.onStateChange = onStateChange;
    this.onGameOver = onGameOver;
    
    // Shuffle questions
    this.questions = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5);
  }

  submitAnswer(playerId: number, answer: boolean) {
    if (this.roundOver) return;
    if (this.answered[playerId - 1]) return;
    
    this.answered[playerId - 1] = true;
    
    const correct = this.questions[this.currentQ].answer === answer;
    if (correct) {
      this.scores[playerId - 1]++;
    } else {
      // Penalty? Or just 0 points.
    }
    
    this.onStateChange();
    
    // Check if all answered
    if (this.answered.every(a => a)) {
      this.finishRound();
    }
  }

  // Time runs out
  timeUp() {
    if (this.roundOver) return;
    this.finishRound();
  }

  private finishRound() {
    this.roundOver = true;
    this.onStateChange();
    
    setTimeout(() => {
      this.currentQ++;
      if (this.currentQ >= this.questions.length || this.currentQ >= 10) {
        this.checkGameOver();
      } else {
        this.answered = new Array(this.players).fill(false);
        this.roundOver = false;
        this.onStateChange();
      }
    }, 2000);
  }

  private checkGameOver() {
    if (this.mode === "1P") {
      this.onGameOver("DRAW", this.scores); // Solo just shows score
      return;
    }
    
    const maxScore = Math.max(...this.scores);
    const winners = [];
    for (let i = 0; i < this.players; i++) {
      if (this.scores[i] === maxScore) winners.push(i + 1);
    }
    
    if (winners.length > 1) {
      this.onGameOver("DRAW", this.scores);
    } else {
      this.onGameOver(winners[0], this.scores);
    }
  }
}
