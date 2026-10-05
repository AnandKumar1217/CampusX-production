type UpdateCallback = (dt: number) => void;

export class GameLoop {
  private lastTime: number = 0;
  private reqId: number | null = null;
  private callback: UpdateCallback;
  private isRunning: boolean = false;

  constructor(callback: UpdateCallback) {
    this.callback = callback;
  }

  private loop = (time: number) => {
    if (!this.isRunning) return;

    if (this.lastTime === 0) {
      this.lastTime = time;
    }

    const dt = time - this.lastTime;
    this.lastTime = time;

    this.callback(dt);

    if (this.isRunning) {
      this.reqId = requestAnimationFrame(this.loop);
    }
  };

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = 0;
    this.reqId = requestAnimationFrame(this.loop);
  }

  stop() {
    this.isRunning = false;
    if (this.reqId !== null) {
      cancelAnimationFrame(this.reqId);
      this.reqId = null;
    }
  }

  pause() {
    this.stop();
  }

  resume() {
    this.start();
  }
}
