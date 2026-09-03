import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import {
  CXButton,
  CXCard,
  CXHeader,
  CXIconButton,
  CXRow,
  CXScreen,
  CXScrollScreen,
  CXText,
} from "@/components/ui";
import { colors, gradients, radius, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;
type GameRoute =
  | "Game2048"
  | "Sudoku"
  | "TicTacToe"
  | "Snake"
  | "MemoryMatch"
  | "WordGame"
  | "ChessPuzzles";

const gameTiles: {
  title: string;
  route: GameRoute;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
}[] = [
  {
    title: "2048",
    route: "Game2048",
    icon: "grid-outline",
    colors: ["#FFB347", "#FF7B54"],
  },
  {
    title: "Sudoku",
    route: "Sudoku",
    icon: "keypad-outline",
    colors: ["#8B5CF6", "#6338F2"],
  },
  {
    title: "Tic-Tac-Toe",
    route: "TicTacToe",
    icon: "close-outline",
    colors: ["#54A9FF", "#6338F2"],
  },
  {
    title: "Snake",
    route: "Snake",
    icon: "analytics-outline",
    colors: ["#65D66E", "#20A95B"],
  },
  {
    title: "Memory Match",
    route: "MemoryMatch",
    icon: "copy-outline",
    colors: ["#A855F7", "#EC4899"],
  },
  {
    title: "Word Game",
    route: "WordGame",
    icon: "text-outline",
    colors: ["#8B5CF6", "#5966F2"],
  },
  {
    title: "Chess Puzzles",
    route: "ChessPuzzles",
    icon: "extension-puzzle-outline",
    colors: ["#22C55E", "#0F766E"],
  },
];

export function GamesHubScreen({ navigation }: StackProps<"GamesHub">) {
  return (
    <CXScrollScreen>
      <CXHeader
        title="Bored? Let’s Play! 🎮"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="game-controller-outline"
            label="Game profile"
            backgroundColor={colors.transparent}
          />
        }
      />
      <CXCard style={styles.gameHero}>
        <View style={styles.flex}>
          <CXText variant="title" color={colors.primary}>
            Take a break and challenge your brain!
          </CXText>
          <CXText variant="small" color={colors.textMuted}>
            Seven fully playable CampusX mini-games.
          </CXText>
        </View>
        <Ionicons name="game-controller" size={58} color={colors.primary} />
      </CXCard>
      <CXText variant="title">All Games</CXText>
      <View style={styles.gameGrid}>
        {gameTiles.map((game) => (
          <Pressable
            key={game.title}
            style={({ pressed }) => [
              styles.gameTile,
              pressed && styles.pressed,
            ]}
            onPress={() => navigation.navigate(game.route)}
          >
            <View
              style={[styles.gameTileIcon, { backgroundColor: game.colors[0] }]}
            >
              <Ionicons name={game.icon} size={30} color={colors.white} />
            </View>
            <CXText variant="bodyStrong" align="center">
              {game.title}
            </CXText>
          </Pressable>
        ))}
      </View>
    </CXScrollScreen>
  );
}

