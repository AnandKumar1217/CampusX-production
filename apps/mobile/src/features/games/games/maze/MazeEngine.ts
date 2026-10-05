// @ts-nocheck
export type Cell = {
  x: number;
  y: number;
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
  visited: boolean; // For generation
};

export class MazeEngine {
  width: number;
  height: number;
  
  grid: Cell[][] = [];
  
  playerX = 0;
  playerY = 0;
  
  goalX = 0;
  goalY = 0;
  
  moves = 0;
  isComplete = false;

  constructor(level: number) {
    // Level scaling
    this.width = Math.min(15, 5 + Math.floor(level / 5));
    this.height = Math.min(20, 7 + Math.floor(level / 4));
    
    this.generateMaze();
  }

  generateMaze() {
    let solvable = false;
    while (!solvable) {
      this.initGrid();
      this.carvePassages(0, 0);
      
      // Random start and end
      this.playerX = Math.floor(Math.random() * this.width);
      this.playerY = Math.floor(Math.random() * this.height);
      
      this.goalX = Math.floor(Math.random() * this.width);
      this.goalY = Math.floor(Math.random() * this.height);
      
      while (this.goalX === this.playerX && this.goalY === this.playerY) {
        this.goalX = Math.floor(Math.random() * this.width);
        this.goalY = Math.floor(Math.random() * this.height);
      }
      
      solvable = this.solveMaze();
    }
  }

  private initGrid() {
    this.grid = [];
    for (let x = 0; x < this.width; x++) {
      this.grid[x] = [];
      for (let y = 0; y < this.height; y++) {
        this.grid[x][y] = { x, y, top: true, right: true, bottom: true, left: true, visited: false };
      }
    }
  }

  private carvePassages(cx: number, cy: number) {
    const directions = ["N", "S", "E", "W"].sort(() => Math.random() - 0.5);
    this.grid[cx][cy].visited = true;

    for (const dir of directions) {
      let nx = cx, ny = cy;
      if (dir === "N") ny -= 1;
      if (dir === "S") ny += 1;
      if (dir === "E") nx += 1;
      if (dir === "W") nx -= 1;

      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && !this.grid[nx][ny].visited) {
        if (dir === "N") { this.grid[cx][cy].top = false; this.grid[nx][ny].bottom = false; }
        if (dir === "S") { this.grid[cx][cy].bottom = false; this.grid[nx][ny].top = false; }
        if (dir === "E") { this.grid[cx][cy].right = false; this.grid[nx][ny].left = false; }
        if (dir === "W") { this.grid[cx][cy].left = false; this.grid[nx][ny].right = false; }
        this.carvePassages(nx, ny);
      }
    }
  }

  // A simple BFS solver to guarantee solvability
  private solveMaze(): boolean {
    const queue: {x: number, y: number}[] = [{ x: this.playerX, y: this.playerY }];
    const visited = Array(this.width).fill(0).map(() => Array(this.height).fill(false));
    visited[this.playerX][this.playerY] = true;

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      
      if (x === this.goalX && y === this.goalY) return true;

      const cell = this.grid[x][y];
      
      if (!cell.top && !visited[x][y-1]) { visited[x][y-1] = true; queue.push({ x, y: y-1 }); }
      if (!cell.bottom && !visited[x][y+1]) { visited[x][y+1] = true; queue.push({ x, y: y+1 }); }
      if (!cell.right && !visited[x+1][y]) { visited[x+1][y] = true; queue.push({ x: x+1, y }); }
      if (!cell.left && !visited[x-1][y]) { visited[x-1][y] = true; queue.push({ x: x-1, y }); }
    }
    
    return false;
  }

  move(dir: "UP" | "DOWN" | "LEFT" | "RIGHT") {
    if (this.isComplete) return;

    const cell = this.grid[this.playerX][this.playerY];
    let moved = false;

    if (dir === "UP" && !cell.top) { this.playerY--; moved = true; }
    if (dir === "DOWN" && !cell.bottom) { this.playerY++; moved = true; }
    if (dir === "LEFT" && !cell.left) { this.playerX--; moved = true; }
    if (dir === "RIGHT" && !cell.right) { this.playerX++; moved = true; }

    if (moved) {
      this.moves++;
      if (this.playerX === this.goalX && this.playerY === this.goalY) {
        this.isComplete = true;
      }
    }
  }
}
