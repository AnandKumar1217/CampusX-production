export type Point = { x: number, y: number };
export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export class SnakeEngine {
  gridW: number;
  gridH: number;
  
  mode: "1P" | "2P";
  
  p1Body: Point[] = [];
  p1Dir: Direction = "UP";
  p1NextDir: Direction = "UP";
  p1Alive: boolean = true;
  
  p2Body: Point[] = [];
  p2Dir: Direction = "DOWN";
  p2NextDir: Direction = "DOWN";
  p2Alive: boolean = true;
  
  food: Point = { x: 0, y: 0 };
  
  scoreP1 = 0;
  scoreP2 = 0;
  
  moveTimer = 0;
  moveInterval = 150; // ms per grid move (gets faster)
  
  winner: 1 | 2 | "DRAW" | null = null;
  
  onScore: (p1: number, p2: number) => void;

  constructor(gridW: number, gridH: number, mode: "1P" | "2P", onScore: (p1: number, p2: number) => void) {
    this.gridW = gridW;
    this.gridH = gridH;
    this.mode = mode;
    this.onScore = onScore;
    
    this.reset();
  }

  reset() {
    this.p1Body = [
      { x: Math.floor(this.gridW / 2), y: this.gridH - 3 },
      { x: Math.floor(this.gridW / 2), y: this.gridH - 2 },
      { x: Math.floor(this.gridW / 2), y: this.gridH - 1 }
    ];
    this.p1Dir = "UP";
    this.p1NextDir = "UP";
    this.p1Alive = true;
    
    if (this.mode === "2P") {
      this.p2Body = [
        { x: Math.floor(this.gridW / 2), y: 2 },
        { x: Math.floor(this.gridW / 2), y: 1 },
        { x: Math.floor(this.gridW / 2), y: 0 }
      ];
      this.p2Dir = "DOWN";
      this.p2NextDir = "DOWN";
      this.p2Alive = true;
    } else {
      this.p2Alive = false;
    }
    
    this.winner = null;
    this.spawnFood();
  }

  spawnFood() {
    let valid = false;
    let attempts = 0;
    while (!valid && attempts < 100) {
      const x = Math.floor(Math.random() * this.gridW);
      const y = Math.floor(Math.random() * this.gridH);
      
      const inP1 = this.p1Body.some(p => p.x === x && p.y === y);
      const inP2 = this.mode === "2P" && this.p2Body.some(p => p.x === x && p.y === y);
      
      if (!inP1 && !inP2) {
        this.food = { x, y };
        valid = true;
      }
      attempts++;
    }
  }

  setP1Dir(dir: Direction) {
    if (dir === "UP" && this.p1Dir === "DOWN") return;
    if (dir === "DOWN" && this.p1Dir === "UP") return;
    if (dir === "LEFT" && this.p1Dir === "RIGHT") return;
    if (dir === "RIGHT" && this.p1Dir === "LEFT") return;
    this.p1NextDir = dir;
  }

  setP2Dir(dir: Direction) {
    if (dir === "UP" && this.p2Dir === "DOWN") return;
    if (dir === "DOWN" && this.p2Dir === "UP") return;
    if (dir === "LEFT" && this.p2Dir === "RIGHT") return;
    if (dir === "RIGHT" && this.p2Dir === "LEFT") return;
    this.p2NextDir = dir;
  }

  update(dt: number) {
    if (this.winner) return;
    
    this.moveTimer += dt;
    if (this.moveTimer >= this.moveInterval) {
      this.moveTimer -= this.moveInterval;
      this.tick();
    }
  }

  private tick() {
    this.p1Dir = this.p1NextDir;
    this.p2Dir = this.p2NextDir;
    
    if (this.p1Alive) this.moveSnake(this.p1Body, this.p1Dir, 1);
    if (this.mode === "2P" && this.p2Alive) this.moveSnake(this.p2Body, this.p2Dir, 2);
    
    this.checkCollisions();
  }

  private moveSnake(body: Point[], dir: Direction, player: 1 | 2) {
    const head = { ...body[0] };
    if (dir === "UP") head.y!--;
    if (dir === "DOWN") head.y!++;
    if (dir === "LEFT") head.x!--;
    if (dir === "RIGHT") head.x!++;
    
    body.unshift(head);
    
    if (head.x! === this.food.x && head.y! === this.food.y) {
      if (player === 1) this.scoreP1++;
      else this.scoreP2++;
      this.onScore(this.scoreP1, this.scoreP2);
      this.spawnFood();
      // Speed up slightly
      this.moveInterval = Math.max(50, this.moveInterval - 2);
    } else {
      body.pop();
    }
  }

  private checkCollisions() {
    let p1Died = false;
    let p2Died = false;
    
    if (this.p1Alive) {
      const h1 = this.p1Body[0];
      if (h1.x! < 0 || h1.x! >= this.gridW || h1.y! < 0 || h1.y! >= this.gridH) {
        p1Died = true;
      }
      for (let i = 1; i < this.p1Body.length; i++) {
        if (h1.x! === this.p1Body[i].x && h1.y! === this.p1Body[i].y) p1Died = true;
      }
      if (this.mode === "2P") {
        for (let i = 0; i < this.p2Body.length; i++) {
          if (h1.x! === this.p2Body[i].x && h1.y! === this.p2Body[i].y) p1Died = true;
        }
      }
    }
    
    if (this.mode === "2P" && this.p2Alive) {
      const h2 = this.p2Body[0];
      if (h2.x! < 0 || h2.x! >= this.gridW || h2.y! < 0 || h2.y! >= this.gridH) {
        p2Died = true;
      }
      for (let i = 1; i < this.p2Body.length; i++) {
        if (h2.x! === this.p2Body[i].x && h2.y! === this.p2Body[i].y) p2Died = true;
      }
      for (let i = 0; i < this.p1Body.length; i++) {
        if (h2.x! === this.p1Body[i].x && h2.y! === this.p1Body[i].y) p2Died = true;
      }
      
      // Head to head collision
      if (this.p1Alive && h1MatchesH2(this.p1Body[0], this.p2Body[0])) {
        p1Died = true;
        p2Died = true;
      }
    }
    
    if (p1Died) this.p1Alive = false;
    if (p2Died) this.p2Alive = false;
    
    if (this.mode === "1P") {
      if (!this.p1Alive) this.winner = "DRAW"; // Just game over in solo
    } else {
      if (!this.p1Alive && !this.p2Alive) this.winner = "DRAW";
      else if (!this.p1Alive) this.winner = 2;
      else if (!this.p2Alive) this.winner = 1;
    }
  }
}

function h1MatchesH2(p1: Point, p2: Point) {
  return p1.x === p2.x && p1.y === p2.y;
}