// 2048
type Grid = number[][];
const emptyGrid = (): Grid => Array.from({ length: 4 }, () => [0, 0, 0, 0]);
function addRandom(grid: Grid) {
  const empty: [number, number][] = [];
  grid.forEach((row, r) =>
    row.forEach((value, c) => {
      if (!value) empty.push([r, c]);
    }),
  );
  if (!empty.length) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]!;
  return grid.map((row, ri) =>
    row.map((value, ci) =>
      ri === r && ci === c ? (Math.random() < 0.9 ? 2 : 4) : value,
    ),
  );
}
function new2048() {
  return addRandom(addRandom(emptyGrid()));
}
function slide(line: number[]) {
  const values = line.filter(Boolean);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === values[i + 1]) {
      const merged = values[i]! * 2;
      out.push(merged);
      gained += merged;
      i += 1;
    } else out.push(values[i]!);
  }
  while (out.length < 4) out.push(0);
  return { line: out, gained };
}
function move2048(grid: Grid, direction: "left" | "right" | "up" | "down") {
  let gained = 0;
  let result = emptyGrid();
  const getLine = (index: number) =>
    direction === "left" || direction === "right"
      ? grid[index]!
      : grid.map((row) => row[index]!);
  for (let i = 0; i < 4; i += 1) {
    const original = getLine(i);
    const reversed = direction === "right" || direction === "down";
    const moved = slide(reversed ? [...original].reverse() : original);
    const line = reversed ? [...moved.line].reverse() : moved.line;
    gained += moved.gained;
    for (let j = 0; j < 4; j += 1) {
      if (direction === "left" || direction === "right")
        result[i]![j] = line[j]!;
      else result[j]![i] = line[j]!;
    }
  }
  const changed = JSON.stringify(result) !== JSON.stringify(grid);
  return { grid: changed ? addRandom(result) : grid, gained, changed };
}
function hasMoves(grid: Grid) {
  if (grid.some((row) => row.includes(0))) return true;
  return grid.some((row, r) =>
    row.some(
      (value, c) => grid[r]?.[c + 1] === value || grid[r + 1]?.[c] === value,
    ),
  );
}
const tileColors: Record<number, string> = {
  0: "#F1EDE8",
  2: "#FFF8ED",
  4: "#FFF0D9",
  8: "#FFC56A",
  16: "#FF9F5A",
  32: "#FF7753",
  64: "#F34D2D",
  128: "#F6B93B",
  256: "#F39C12",
  512: "#D97706",
  1024: "#9333EA",
  2048: "#6338F2",
};
export function Game2048Screen({ navigation }: StackProps<"Game2048">) {
  const [grid, setGrid] = useState(new2048);
  const [score, setScore] = useState(0);
  const bestRef = useRef(8420);
  const doMove = (direction: "left" | "right" | "up" | "down") => {
    const result = move2048(grid, direction);
    if (result.changed) {
      setGrid(result.grid);
      setScore((value) => {
        bestRef.current = Math.max(bestRef.current, value + result.gained);
        return value + result.gained;
      });
    }
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) > Math.abs(gesture.dy))
            doMove(gesture.dx > 0 ? "right" : "left");
          else doMove(gesture.dy > 0 ? "down" : "up");
        },
      }),
    [grid],
  );
  const reset = () => {
    setGrid(new2048());
    setScore(0);
  };
  return (
    <CXScreen>
      <CXHeader
        title="2048"
        onBack={navigation.goBack}
        right={
          <CXRow>
            <CXIconButton
              icon="trophy-outline"
              label="Leaderboard"
              backgroundColor={colors.transparent}
            />
            <CXIconButton
              icon="ellipsis-vertical"
              label="Options"
              backgroundColor={colors.transparent}
            />
          </CXRow>
        }
      />
      <View style={styles.gamePage}>
        <CXRow style={styles.scoreRow}>
          <CXCard style={styles.score}>
            <CXText variant="caption" color={colors.textMuted}>
              Score
            </CXText>
            <CXText variant="h3">{score}</CXText>
          </CXCard>
          <CXCard style={styles.score}>
            <CXText variant="caption" color={colors.textMuted}>
              Best
            </CXText>
            <CXText variant="h3">{bestRef.current}</CXText>
          </CXCard>
          <CXButton
            label="New Game"
            size="sm"
            fullWidth={false}
            onPress={reset}
          />
        </CXRow>
        <View style={styles.board2048} {...pan.panHandlers}>
          {grid.flatMap((row, r) =>
            row.map((value, c) => (
              <View
                key={`${r}-${c}`}
                style={[
                  styles.tile2048,
                  { backgroundColor: tileColors[value] ?? "#5B21B6" },
                ]}
              >
                <CXText
                  variant={value >= 1024 ? "h3" : "h2"}
                  color={value >= 8 ? colors.white : "#554A43"}
                >
                  {value || ""}
                </CXText>
              </View>
            )),
          )}
        </View>
        <CXText color={colors.textMuted} align="center">
          Swipe the board or use the controls. Join equal numbers to reach 2048.
        </CXText>
        {!hasMoves(grid) ? (
          <CXCard>
            <CXText variant="h3" align="center">
              Game Over
            </CXText>
            <CXButton label="Try Again" onPress={reset} />
          </CXCard>
        ) : null}
        <CXRow style={styles.directionRow}>
          {["arrow-back", "arrow-up", "arrow-down", "arrow-forward"].map(
            (icon, index) => (
              <CXIconButton
                key={icon}
                icon={icon as keyof typeof Ionicons.glyphMap}
                label="Move"
                onPress={() =>
                  doMove((["left", "up", "down", "right"] as const)[index]!)
                }
              />
            ),
          )}
        </CXRow>
      </View>
    </CXScreen>
  );
}

