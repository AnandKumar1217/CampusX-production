import { describe, it, expect, beforeEach } from "vitest";
import { MultiTouchManager } from "../src/features/games/engine/MultiTouchManager";
import { TicTacToeEngine } from "../src/features/games/games/ticTacToe/TicTacToeEngine";
import { ConnectFourEngine } from "../src/features/games/games/connectFour/ConnectFourEngine";
import { CheckersEngine } from "../src/features/games/games/checkers/CheckersEngine";
import { ChessEngine } from "../src/features/games/games/chess/ChessEngine";
import { ReversiEngine } from "../src/features/games/games/reversi/ReversiEngine";
import { MancalaEngine } from "../src/features/games/games/mancala/MancalaEngine";
import { DotsAndBoxesEngine } from "../src/features/games/games/dotsAndBoxes/DotsAndBoxesEngine";
import { SnakeEngine } from "../src/features/games/games/snake/SnakeEngine";
import { FootballEngine } from "../src/features/games/games/football/FootballEngine";


import { ReactionEngine } from "../src/features/games/games/reaction/ReactionEngine";
import { QuizEngine } from "../src/features/games/games/quiz/QuizEngine";
import { MazeEngine } from "../src/features/games/games/maze/MazeEngine";
import { GameStorage } from "../src/features/games/engine/GameStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { vi } from "vitest";

const mockStorage = new Map();
vi.mock("@react-native-async-storage/async-storage", () => {
  return {
    default: {
      setItem: vi.fn(async (k, v) => mockStorage.set(k, v)),
      getItem: vi.fn(async (k) => mockStorage.get(k) || null),
      clear: vi.fn(async () => mockStorage.clear()),
    }
  };
});

describe("MultiTouchManager", () => {
  let manager: MultiTouchManager;
  
  beforeEach(() => {
    manager = new MultiTouchManager();
  });

  it("handles pointer 1 down", () => {
    manager.startTouch("p1", 1, "paddle", 0, 0);
    expect(manager.getActiveTouchesForPlayer(1).length).toBe(1);
    expect(manager.getActiveTouchesForPlayer(2).length).toBe(0);
  });

  it("handles pointers 2, 3, 4 down", () => {
    manager.startTouch("p1", 1, "paddle", 0, 0);
    manager.startTouch("p2", 1, "shoot", 10, 10);
    manager.startTouch("p3", 2, "paddle", 0, 0);
    manager.startTouch("p4", 2, "shoot", 10, 10);
    expect(manager.getActiveTouchesForPlayer(1).length).toBe(2);
    expect(manager.getActiveTouchesForPlayer(2).length).toBe(2);
  });

  it("releasing pointer 2 does not remove 1/3/4", () => {
    manager.startTouch("p1", 1, "paddle", 0, 0);
    manager.startTouch("p2", 1, "shoot", 10, 10);
    manager.startTouch("p3", 2, "paddle", 0, 0);
    manager.startTouch("p4", 2, "shoot", 10, 10);
    
    manager.endTouch("p2");
    
    const p1Touches = manager.getActiveTouchesForPlayer(1);
    expect(p1Touches.length).toBe(1);
    expect(p1Touches[0].pointerId).toBe("p1");
    expect(manager.getActiveTouchesForPlayer(2).length).toBe(2);
  });

  it("moving pointer 3 affects only pointer 3", () => {
    manager.startTouch("p3", 2, "paddle", 0, 0);
    manager.startTouch("p4", 2, "shoot", 10, 10);
    
    manager.moveTouch("p3", 100, 200);
    
    const p3Touch = manager.getActiveTouchesForPlayer(2).find(t => t.pointerId === "p3");
    const p4Touch = manager.getActiveTouchesForPlayer(2).find(t => t.pointerId === "p4");
    
    expect(p3Touch?.currentX).toBe(100);
    expect(p3Touch?.currentY).toBe(200);
    expect(p4Touch?.currentX).toBe(10);
  });

  it("reset removes all pointers", () => {
    manager.startTouch("p1", 1, "paddle", 0, 0);
    manager.reset();
    expect(manager.getActiveTouchesForPlayer(1).length).toBe(0);
  });
});

