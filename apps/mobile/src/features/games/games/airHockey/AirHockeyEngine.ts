export class AirHockeyEngine {
  width: number;
  height: number;
  
  malletRadius = 30;
  puckRadius = 20;
  goalWidth = 140;
  
  p1X: number;
  p1Y: number;
  p2X: number;
  p2Y: number;
  
  puckX: number;
  puckY: number;
  puckVX: number;
  puckVY: number;
  
  scoreP1 = 0;
  scoreP2 = 0;
  
  onScore: (p1: number, p2: number) => void;

  constructor(width: number, height: number, onScore: (p1: number, p2: number) => void) {
    this.width = width;
    this.height = height;
    this.onScore = onScore;
    
    this.p1X = width / 2;
    this.p1Y = height - 100;
    
    this.p2X = width / 2;
    this.p2Y = 100;
    
    this.puckX = width / 2;
    this.puckY = height / 2;
    this.puckVX = 0;
    this.puckVY = 0;
  }

  resetPuck() {
    this.puckX = this.width / 2;
    this.puckY = this.height / 2;
    this.puckVX = 0;
    this.puckVY = 0;
    
    this.p1X = this.width / 2;
    this.p1Y = this.height - 100;
    this.p2X = this.width / 2;
    this.p2Y = 100;
  }

  update(dt: number) {
    const timeScale = dt / 16.66;
    const friction = 0.99;

    this.puckVX *= friction;
    this.puckVY *= friction;

    this.puckX += this.puckVX * timeScale;
    this.puckY += this.puckVY * timeScale;

    // Wall collision (left/right)
    if (this.puckX - this.puckRadius <= 0) {
      this.puckX = this.puckRadius;
      this.puckVX *= -0.8;
    } else if (this.puckX + this.puckRadius >= this.width) {
      this.puckX = this.width - this.puckRadius;
      this.puckVX *= -0.8;
    }

    // Goal vs Wall (top/bottom)
    const isGoalX = this.puckX > (this.width - this.goalWidth) / 2 && this.puckX < (this.width + this.goalWidth) / 2;
    
    if (this.puckY - this.puckRadius <= 0) {
      if (isGoalX) {
        this.scoreP1 += 1;
        this.onScore(this.scoreP1, this.scoreP2);
        this.resetPuck();
        return;
      } else {
        this.puckY = this.puckRadius;
        this.puckVY *= -0.8;
      }
    } else if (this.puckY + this.puckRadius >= this.height) {
      if (isGoalX) {
        this.scoreP2 += 1;
        this.onScore(this.scoreP1, this.scoreP2);
        this.resetPuck();
        return;
      } else {
        this.puckY = this.height - this.puckRadius;
        this.puckVY *= -0.8;
      }
    }

    // Mallet collisions
    this.checkMalletCollision(this.p1X, this.p1Y);
    this.checkMalletCollision(this.p2X, this.p2Y);
    
    // Cap speed
    const speed = Math.hypot(this.puckVX, this.puckVY);
    if (speed > 25) {
      this.puckVX = (this.puckVX / speed) * 25;
      this.puckVY = (this.puckVY / speed) * 25;
    }
  }

  private checkMalletCollision(mx: number, my: number) {
    const dx = this.puckX - mx;
    const dy = this.puckY - my;
    const dist = Math.hypot(dx, dy);
    
    const minDist = this.malletRadius + this.puckRadius;
    if (dist < minDist) {
      // Collision normal
      const nx = dx / dist;
      const ny = dy / dist;
      
      // Push puck out of mallet
      const overlap = minDist - dist;
      this.puckX += nx * overlap;
      this.puckY += ny * overlap;
      
      // Calculate bounce velocity (simple elastic)
      const force = 10; 
      this.puckVX += nx * force;
      this.puckVY += ny * force;
    }
  }

  updateAI(difficulty: "Easy" | "Medium" | "Hard", dt: number) {
    const timeScale = dt / 16.66;
    let speed = 5;
    if (difficulty === "Medium") speed = 8;
    if (difficulty === "Hard") speed = 12;

    const targetX = this.puckX;
    // Keep AI in its half
    let targetY = Math.min(this.puckY, this.height / 2 - this.malletRadius);
    
    // If puck is far or moving away fast, return to center
    if (this.puckY > this.height / 2) {
      targetY = 100;
    }

    const dx = targetX - this.p2X;
    const dy = targetY - this.p2Y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0) {
      this.p2X += (dx / dist) * Math.min(speed * timeScale, dist);
      this.p2Y += (dy / dist) * Math.min(speed * timeScale, dist);
    }
  }

  setP1Position(x: number, y: number) {
    this.p1X = Math.max(this.malletRadius, Math.min(this.width - this.malletRadius, x));
    this.p1Y = Math.max(this.height / 2 + this.malletRadius, Math.min(this.height - this.malletRadius, y));
  }

  setP2Position(x: number, y: number) {
    this.p2X = Math.max(this.malletRadius, Math.min(this.width - this.malletRadius, x));
    this.p2Y = Math.max(this.malletRadius, Math.min(this.height / 2 - this.malletRadius, y));
  }
}