// Sudoku
const sudokuPuzzle = [
  5, 3, 0, 0, 7, 0, 0, 0, 0, 6, 0, 0, 1, 9, 5, 0, 0, 0, 0, 9, 8, 0, 0, 0, 0, 6,
  0, 8, 0, 0, 0, 6, 0, 0, 0, 3, 4, 0, 0, 8, 0, 3, 0, 0, 1, 7, 0, 0, 0, 2, 0, 0,
  0, 6, 0, 6, 0, 0, 0, 0, 2, 8, 0, 0, 0, 0, 4, 1, 9, 0, 0, 5, 0, 0, 0, 0, 8, 0,
  0, 7, 9,
];
const sudokuSolution = [
  5, 3, 4, 6, 7, 8, 9, 1, 2, 6, 7, 2, 1, 9, 5, 3, 4, 8, 1, 9, 8, 3, 4, 2, 5, 6,
  7, 8, 5, 9, 7, 6, 1, 4, 2, 3, 4, 2, 6, 8, 5, 3, 7, 9, 1, 7, 1, 3, 9, 2, 4, 8,
  5, 6, 9, 6, 1, 5, 3, 7, 2, 8, 4, 2, 8, 7, 4, 1, 9, 6, 3, 5, 3, 4, 5, 2, 8, 6,
  1, 7, 9,
];
export function SudokuScreen({ navigation }: StackProps<"Sudoku">) {
  const [board, setBoard] = useState([...sudokuPuzzle]);
  const [selected, setSelected] = useState<number | null>(null);
  const [undo, setUndo] = useState<[number, number][]>([]);
  const errors = board.reduce(
    (sum, value, index) =>
      sum + (value && value !== sudokuSolution[index] ? 1 : 0),
    0,
  );
  const enter = (value: number) => {
    if (selected === null || sudokuPuzzle[selected]) return;
    const previous = board[selected]!;
    setUndo((items) => [...items, [selected, previous]]);
    setBoard((items) =>
      items.map((item, index) => (index === selected ? value : item)),
    );
  };
  return (
    <CXScreen>
      <CXHeader
        title="Sudoku"
        onBack={navigation.goBack}
        right={
          <CXRow>
            <CXIconButton
              icon="pause-outline"
              label="Pause"
              backgroundColor={colors.transparent}
            />
            <CXIconButton
              icon="ellipsis-horizontal"
              label="Options"
              backgroundColor={colors.transparent}
            />
          </CXRow>
        }
      />
      <View style={styles.gamePage}>
        <CXRow>
          <CXText
            variant="bodyStrong"
            color={colors.primary}
            style={styles.flex}
          >
            Medium
          </CXText>
          <CXText variant="bodyStrong">02:34</CXText>
        </CXRow>
        <View style={styles.sudoku}>
          {board.map((value, index) => {
            const row = Math.floor(index / 9);
            const col = index % 9;
            const wrong = value !== 0 && value !== sudokuSolution[index];
            return (
              <Pressable
                key={index}
                onPress={() => setSelected(index)}
                style={[
                  styles.sudokuCell,
                  col % 3 === 0 && styles.sudokuLeft,
                  row % 3 === 0 && styles.sudokuTop,
                  selected === index && styles.sudokuSelected,
                ]}
              >
                <CXText
                  variant="bodyStrong"
                  color={
                    wrong
                      ? colors.danger
                      : sudokuPuzzle[index]
                        ? colors.ink
                        : colors.primary
                  }
                >
                  {value || ""}
                </CXText>
              </Pressable>
            );
          })}
        </View>
        <CXRow style={styles.numberPad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
            <Pressable
              key={value}
              onPress={() => enter(value)}
              style={styles.number}
            >
              <CXText variant="title">{value}</CXText>
            </Pressable>
          ))}
        </CXRow>
        <CXRow style={styles.sudokuTools}>
          <Tool
            icon="arrow-undo-outline"
            label="Undo"
            onPress={() => {
              const last = undo.at(-1);
              if (!last) return;
              setBoard((items) =>
                items.map((item, index) =>
                  index === last[0] ? last[1] : item,
                ),
              );
              setUndo((items) => items.slice(0, -1));
            }}
          />
          <Tool
            icon="backspace-outline"
            label="Erase"
            onPress={() => enter(0)}
          />
          <Tool icon="create-outline" label="Notes" />
          <Tool
            icon="bulb-outline"
            label="Hint"
            badge="3"
            onPress={() =>
              selected !== null && enter(sudokuSolution[selected]!)
            }
          />
        </CXRow>
        <CXText
          variant="small"
          color={errors ? colors.danger : colors.success}
          align="center"
        >
          {errors
            ? `${errors} incorrect ${errors === 1 ? "cell" : "cells"}`
            : board.every(Boolean)
              ? "Puzzle complete! 🎉"
              : "No errors so far"}
        </CXText>
      </View>
    </CXScreen>
  );
}