describe("TicTacToeEngine", () => {
  let engine: TicTacToeEngine;

  beforeEach(() => {
    engine = new TicTacToeEngine();
  });

  it("detects rows", () => {
    engine.playMove(0, 1);
    engine.playMove(3, 2);
    engine.playMove(1, 1);
    engine.playMove(4, 2);
    engine.playMove(2, 1); // P1 wins row 1
    expect(engine.getWinner()).toBe(1);
  });

  it("detects columns", () => {
    engine.playMove(0, 1);
    engine.playMove(1, 2);
    engine.playMove(3, 1);
    engine.playMove(4, 2);
    engine.playMove(6, 1); // P1 wins col 1
    expect(engine.getWinner()).toBe(1);
  });

  it("detects diagonals", () => {
    engine.playMove(0, 1);
    engine.playMove(1, 2);
    engine.playMove(4, 1);
    engine.playMove(2, 2);
    engine.playMove(8, 1); // P1 wins diagonal
    expect(engine.getWinner()).toBe(1);
  });

  it("detects draw", () => {
    [0, 1, 2, 4, 7, 5, 3, 6, 8].forEach((spot, i) => {
      engine.playMove(spot, i % 2 === 0 ? 1 : 2);
    });
    expect(engine.getWinner()).toBe("DRAW");
  });

  it("prevents invalid occupied move", () => {
    expect(engine.playMove(0, 1)).toBe(true);
    expect(engine.playMove(0, 2)).toBe(false);
  });

  it("AI Hard minimax makes a valid move", () => {
    engine.playMove(0, 1);
    const aiMove = engine.getBestMoveForAI("Hard");
    expect(aiMove).toBeGreaterThanOrEqual(0);
    expect(aiMove).toBeLessThan(9);
    expect(aiMove).not.toBe(0);
  });
});

describe("ConnectFourEngine", () => {
  let engine: ConnectFourEngine;

  beforeEach(() => {
    engine = new ConnectFourEngine();
  });

  it("detects horizontal win", () => {
    engine.playMove(0, 1); engine.playMove(0, 2);
    engine.playMove(1, 1); engine.playMove(1, 2);
    engine.playMove(2, 1); engine.playMove(2, 2);
    engine.playMove(3, 1); // P1 wins
    expect(engine.getWinner()).toBe(1);
  });

  it("detects vertical win", () => {
    engine.playMove(0, 1); engine.playMove(1, 2);
    engine.playMove(0, 1); engine.playMove(1, 2);
    engine.playMove(0, 1); engine.playMove(1, 2);
    engine.playMove(0, 1); // P1 wins
    expect(engine.getWinner()).toBe(1);
  });

  it("handles full-board and full column", () => {
    // Fill column 0
    for(let i=0; i<6; i++) {
      expect(engine.playMove(0, 1)).toBe(true);
    }
    expect(engine.playMove(0, 1)).toBe(false); // Col 0 is full
  });
});

describe("GameStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("saves and reads", async () => {
    await GameStorage.saveSettings({ soundEnabled: false, hapticsEnabled: true, animationsEnabled: true });
    const settings = await GameStorage.getSettings();
    expect(settings?.soundEnabled).toBe(false);
  });

  it("updates scores", async () => {
    await GameStorage.updateStats("test-game", { wins: 1 });
    await GameStorage.updateStats("test-game", { wins: 1, losses: 1 });
    
    const score = await GameStorage.getStats("test-game");
    expect(score.wins).toBe(2);
    expect(score.losses).toBe(1);
  });

  it("resets scores", async () => {
    await AsyncStorage.clear();
    const score = await GameStorage.getStats("test-game");
    expect(score.wins).toBe(0);
    expect(score.losses).toBe(0);
  });
});

describe("CheckersEngine", () => {
  it("initializes board correctly", () => {
    const engine = new CheckersEngine();
    const board = engine.getBoard();
    expect(board[0][1]).toBe(2);
    expect(board[7][0]).toBe(1);
    expect(engine.getCurrentPlayer()).toBe(1);
  });

  it("detects win when opponent has no pieces", () => {
    const engine = new CheckersEngine();
    // Hack internal board for test
    const b = Array(8).fill(0).map(() => Array(8).fill(0));
    b[0][0] = 1; // Only P1 has a piece
    (engine as any).board = b;
    (engine as any).currentPlayer = 2;
    (engine as any).checkWin();
    expect(engine.getWinner()).toBe(1);
  });
});

