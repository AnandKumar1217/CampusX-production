import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, TouchableOpacity } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { CXScreen, CXIconButton, CXText } from "@/components/ui";
import { colors } from "@/theme";
import { MazeEngine } from "./MazeEngine";
import { PauseSheet } from "../../components/PauseSheet";
import { GameStorage } from "../../engine/GameStorage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const GAME_AREA_SIZE = SCREEN_WIDTH - 32; 

type Props = NativeStackScreenProps<any, any>;

export function MazeScreen({ navigation, route }: Props) {
  const [engine, setEngine] = useState<MazeEngine | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [, forceRender] = useState({});

  useEffect(() => {
    const load = async () => {
      const stats = await GameStorage.getStats("maze");
      const lvl = stats.maxLevel ? Math.max(1, stats.maxLevel) : 1;
      setEngine(new MazeEngine(lvl));
    };
    load();
  }, []);

  const finishMatch = async (eng: MazeEngine) => {
    const stats = await GameStorage.getStats("maze");
    const nextLvl = eng.level + 1; // Wait, eng.level isn't saved in MazeEngine, I need to add it or pass it.
    // Let me patch MazeEngine or just read from stats? I didn't store level in engine.
    // I can pass it through a state.
  };

  if (!engine) return <CXScreen style={styles.container} />;

  const cellW = GAME_AREA_SIZE / engine.width;
  const cellH = GAME_AREA_SIZE / engine.height;

  const handleMove = (dir: "UP" | "DOWN" | "LEFT" | "RIGHT") => {
    engine.move(dir);
    forceRender({});
    if (engine.isComplete) {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    const stats = await GameStorage.getStats("maze");
    const currentLvl = stats.maxLevel ? Math.max(1, stats.maxLevel) : 1;
    await GameStorage.updateStats("maze", {
      played: 1,
      maxLevel: currentLvl + 1
    });

    navigation.replace("GameResult" as any, {
      gameId: "maze",
      status: "LEVEL COMPLETE",
      scoreText: `Moves: ${engine.moves}`,
      nextLevel: currentLvl + 1,
      ...route.params as any
    });
  };

  return (
    <CXScreen edges={["top", "bottom"]} style={styles.container}>
      <View style={styles.header}>
        <CXIconButton icon="arrow-back" onPress={() => navigation.goBack()} backgroundColor={colors.transparent} label="" />
        <View style={{ alignItems: "center" }}>
          {/* We didn't store level in engine, but we can compute it from width/height or just display 'Color Maze' */}
          <CXText variant="h3" color={colors.white}>COLOR MAZE</CXText>
          <CXText variant="body" color={colors.gray400}>Moves: {engine.moves}</CXText>
        </View>
        <CXIconButton icon="pause" onPress={() => setIsPaused(true)} backgroundColor={colors.transparent} label="" />
      </View>

      <View style={styles.gameContainer}>
        <View style={[styles.mazeBoard, { width: GAME_AREA_SIZE, height: GAME_AREA_SIZE }]}>
          {engine.grid.flat().map((cell, i) => (
            <View 
              key={i} 
              style={[
                styles.cell,
                {
                  left: cell.x * cellW,
                  top: cell.y * cellH,
                  width: cellW,
                  height: cellH,
                  borderTopWidth: cell.top ? 2 : 0,
                  borderRightWidth: cell.right ? 2 : 0,
                  borderBottomWidth: cell.bottom ? 2 : 0,
                  borderLeftWidth: cell.left ? 2 : 0,
                }
              ]} 
            />
          ))}

          {/* Goal */}
          <View style={[
            styles.goal, 
            { 
              left: engine.goalX * cellW + cellW * 0.2, 
              top: engine.goalY * cellH + cellH * 0.2,
              width: cellW * 0.6,
              height: cellH * 0.6
            }
          ]} />

          {/* Player */}
          <Animated.View style={[
            styles.player,
            { 
              left: engine.playerX * cellW + cellW * 0.2, 
              top: engine.playerY * cellH + cellH * 0.2,
              width: cellW * 0.6,
              height: cellH * 0.6
            }
          ]} />
        </View>
      </View>

      <View style={styles.dpadContainer}>
        <View style={styles.dpadRow}>
          <TouchableOpacity style={styles.dpadBtn} onPress={() => handleMove("UP")}>
            <CXText variant="h2" color="white">↑</CXText>
          </TouchableOpacity>
        </View>
        <View style={styles.dpadRow}>
          <TouchableOpacity style={styles.dpadBtn} onPress={() => handleMove("LEFT")}>
            <CXText variant="h2" color="white">←</CXText>
          </TouchableOpacity>
          <View style={{ width: 60 }} />
          <TouchableOpacity style={styles.dpadBtn} onPress={() => handleMove("RIGHT")}>
            <CXText variant="h2" color="white">→</CXText>
          </TouchableOpacity>
        </View>
        <View style={styles.dpadRow}>
          <TouchableOpacity style={styles.dpadBtn} onPress={() => handleMove("DOWN")}>
            <CXText variant="h2" color="white">↓</CXText>
          </TouchableOpacity>
        </View>
      </View>

      <PauseSheet 
        visible={isPaused}
        onResume={() => setIsPaused(false)}
        onRestart={() => {
          setIsPaused(false);
          // Just reload the component effectively
          setEngine(null); 
          setTimeout(() => {
            const load = async () => {
              const stats = await GameStorage.getStats("maze");
              const lvl = stats.maxLevel ? Math.max(1, stats.maxLevel) : 1;
              setEngine(new MazeEngine(lvl));
            };
            load();
          }, 100);
        }}
        onQuit={() => {
          setIsPaused(false);
          navigation.dispatch((state) => {
            const hubIndex = state.routes.findIndex((r) => r.name === 'GamesHub');
            if (hubIndex !== -1) {
              return CommonActions.reset({
                ...state,
                routes: state.routes.slice(0, hubIndex + 1),
                index: hubIndex,
              });
            }
            return CommonActions.navigate('GamesHub');
          });
        }}
      />
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#1E1B4B" }, // Deep dark blue/purple
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 60,
  },
  gameContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  mazeBoard: {
    backgroundColor: "#312E81",
    position: "relative",
  },
  cell: {
    position: "absolute",
    borderColor: "#A5B4FC",
  },
  player: {
    position: "absolute",
    backgroundColor: "#F472B6", // Pink
    borderRadius: 999,
  },
  goal: {
    position: "absolute",
    backgroundColor: "#34D399", // Emerald
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  dpadContainer: {
    alignItems: "center",
    paddingBottom: 40,
  },
  dpadRow: {
    flexDirection: "row",
  },
  dpadBtn: {
    width: 65,
    height: 65,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    margin: 5,
    elevation: 5,
  }
});