function Tool({
  icon,
  label,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tool}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      {badge ? (
        <View style={styles.toolBadge}>
          <CXText variant="caption" color={colors.white}>
            {badge}
          </CXText>
        </View>
      ) : null}
      <CXText variant="caption">{label}</CXText>
    </Pressable>
  );
}

// Tic Tac Toe
type Mark = "X" | "O" | null;
const wins = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
function winner(board: Mark[]) {
  return wins.find((line) =>
    line.every((index) => board[index] && board[index] === board[line[0]!]),
  );
}
export function TicTacToeScreen({ navigation }: StackProps<"TicTacToe">) {
  const [board, setBoard] = useState<Mark[]>(Array(9).fill(null));
  const [score, setScore] = useState<[number, number]>([2, 1]);
  const won = winner(board);
  const draw = !won && board.every(Boolean);
  const play = (index: number) => {
    if (board[index] || won) return;
    const next = board.map((item, i) => (i === index ? "X" : item));
    if (winner(next)) {
      setBoard(next);
      setScore(([x, o]) => [x + 1, o]);
      return;
    }
    const empty = next
      .map((value, i) => (value ? -1 : i))
      .filter((i) => i >= 0);
    if (!empty.length) {
      setBoard(next);
      return;
    }
    const computer = empty[Math.floor(Math.random() * empty.length)]!;
    const final = next.map((item, i) => (i === computer ? "O" : item));
    setBoard(final);
    if (winner(final)) setScore(([x, o]) => [x, o + 1]);
  };
  const reset = () => setBoard(Array(9).fill(null));
  return (
    <CXScreen>
      <CXHeader
        title="Tic-Tac-Toe"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="refresh"
            label="Restart"
            backgroundColor={colors.transparent}
            onPress={reset}
          />
        }
      />
      <View style={styles.gamePage}>
        <CXRow style={styles.versus}>
          <View style={styles.player}>
            <View style={styles.xBadge}>
              <CXText variant="h3" color={colors.white}>
                X
              </CXText>
            </View>
            <CXText variant="smallStrong">You (X)</CXText>
          </View>
          <CXText variant="h2">
            {score[0]} : {score[1]}
          </CXText>
          <View style={styles.player}>
            <View style={styles.oBadge}>
              <CXText variant="h3" color={colors.white}>
                O
              </CXText>
            </View>
            <CXText variant="smallStrong">Computer (O)</CXText>
          </View>
        </CXRow>
        <CXText variant="small" color={colors.textMuted} align="center">
          {won
            ? `${board[won[0]!] === "X" ? "You win!" : "Computer wins"}`
            : draw
              ? "Draw game"
              : "Your turn"}
        </CXText>
        <View style={styles.ttt}>
          {board.map((mark, index) => (
            <Pressable
              key={index}
              onPress={() => play(index)}
              style={styles.tttCell}
            >
              <CXText
                variant="hero"
                color={mark === "X" ? colors.primary : colors.textMuted}
              >
                {mark}
              </CXText>
            </Pressable>
          ))}
        </View>
        <CXButton label="New Game" iconLeft="refresh" onPress={reset} />
      </View>
    </CXScreen>
  );
}

