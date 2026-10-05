export class PongEngine {
  width: number;
  height: number;
  
  paddleWidth = 100;
  paddleHeight = 20;
  ballSize = 16;
  
  p1X: number;
  p2X: number;
  
  ballX: number;
  ballY: number;
  ballVX: number;
  ballVY: number;
  
  scoreP1 = 0;
  scoreP2 = 0;
  
  onScore: (p1: number, p2: number) => void;

  constructor(width: number, height: number, onScore: (p1: number, p2: number) => void) {
    this.width = width;
    this.height = height;
    this.onScore = onScore;
    
    this.p1X = width / 2;
    this.p2X = width / 2;
    
    this.ballX = width / 2;
    this.ballY = height / 2;
    this.ballVX = 0;
    this.ballVY = 0;
    
    this.resetBall();
  }

  resetBall() {
    this.ballX = this.width / 2;
    this.ballY = this.height / 2;
    const direction = Math.random() > 0.5 ? 1 : -1;
    this.ballVX = (Math.random() * 4 - 2);
    this.ballVY = 6 * direction;
  }

  update(dt: number) {
    const timeScale = dt / 16.66; // Normalize to 60fps

    this.ballX += this.ballVX * timeScale;
    this.ballY += this.ballVY * timeScale;

    // Wall collision (left/right)
    if (this.ballX - this.ballSize / 2 <= 0) {
      this.ballX = this.ballSize / 2;
      this.ballVX *= -1;
    } else if (this.ballX + this.ballSize / 2 >= this.width) {
      this.ballX = this.width - this.ballSize / 2;
      this.ballVX *= -1;
    }

    // Paddle 1 (Bottom) collision
    const p1Y = this.height - 40;
    if (
      this.ballY + this.ballSize / 2 >= p1Y &&
      this.ballY - this.ballSize / 2 <= p1Y + this.paddleHeight &&
      this.ballX >= this.p1X - this.paddleWidth / 2 &&
      this.ballX <= this.p1X + this.paddleWidth / 2
    ) {
      this.ballY = p1Y - this.ballSize / 2;
      this.ballVY *= -1.05; // speed up slightly
      this.ballVX += (this.ballX - this.p1X) * 0.1; // English
    }

    // Paddle 2 (Top) collision
    const p2Y = 40;
    if (
      this.ballY - this.ballSize / 2 <= p2Y + this.paddleHeight &&
      this.ballY + this.ballSize / 2 >= p2Y &&
      this.ballX >= this.p2X - this.paddleWidth / 2 &&
      this.ballX <= this.p2X + this.paddleWidth / 2
    ) {
      this.ballY = p2Y + this.paddleHeight + this.ballSize / 2;
      this.ballVY *= -1.05;
      this.ballVX += (this.ballX - this.p2X) * 0.1;
    }

    // Scoring
    if (this.ballY > this.height) {
      this.scoreP2 += 1;
      this.onScore(this.scoreP1, this.scoreP2);
      this.resetBall();
    } else if (this.ballY < 0) {
      this.scoreP1 += 1;
      this.onScore(this.scoreP1, this.scoreP2);
      this.resetBall();
    }

    // Cap speed
    const maxSpeed = 15;
    if (this.ballVY > maxSpeed) this.ballVY = maxSpeed;
    if (this.ballVY < -maxSpeed) this.ballVY = -maxSpeed;
  }

  updateAI(difficulty: "Easy" | "Medium" | "Hard", dt: number) {
    const timeScale = dt / 16.66;
    
    // AI controls Paddle 2 (Top)
    let speed = 4;
    if (difficulty === "Medium") speed = 6;
    if (difficulty === "Hard") speed = 9;

    // Only move if ball is coming towards AI or in medium/hard mode
    if (this.ballVY < 0 || difficulty !== "Easy") {
      const targetX = this.ballX;
      if (this.p2X < targetX - 10) {
        this.p2X += Math.min(speed * timeScale, targetX - this.p2X);
      } else if (this.p2X > targetX + 10) {
        this.p2X -= Math.min(speed * timeScale, this.p2X - targetX);
      }
    }
    
    // Clamp
    if (this.p2X < this.paddleWidth / 2) this.p2X = this.paddleWidth / 2;
    if (this.p2X > this.width - this.paddleWidth / 2) this.p2X = this.width - this.paddleWidth / 2;
  }

  setP1Position(x: number) {
    this.p1X = Math.max(this.paddleWidth / 2, Math.min(this.width - this.paddleWidth / 2, x));
  }

  setP2Position(x: number) {
    this.p2X = Math.max(this.paddleWidth / 2, Math.min(this.width - this.paddleWidth / 2, x));
  }
}
