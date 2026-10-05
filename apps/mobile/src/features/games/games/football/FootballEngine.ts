export class FootballEngine {
  width: number;
  height: number;

  p1X: number;
  p1Y: number;
  p1VX: number = 0;
  p1VY: number = 0;
  
  p2X: number;
  p2Y: number;
  p2VX: number = 0;
  p2VY: number = 0;
  
  ballX: number;
  ballY: number;
  ballVX: number = 0;
  ballVY: number = 0;

  playerRadius = 20;
  ballRadius = 12;
  goalWidth = 120;

  scoreP1 = 0;
  scoreP2 = 0;

  p1JoyX = 0;
  p1JoyY = 0;
  p2JoyX = 0;
  p2JoyY = 0;

  p1Kicking = false;
  p2Kicking = false;

  onScore: (p1: number, p2: number) => void;

  constructor(width: number, height: number, onScore: (p1: number, p2: number) => void) {
    this.width = width;
    this.height = height;
    this.onScore = onScore;
    
    this.p1X = width / 2;
    this.p1Y = height - 100;
    
    this.p2X = width / 2;
    this.p2Y = 100;
    
    this.ballX = width / 2;
    this.ballY = height / 2;
  }

  resetBall() {
    this.ballX = this.width / 2;
    this.ballY = this.height / 2;
    this.ballVX = 0;
    this.ballVY = 0;
    
    this.p1X = this.width / 2;
    this.p1Y = this.height - 100;
    this.p1VX = 0;
    this.p1VY = 0;
    
    this.p2X = this.width / 2;
    this.p2Y = 100;
    this.p2VX = 0;
    this.p2VY = 0;
  }

  update(dt: number) {
    const timeScale = dt / 16.66;
    
    // Apply joystick inputs
    const speed = 1.5;
    this.p1VX += this.p1JoyX * speed;
    this.p1VY += this.p1JoyY * speed;
    this.p2VX += this.p2JoyX * speed;
    this.p2VY += this.p2JoyY * speed;
    
    // Apply friction
    this.p1VX *= 0.85;
    this.p1VY *= 0.85;
    this.p2VX *= 0.85;
    this.p2VY *= 0.85;
    this.ballVX *= 0.96;
    this.ballVY *= 0.96;
    
    // Move
    this.p1X += this.p1VX * timeScale;
    this.p1Y += this.p1VY * timeScale;
    this.p2X += this.p2VX * timeScale;
    this.p2Y += this.p2VY * timeScale;
    this.ballX += this.ballVX * timeScale;
    this.ballY += this.ballVY * timeScale;
    
    // Constrain players to bounds
    this.constrainPlayer(1);
    this.constrainPlayer(2);
    
    // Collisions
    this.checkPlayerBallCollision(this.p1X, this.p1Y, this.p1VX, this.p1VY, this.p1Kicking);
    this.checkPlayerBallCollision(this.p2X, this.p2Y, this.p2VX, this.p2VY, this.p2Kicking);
    
    // Players colliding
    this.checkPlayerPlayerCollision();

    // Ball bounds & goals
    this.checkBallBounds();
  }

  updateAI(difficulty: "Easy" | "Medium" | "Hard", dt: number) {
    let speed = 0.5;
    if (difficulty === "Medium") speed = 0.8;
    if (difficulty === "Hard") speed = 1.0;

    const dx = this.ballX - this.p2X;
    const dy = this.ballY - this.p2Y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0) {
      this.p2JoyX = (dx / dist) * speed;
      this.p2JoyY = (dy / dist) * speed;
    }

    // Kick if close
    if (dist < this.playerRadius + this.ballRadius + 15) {
      this.p2Kicking = true;
    } else {
      this.p2Kicking = false;
    }
  }

  private constrainPlayer(p: 1 | 2) {
    let px = p === 1 ? this.p1X : this.p2X;
    let py = p === 1 ? this.p1Y : this.p2Y;

    if (px < this.playerRadius) px = this.playerRadius;
    if (px > this.width - this.playerRadius) px = this.width - this.playerRadius;
    if (py < this.playerRadius) py = this.playerRadius;
    if (py > this.height - this.playerRadius) py = this.height - this.playerRadius;

    if (p === 1) { this.p1X = px; this.p1Y = py; }
    else { this.p2X = px; this.p2Y = py; }
  }

  private checkPlayerBallCollision(px: number, py: number, pvx: number, pvy: number, kicking: boolean) {
    const dx = this.ballX - px;
    const dy = this.ballY - py;
    const dist = Math.hypot(dx, dy);
    const minDist = this.playerRadius + this.ballRadius;
    
    // Slightly larger kick radius
    if (dist < minDist + (kicking ? 15 : 0)) {
      const nx = dx / dist;
      const ny = dy / dist;
      
      if (dist < minDist) {
        const overlap = minDist - dist;
        this.ballX += nx * overlap;
        this.ballY += ny * overlap;
      }
      
      // Kick power
      const force = kicking ? 15 : 3;
      // Transfer momentum
      this.ballVX += nx * force + pvx * 0.5;
      this.ballVY += ny * force + pvy * 0.5;
    }
  }

  private checkPlayerPlayerCollision() {
    const dx = this.p2X - this.p1X;
    const dy = this.p2Y - this.p1Y;
    const dist = Math.hypot(dx, dy);
    const minDist = this.playerRadius * 2;
    
    if (dist < minDist) {
      const overlap = minDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      this.p1X -= nx * overlap * 0.5;
      this.p1Y -= ny * overlap * 0.5;
      this.p2X += nx * overlap * 0.5;
      this.p2Y += ny * overlap * 0.5;
    }
  }

  private checkBallBounds() {
    // Left / Right bounds
    if (this.ballX < this.ballRadius) {
      this.ballX = this.ballRadius;
      this.ballVX *= -0.8;
    } else if (this.ballX > this.width - this.ballRadius) {
      this.ballX = this.width - this.ballRadius;
      this.ballVX *= -0.8;
    }
    
    const goalLeft = (this.width - this.goalWidth) / 2;
    const goalRight = goalLeft + this.goalWidth;

    // Top Bound
    if (this.ballY < this.ballRadius) {
      if (this.ballX > goalLeft && this.ballX < goalRight) {
        this.scoreP1++;
        this.onScore(this.scoreP1, this.scoreP2);
        this.resetBall();
      } else {
        this.ballY = this.ballRadius;
        this.ballVY *= -0.8;
      }
    }
    
    // Bottom Bound
    if (this.ballY > this.height - this.ballRadius) {
      if (this.ballX > goalLeft && this.ballX < goalRight) {
        this.scoreP2++;
        this.onScore(this.scoreP1, this.scoreP2);
        this.resetBall();
      } else {
        this.ballY = this.height - this.ballRadius;
        this.ballVY *= -0.8;
      }
    }
  }
}