// Snake
type Point = { x: number; y: number };
const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
function randomFood(snake: Point[]): Point {
  let food = {
    x: Math.floor(Math.random() * 14),
    y: Math.floor(Math.random() * 14),
  };
  while (snake.some((part) => samePoint(part, food)))
    food = {
      x: Math.floor(Math.random() * 14),
      y: Math.floor(Math.random() * 14),
    };
  return food;
}
export function SnakeScreen({ navigation }: StackProps<"Snake">) {
  const initial = [
    { x: 7, y: 7 },
    { x: 6, y: 7 },
    { x: 5, y: 7 },
  ];
  const [snake, setSnake] = useState<Point[]>(initial);
  const [food, setFood] = useState(() => randomFood(initial));
  const [dir, setDir] = useState<Point>({ x: 1, y: 0 });
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(75);
  const [level, setLevel] = useState(3);
  const dirRef = useRef(dir);
  dirRef.current = dir;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(
      () =>
        setSnake((current) => {
          const head = {
            x: current[0]!.x + dirRef.current.x,
            y: current[0]!.y + dirRef.current.y,
          };
          if (
            head.x < 0 ||
            head.x >= 14 ||
            head.y < 0 ||
            head.y >= 14 ||
            current.some((part) => samePoint(part, head))
          ) {
            setRunning(false);
            return current;
          }
          const ate = samePoint(head, food);
          const next = [head, ...current];
          if (!ate) next.pop();
          else {
            setScore((value) => value + 25);
            setFood(randomFood(next));
            if (next.length % 5 === 0) setLevel((value) => value + 1);
          }
          return next;
        }),
      Math.max(90, 280 - level * 30),
    );
    return () => clearInterval(timer);
  }, [food, level, running]);
  const turn = (next: Point) => {
    if (next.x === -dir.x && next.y === -dir.y) return;
    setDir(next);
    setRunning(true);
  };
  const reset = () => {
    setSnake(initial);
    setFood(randomFood(initial));
    setDir({ x: 1, y: 0 });
    setScore(0);
    setLevel(1);
    setRunning(false);
  };
  return (
    <CXScreen backgroundColor="#0D0925">
      <CXHeader
        title="Snake 🐍"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="settings-outline"
            label="Settings"
            color={colors.white}
            backgroundColor="rgba(255,255,255,.08)"
          />
        }
      />
      <View style={styles.snakePage}>
        <CXRow style={styles.snakeScores}>
          {[
            ["Score", score],
            ["Best", 310],
            ["Level", level],
          ].map(([label, value]) => (
            <View key={label} style={styles.snakeScore}>
              <CXText variant="caption" color="#CFC7EF">
                {label}
              </CXText>
              <CXText variant="title" color="#72EF86">
                {value}
              </CXText>
            </View>
          ))}
        </CXRow>
        <View style={styles.snakeBoard}>
          {Array.from({ length: 196 }, (_, index) => {
            const point = { x: index % 14, y: Math.floor(index / 14) };
            const snakeIndex = snake.findIndex((part) =>
              samePoint(part, point),
            );
            const isFood = samePoint(food, point);
            return (
              <View
                key={index}
                style={[
                  styles.snakeCell,
                  snakeIndex >= 0 && styles.snakePart,
                  snakeIndex === 0 && styles.snakeHead,
                  isFood && styles.food,
                ]}
              />
            );
          })}
        </View>
        <CXRow style={styles.snakeControls}>
          <CXIconButton
            icon={running ? "pause" : "play"}
            label={running ? "Pause" : "Play"}
            color={colors.white}
            backgroundColor="#292153"
            onPress={() => setRunning((value) => !value)}
          />
          <View style={styles.dpad}>
            <CXIconButton
              icon="chevron-up"
              label="Up"
              color={colors.white}
              backgroundColor="#5F38F1"
              onPress={() => turn({ x: 0, y: -1 })}
            />
            <CXRow>
              <CXIconButton
                icon="chevron-back"
                label="Left"
                color={colors.white}
                backgroundColor="#5F38F1"
                onPress={() => turn({ x: -1, y: 0 })}
              />
              <CXIconButton
                icon="chevron-forward"
                label="Right"
                color={colors.white}
                backgroundColor="#5F38F1"
                onPress={() => turn({ x: 1, y: 0 })}
              />
            </CXRow>
            <CXIconButton
              icon="chevron-down"
              label="Down"
              color={colors.white}
              backgroundColor="#5F38F1"
              onPress={() => turn({ x: 0, y: 1 })}
            />
          </View>
          <CXIconButton
            icon="refresh"
            label="Restart"
            color={colors.white}
            backgroundColor="#292153"
            onPress={reset}
          />
        </CXRow>
      </View>
    </CXScreen>
  );
}