describe("ChessEngine", () => {
  it("initializes board correctly", () => {
    const engine = new ChessEngine();
    expect(engine.getCurrentPlayer()).toBe("w");
    expect(engine.getWinner()).toBe(null);
    expect(engine.isCheck()).toBe(false);
  });

  it("detects checkmate", () => {
    const engine = new ChessEngine();
    // Fool's mate
    engine.playMove({from: "f2", to: "f3"});
    engine.playMove({from: "e7", to: "e5"});
    engine.playMove({from: "g2", to: "g4"});
    engine.playMove({from: "d8", to: "h4"});
    expect(engine.getWinner()).toBe("b");
  });
});

describe("ReversiEngine", () => {
  it("initializes board correctly", () => {
    const engine = new ReversiEngine();
    const board = engine.getBoard();
    expect(board[3][3]).toBe(2);
    expect(board[3][4]).toBe(1);
    expect(board[4][3]).toBe(1);
    expect(board[4][4]).toBe(2);
    expect(engine.getCurrentPlayer()).toBe(1);
  });

  it("detects win when board is full", () => {
    const engine = new ReversiEngine();
    const b = Array(8).fill(0).map(() => Array(8).fill(1));
    b[0][0] = 2; // P1 has 63, P2 has 1
    (engine as any).board = b;
    (engine as any).checkWin();
    expect(engine.getWinner()).toBe(1);
  });
});

describe("MancalaEngine", () => {
  it("initializes board correctly", () => {
    const engine = new MancalaEngine();
    const board = engine.getBoard();
    expect(board[0]).toBe(4);
    expect(board[6]).toBe(0);
    expect(board[13]).toBe(0);
    expect(engine.getCurrentPlayer()).toBe(1);
  });

  it("detects game over when one side is empty", () => {
    const engine = new MancalaEngine();
    const b = Array(14).fill(0);
    b[6] = 20; // P1 store
    b[13] = 10; // P2 store
    // P1 pits empty, P2 pits have some
    b[7] = 2;
    (engine as any).board = b;
    (engine as any).checkWin();
    expect(engine.getWinner()).toBe(1); // P1 20 vs P2 12
  });
});

describe("DotsAndBoxesEngine", () => {
  it("initializes board correctly", () => {
    const engine = new DotsAndBoxesEngine(4, 4);
    expect(engine.getHLines().length).toBe(5);
    expect(engine.getVLines().length).toBe(4);
    expect(engine.getCurrentPlayer()).toBe(1);
  });

  it("detects win when all boxes are claimed", () => {
    const engine = new DotsAndBoxesEngine(2, 2);
    const boxes = [
      [1, 1],
      [2, 1]
    ];
    (engine as any).boxes = boxes;
    (engine as any).unclaimedBoxes = 0; // trigger game over
    (engine as any).checkWin();
    expect(engine.getWinner()).toBe(1); // P1 has 3, P2 has 1
  });
});

describe("SnakeEngine", () => {
  it("initializes snakes correctly", () => {
    const engine = new SnakeEngine(400, 600, "2P", () => {});
    expect(engine.p1Body.length).toBeGreaterThan(0);
    expect(engine.p2Body.length).toBeGreaterThan(0);
  });
});

describe("FootballEngine", () => {
  it("initializes players and ball", () => {
    const engine = new FootballEngine(400, 600, () => {}, () => {});
    expect(engine.ballX).toBe(200);
    expect(engine.ballY).toBe(300);
  });
});




describe("ReactionEngine", () => {
  it("initializes state", () => {
    const engine = new ReactionEngine("2P", () => {}, () => {});
    expect(engine.state).toBe("READY");
    expect(engine.scores.length).toBe(2);
  });
});

describe("QuizEngine", () => {
  it("initializes questions", () => {
    const engine = new QuizEngine("2P", () => {}, () => {});
    expect(engine.questions.length).toBeGreaterThan(0);
    expect(engine.scores.length).toBe(2);
  });
});

describe("MazeEngine", () => {
  it("generates a maze", () => {
    const engine = new MazeEngine(1);
    expect(engine.width).toBeGreaterThan(0);
    expect(engine.height).toBeGreaterThan(0);
    expect(engine.grid.length).toBeGreaterThan(0);
  });
});


