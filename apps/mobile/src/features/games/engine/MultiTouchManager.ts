export type TouchData = {
  pointerId: string;
  playerId: number;
  controlId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isActive: boolean;
};

export class MultiTouchManager {
  private activeTouches: Map<string, TouchData> = new Map();

  startTouch(pointerId: string, playerId: number, controlId: string, x: number, y: number) {
    this.activeTouches.set(pointerId, {
      pointerId,
      playerId,
      controlId,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      isActive: true,
    });
  }

  moveTouch(pointerId: string, x: number, y: number) {
    const touch = this.activeTouches.get(pointerId);
    if (touch) {
      touch.currentX = x;
      touch.currentY = y;
    }
  }

  endTouch(pointerId: string) {
    this.activeTouches.delete(pointerId);
  }

  reset() {
    this.activeTouches.clear();
  }

  getActiveTouchesForPlayer(playerId: number) {
    return Array.from(this.activeTouches.values()).filter(t => t.playerId === playerId);
  }

  getTouchForControl(playerId: number, controlId: string) {
    return Array.from(this.activeTouches.values()).find(t => t.playerId === playerId && t.controlId === controlId);
  }
}

export const globalTouchManager = new MultiTouchManager();