// Memory Match
const memoryIcons: (keyof typeof Ionicons.glyphMap)[] = [
  "school",
  "star",
  "briefcase",
  "book",
  "camera",
  "game-controller",
];
function newDeck() {
  return [...memoryIcons, ...memoryIcons]
    .map((icon, index) => ({ id: `${icon}-${index}`, icon, matched: false }))
    .sort(() => Math.random() - 0.5);
}
export function MemoryMatchScreen({ navigation }: StackProps<"MemoryMatch">) {
  const [deck, setDeck] = useState(newDeck);
  const [open, setOpen] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [start] = useState(Date.now());
  const [locked, setLocked] = useState(false);
  const flip = (index: number) => {
    if (locked || open.includes(index) || deck[index]!.matched) return;
    const next = [...open, index];
    setOpen(next);
    if (next.length === 2) {
      setMoves((value) => value + 1);
      setLocked(true);
      setTimeout(() => {
        const a = next[0]!;
        const b = next[1]!;
        if (deck[a]!.icon === deck[b]!.icon)
          setDeck((items) =>
            items.map((item, itemIndex) =>
              itemIndex === a || itemIndex === b
                ? { ...item, matched: true }
                : item,
            ),
          );
        setOpen([]);
        setLocked(false);
      }, 550);
    }
  };
  const done = deck.every((card) => card.matched);
  return (
    <CXScreen>
      <CXHeader
        title="Memory Match 🧠"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="settings-outline"
            label="Settings"
            backgroundColor={colors.transparent}
          />
        }
      />
      <View style={styles.gamePage}>
        <CXRow style={styles.memoryStats}>
          {[
            [
              "Time",
              `${Math.floor((Date.now() - start) / 60000)
                .toString()
                .padStart(2, "0")}:${Math.floor(
                ((Date.now() - start) / 1000) % 60,
              )
                .toString()
                .padStart(2, "0")}`,
            ],
            ["Moves", moves],
            ["Best", 24],
          ].map(([label, value]) => (
            <View key={label} style={styles.statBox}>
              <CXText variant="caption" color={colors.textMuted}>
                {label}
              </CXText>
              <CXText variant="title">{value}</CXText>
            </View>
          ))}
        </CXRow>
        <View style={styles.memoryGrid}>
          {deck.map((card, index) => {
            const visible = open.includes(index) || card.matched;
            return (
              <Pressable
                key={card.id}
                onPress={() => flip(index)}
                style={[styles.memoryCard, visible && styles.memoryVisible]}
              >
                <Ionicons
                  name={visible ? card.icon : "school-outline"}
                  size={30}
                  color={visible ? "#F7B731" : colors.white}
                />
              </Pressable>
            );
          })}
        </View>
        <CXCard style={styles.tip}>
          <CXText variant="small" color={colors.textMuted} align="center">
            🏆 Match all pairs in the least moves!
          </CXText>
        </CXCard>
        {done ? (
          <CXButton
            label="Play Again"
            onPress={() => {
              setDeck(newDeck());
              setMoves(0);
              setOpen([]);
            }}
          />
        ) : null}
      </View>
    </CXScreen>
  );
}

// Word game
const targetWords = [
  "SOFTWARE",
  "WATER",
  "TOWER",
  "STORE",
  "WASTE",
  "SWEAR",
  "STAR",
  "RATE",
  "TEAR",
  "WEAR",
  "SORE",
  "ROWS",
  "TWO",
  "WAR",
  "RAW",
];
export function WordGameScreen({ navigation }: StackProps<"WordGame">) {
  const [letters, setLetters] = useState("SOFTWARE".split(""));
  const [current, setCurrent] = useState("");
  const [found, setFound] = useState<string[]>(["STAR", "RATE", "WAR"]);
  const add = (letter: string) => setCurrent((value) => value + letter);
  const submit = () => {
    if (targetWords.includes(current) && !found.includes(current))
      setFound((items) => [...items, current]);
    setCurrent("");
  };
  return (
    <CXScreen>
      <CXHeader
        title="Word Game 📖"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="settings-outline"
            label="Settings"
            backgroundColor={colors.transparent}
          />
        }
      />
      <View style={styles.gamePage}>
        <CXRow style={styles.wordStats}>
          {[
            ["Score", found.length * 40],
            ["Time", "01:45"],
            ["Words", `${found.length}/15`],
          ].map(([label, value]) => (
            <View key={label} style={styles.statBox}>
              <CXText variant="caption" color={colors.textMuted}>
                {label}
              </CXText>
              <CXText variant="title" color={colors.primary}>
                {value}
              </CXText>
            </View>
          ))}
        </CXRow>
        <CXText variant="caption" color={colors.primary} align="center">
          Category: Technology
        </CXText>
        <CXRow style={styles.wordSlots}>
          {current
            .padEnd(8, " ")
            .slice(0, 8)
            .split("")
            .map((letter, index) => (
              <View key={index} style={styles.wordSlot}>
                <CXText variant="title">{letter}</CXText>
              </View>
            ))}
        </CXRow>
        <View style={styles.letterWheel}>
          {letters.map((letter, index) => {
            const angle = (Math.PI * 2 * index) / letters.length;
            return (
              <Pressable
                key={`${letter}-${index}`}
                onPress={() => add(letter)}
                style={[
                  styles.letter,
                  {
                    left: 122 + Math.cos(angle) * 96,
                    top: 122 + Math.sin(angle) * 96,
                  },
                ]}
              >
                <CXText variant="h3">{letter}</CXText>
              </Pressable>
            );
          })}
          <Pressable onPress={submit} style={styles.wheelSubmit}>
            <Ionicons name="school" size={30} color={colors.primary} />
          </Pressable>
        </View>
        <CXRow style={styles.wordActions}>
          <Tool
            icon="shuffle"
            label="Shuffle"
            onPress={() =>
              setLetters((items) => [...items].sort(() => Math.random() - 0.5))
            }
          />
          <Tool
            icon="bulb-outline"
            label="Hint"
            badge="3"
            onPress={() =>
              setCurrent(
                targetWords.find((word) => !found.includes(word)) ?? "",
              )
            }
          />
          <Tool
            icon="trash-outline"
            label="Clear"
            onPress={() => setCurrent("")}
          />
        </CXRow>
        <CXButton label="Submit Word" onPress={submit} />
        <CXText variant="small" color={colors.textMuted} align="center">
          Found: {found.join(" · ")}
        </CXText>
      </View>
    </CXScreen>
  );
}

// Chess puzzle: small local move validator for intended puzzle solutions.
const puzzles = [
  {
    title: "White to move and win",
    hint: "Find the best queen move.",
    board: {
      a2: "♙",
      b7: "♟",
      c6: "♟",
      d5: "♜",
      e4: "♗",
      f5: "♕",
      g1: "♔",
      g7: "♚",
      h2: "♙",
      h6: "♟",
    } as Record<string, string>,
    from: "f5",
    to: "h7",
  },
  {
    title: "Black to move — mate in one",
    hint: "Use the rook on the open file.",
    board: { a8: "♚", d8: "♜", g1: "♔", g2: "♙", h2: "♙", f3: "♗" } as Record<
      string,
      string
    >,
    from: "d8",
    to: "d1",
  },
];
export function ChessPuzzlesScreen({ navigation }: StackProps<"ChessPuzzles">) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const puzzle = puzzles[index % puzzles.length]!;
  const squares = Array.from(
    { length: 64 },
    (_, i) => `${String.fromCharCode(97 + (i % 8))}${8 - Math.floor(i / 8)}`,
  );
  const tap = (square: string) => {
    if (!selected) {
      if (puzzle.board[square]) setSelected(square);
      return;
    }
    if (selected === puzzle.from && square === puzzle.to) {
      setResult("Correct! Excellent move. 🔥");
    } else {
      setResult("Not the best move. Try again.");
    }
    setSelected(null);
  };
  const change = (delta: number) => {
    setIndex((value) => (value + delta + puzzles.length) % puzzles.length);
    setSelected(null);
    setResult(null);
  };
  return (
    <CXScreen>
      <CXHeader
        title="Chess Puzzles ♟️"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="settings-outline"
            label="Settings"
            backgroundColor={colors.transparent}
          />
        }
      />
      <View style={styles.chessPage}>
        <CXRow style={styles.chessStats}>
          {[
            ["Puzzle", `${index + 1}/${puzzles.length}`],
            ["Rating", 1260],
            ["Streak", "🔥 7"],
          ].map(([label, value]) => (
            <View key={label} style={styles.statBox}>
              <CXText variant="caption" color="#CDC7E9">
                {label}
              </CXText>
              <CXText variant="title" color={colors.white}>
                {value}
              </CXText>
            </View>
          ))}
        </CXRow>
        <View style={styles.chessBoard}>
          {squares.map((square, squareIndex) => {
            const dark =
              (Math.floor(squareIndex / 8) + (squareIndex % 8)) % 2 === 1;
            return (
              <Pressable
                key={square}
                onPress={() => tap(square)}
                style={[
                  styles.chessSquare,
                  { backgroundColor: dark ? "#8B5F91" : "#F0E1D4" },
                  selected === square && styles.chessSelected,
                ]}
              >
                <CXText style={styles.piece}>
                  {puzzle.board[square] ?? ""}
                </CXText>
              </Pressable>
            );
          })}
        </View>
        <CXCard style={styles.chessPrompt}>
          <View style={styles.flex}>
            <CXText variant="bodyStrong" color={colors.white}>
              {puzzle.title}
            </CXText>
            <CXText variant="small" color="#CDC7E9">
              {puzzle.hint}
            </CXText>
          </View>
          <CXButton
            label="Hint"
            iconLeft="bulb-outline"
            size="sm"
            variant="secondary"
            fullWidth={false}
            onPress={() =>
              setResult(
                `Try ${puzzle.from.toUpperCase()} → ${puzzle.to.toUpperCase()}`,
              )
            }
          />
        </CXCard>
        {result ? (
          <CXText
            variant="bodyStrong"
            color={
              result.startsWith("Correct") ? colors.success : colors.danger
            }
            align="center"
          >
            {result}
          </CXText>
        ) : null}
        <CXRow style={styles.chessNav}>
          <CXButton
            label="Prev"
            iconLeft="chevron-back"
            size="sm"
            variant="secondary"
            onPress={() => change(-1)}
          />
          <CXButton
            label="Skip"
            size="sm"
            variant="secondary"
            onPress={() => change(1)}
          />
          <CXButton
            label="Next"
            iconRight="chevron-forward"
            size="sm"
            variant="secondary"
            onPress={() => change(1)}
          />
        </CXRow>
      </View>
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.72 },
  gameHero: {
    minHeight: 110,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.backgroundLavender,
  },
  gameGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.md },
  gameTile: {
    width: "31.5%",
    minHeight: 130,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  gameTileIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  gamePage: { flex: 1, padding: spacing.screen, gap: spacing.lg },
  scoreRow: { gap: spacing.sm },
  score: { flex: 1, padding: spacing.sm },
  board2048: {
    aspectRatio: 1,
    borderRadius: radius.md,
    padding: spacing.xs,
    backgroundColor: "#D8CFC4",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  tile2048: {
    width: "23.2%",
    height: "23.2%",
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  directionRow: { justifyContent: "center", gap: spacing.sm },
  sudoku: {
    aspectRatio: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 2,
    borderColor: colors.ink,
  },
  sudokuCell: {
    width: "11.111%",
    height: "11.111%",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.textMuted,
  },
  sudokuLeft: { borderLeftWidth: 1.5, borderLeftColor: colors.ink },
  sudokuTop: { borderTopWidth: 1.5, borderTopColor: colors.ink },
  sudokuSelected: { backgroundColor: "#E1EEFF" },
  numberPad: { gap: 4 },
  number: {
    flex: 1,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  sudokuTools: { justifyContent: "space-around" },
  tool: {
    minWidth: 64,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  toolBadge: {
    position: "absolute",
    top: 0,
    right: 10,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  versus: { justifyContent: "space-between" },
  player: { alignItems: "center", gap: spacing.xs },
  xBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  oBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FF5C83",
    alignItems: "center",
    justifyContent: "center",
  },
  ttt: {
    aspectRatio: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tttCell: {
    width: "33.333%",
    height: "33.333%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  snakePage: { flex: 1, padding: spacing.screen, gap: spacing.md },
  snakeScores: { gap: spacing.xs },
  snakeScore: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.sm,
    backgroundColor: "#231A4B",
    alignItems: "center",
    justifyContent: "center",
  },
  snakeBoard: {
    aspectRatio: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#120E37",
    borderWidth: 1,
    borderColor: "#372B79",
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  snakeCell: {
    width: "7.142857%",
    height: "7.142857%",
    borderWidth: 0.15,
    borderColor: "#2A2257",
  },
  snakePart: { backgroundColor: "#68DE71", borderRadius: 3 },
  snakeHead: { backgroundColor: "#9CF27E" },
  food: {
    backgroundColor: "#FF5B57",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#120E37",
  },
  snakeControls: { justifyContent: "space-between" },
  dpad: { alignItems: "center", gap: 3 },
  memoryStats: { gap: spacing.xs },
  statBox: {
    flex: 1,
    minHeight: 62,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  memoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  memoryCard: {
    width: "23.3%",
    aspectRatio: 0.78,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  memoryVisible: {
    backgroundColor: colors.backgroundLavender,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tip: { backgroundColor: colors.backgroundLavender },
  wordStats: { gap: spacing.xs },
  wordSlots: { gap: 4, justifyContent: "center" },
  wordSlot: {
    width: 34,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  letterWheel: {
    width: 280,
    height: 280,
    alignSelf: "center",
    borderRadius: 140,
    backgroundColor: colors.backgroundLavender,
    borderWidth: 1,
    borderColor: colors.border,
  },
  letter: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -23,
    marginTop: -23,
  },
  wheelSubmit: {
    position: "absolute",
    left: 110,
    top: 110,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  wordActions: { justifyContent: "space-around" },
  chessPage: {
    flex: 1,
    padding: spacing.screen,
    gap: spacing.md,
    backgroundColor: "#F8F5FF",
  },
  chessStats: {
    borderRadius: radius.sm,
    backgroundColor: "#24183D",
    padding: spacing.sm,
    gap: spacing.sm,
  },
  chessBoard: {
    aspectRatio: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 4,
    borderColor: "#24183D",
  },
  chessSquare: {
    width: "12.5%",
    height: "12.5%",
    alignItems: "center",
    justifyContent: "center",
  },
  chessSelected: { borderWidth: 3, borderColor: "#FFD43B" },
  piece: { fontSize: 30, lineHeight: 34 },
  chessPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#24183D",
    borderColor: "#24183D",
  },
  chessNav: { gap: spacing.xs },
});
