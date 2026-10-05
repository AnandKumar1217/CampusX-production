import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, GestureResponderEvent } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { CXScreen, CXIconButton, CXText } from "@/components/ui";
import { colors } from "@/theme";
import { FootballEngine } from "./FootballEngine";
import { GameLoop } from "../../engine/GameLoop";
import { globalTouchManager } from "../../engine/MultiTouchManager";
import { PauseSheet } from "../../components/PauseSheet";
import { GameStorage } from "../../engine/GameStorage";
import { TouchDebugOverlay } from "../../components/TouchDebugOverlay";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const GAME_WIDTH = SCREEN_WIDTH;
const GAME_HEIGHT = SCREEN_HEIGHT - 120; 

type Props = NativeStackScreenProps<any, any>;

export function FootballScreen({ navigation, route }: Props) {
  const { mode, difficulty, matchLength } = route.params as any;
  const isAI = mode === "1P";
  const targetScore = matchLength === 1 ? 3 : matchLength === 3 ? 5 : 10;

  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [isPaused, setIsPaused] = useState(false);
  
  const p1X = useSharedValue(GAME_WIDTH / 2);
  const p1Y = useSharedValue(GAME_HEIGHT - 100);
  const p2X = useSharedValue(GAME_WIDTH / 2);
  const p2Y = useSharedValue(100);
  const ballX = useSharedValue(GAME_WIDTH / 2);
  const ballY = useSharedValue(GAME_HEIGHT / 2);

  const engineRef = useRef<FootballEngine | null>(null);
  const loopRef = useRef<GameLoop | null>(null);

  useEffect(() => {
    engineRef.current = new FootballEngine(GAME_WIDTH, GAME_HEIGHT, (s1, s2) => {
      setScore({ p1: s1, p2: s2 });
      if (s1 >= targetScore || s2 >= targetScore) {
        finishMatch(s1, s2);
      }
    });

    loopRef.current = new GameLoop((dt) => {
      if (!engineRef.current || isPaused) return;
      
      const engine = engineRef.current;
      
      // Update P1 Controls
      const p1Joy = globalTouchManager.getTouchForControl(1, "joy");
      if (p1Joy) {
        // center of bottom-left quadrant is (GAME_WIDTH/4, GAME_HEIGHT * 0.75)
        const joyCenterX = GAME_WIDTH / 4;
        const joyCenterY = GAME_HEIGHT * 0.75;
        const dx = p1Joy.currentX - p1Joy.startX;
        const dy = p1Joy.currentY - p1Joy.startY;
        const dist = Math.hypot(dx, dy);
        const maxRadius = 40;
        if (dist > 0) {
          engine.p1JoyX = (dx / dist) * Math.min(1, dist / maxRadius);
          engine.p1JoyY = (dy / dist) * Math.min(1, dist / maxRadius);
        } else {
          engine.p1JoyX = 0;
          engine.p1JoyY = 0;
        }
      } else {
        engine.p1JoyX = 0;
        engine.p1JoyY = 0;
      }
      
      engine.p1Kicking = !!globalTouchManager.getTouchForControl(1, "kick");

      // Update P2 Controls
      if (!isAI) {
        const p2Joy = globalTouchManager.getTouchForControl(2, "joy");
        if (p2Joy) {
          const dx = p2Joy.currentX - p2Joy.startX;
          const dy = p2Joy.currentY - p2Joy.startY;
          const dist = Math.hypot(dx, dy);
          const maxRadius = 40;
          if (dist > 0) {
            engine.p2JoyX = (dx / dist) * Math.min(1, dist / maxRadius);
            engine.p2JoyY = (dy / dist) * Math.min(1, dist / maxRadius);
          } else {
            engine.p2JoyX = 0;
            engine.p2JoyY = 0;
          }
        } else {
          engine.p2JoyX = 0;
          engine.p2JoyY = 0;
        }
        engine.p2Kicking = !!globalTouchManager.getTouchForControl(2, "kick");
      } else {
        engine.updateAI(difficulty, dt);
      }

      engine.update(dt);

      p1X.value = engine.p1X;
      p1Y.value = engine.p1Y;
      p2X.value = engine.p2X;
      p2Y.value = engine.p2Y;
      ballX.value = engine.ballX;
      ballY.value = engine.ballY;
    });

    loopRef.current.start();

    return () => loopRef.current?.stop();
  }, []);

  useEffect(() => {
    if (isPaused) loopRef.current?.pause();
    else loopRef.current?.resume();
  }, [isPaused]);

  const finishMatch = async (s1: number, s2: number) => {
    loopRef.current?.stop();
    let status = "DRAW";
    if (s1 > s2) status = isAI ? "WON" : "P1_WIN";
    if (s2 > s1) status = isAI ? "LOST" : "P2_WIN";
    
    if (isAI) {
      await GameStorage.updateStats("football", {
        played: 1,
        wins: status === "WON" ? 1 : 0,
        losses: status === "LOST" ? 1 : 0,
      });
    }

    navigation.replace("GameResult" as any, {
      gameId: "football",
      status,
      scoreText: `${s1} - ${s2}`,
      ...route.params as any
    });
  };

  const classifyTouch = (x: number, y: number) => {
    const isP1 = y > GAME_HEIGHT / 2;
    const isJoy = isP1 ? x < GAME_WIDTH / 2 : x > GAME_WIDTH / 2;
    // For P2 (top), joystick is on the right side if they are facing each other?
    // Let's make joystick on the left relative to their view.
    // P1 (bottom): left side = x < width/2.
    // P2 (top): right side = x > width/2 (since screen is inverted for them).
    
    return {
      playerId: isP1 ? 1 : 2,
      controlId: isJoy ? "joy" : "kick"
    };
  };

  const handleTouchStart = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]!;
      const { playerId, controlId } = classifyTouch(t.locationX, t.locationY);
      globalTouchManager.startTouch(String(t.identifier), playerId, controlId, t.locationX, t.locationY);
    }
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]!;
      globalTouchManager.moveTouch(String(t.identifier), t.locationX, t.locationY);
    }
  };

  const handleTouchEnd = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]!;
      globalTouchManager.endTouch(String(t.identifier));
    }
  };

  const p1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: p1X.value - 20 }, { translateY: p1Y.value - 20 }]
  }));

  const p2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: p2X.value - 20 }, { translateY: p2Y.value - 20 }]
  }));

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ballX.value - 12 }, { translateY: ballY.value - 12 }]
  }));

  return (
    <CXScreen edges={["top", "bottom"]} style={styles.container}>
      <View style={styles.header}>
        <CXIconButton icon="arrow-back" onPress={() => navigation.goBack()} backgroundColor={colors.transparent} label="" />
        <CXText variant="h2" color={colors.white}>{score.p2} - {score.p1}</CXText>
        <CXIconButton icon="pause" onPress={() => setIsPaused(true)} backgroundColor={colors.transparent} label="" />
      </View>

      <View 
        style={styles.gameArea}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Field Graphics */}
        <View style={styles.centerLine} pointerEvents="none" />
        <View style={styles.centerCircle} pointerEvents="none" />
        
        <View style={[styles.goal, styles.goalTop]} pointerEvents="none" />
        <View style={[styles.goal, styles.goalBottom]} pointerEvents="none" />

        <View style={[styles.penaltyArea, styles.penaltyTop]} pointerEvents="none" />
        <View style={[styles.penaltyArea, styles.penaltyBottom]} pointerEvents="none" />

        {/* Players */}
        <Animated.View style={[styles.player, styles.player2, p2Style]} pointerEvents="none" />
        <Animated.View style={[styles.player, styles.player1, p1Style]} pointerEvents="none" />

        {/* Ball */}
        <Animated.View style={[styles.ball, ballStyle]} pointerEvents="none" />

        {/* UI Overlays for touch zones (invisible or subtle) */}
        <View style={styles.uiOverlay} pointerEvents="none">
          <View style={styles.uiHalf}>
            <View style={styles.joyZone}><CXText style={styles.hint} color="rgba(255,255,255,0.2)">KICK</CXText></View>
            <View style={styles.kickZone}><CXText style={styles.hint} color="rgba(255,255,255,0.2)">JOYSTICK</CXText></View>
          </View>
          <View style={styles.uiHalf}>
            <View style={styles.joyZone}><CXText style={styles.hint} color="rgba(255,255,255,0.2)">JOYSTICK</CXText></View>
            <View style={styles.kickZone}><CXText style={styles.hint} color="rgba(255,255,255,0.2)">KICK</CXText></View>
          </View>
        </View>
      </View>

      <PauseSheet 
        visible={isPaused}
        onResume={() => setIsPaused(false)}
        onRestart={() => {
          setIsPaused(false);
          setScore({ p1: 0, p2: 0 });
          engineRef.current?.resetBall();
          if (engineRef.current) {
            engineRef.current.scoreP1 = 0;
            engineRef.current.scoreP2 = 0;
          }
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
      <TouchDebugOverlay />
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#064E3B", // Pitch green
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 60,
  },
  gameArea: {
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#059669",
    borderWidth: 2,
    borderColor: "#A7F3D0",
    position: "relative",
    overflow: "hidden",
  },
  centerLine: {
    position: "absolute",
    top: "50%",
    width: "100%",
    height: 2,
    backgroundColor: "#A7F3D0",
  },
  centerCircle: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 80,
    height: 80,
    marginLeft: -40,
    marginTop: -40,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#A7F3D0",
  },
  goal: {
    position: "absolute",
    width: 120,
    height: 20,
    left: "50%",
    marginLeft: -60,
    borderWidth: 2,
    borderColor: "#A7F3D0",
  },
  goalTop: {
    top: 0,
    borderTopWidth: 0,
  },
  goalBottom: {
    bottom: 0,
    borderBottomWidth: 0,
  },
  penaltyArea: {
    position: "absolute",
    width: 200,
    height: 80,
    left: "50%",
    marginLeft: -100,
    borderWidth: 2,
    borderColor: "#A7F3D0",
  },
  penaltyTop: {
    top: 0,
    borderTopWidth: 0,
  },
  penaltyBottom: {
    bottom: 0,
    borderBottomWidth: 0,
  },
  player: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  player1: {
    backgroundColor: "#3B82F6", // Blue
  },
  player2: {
    backgroundColor: "#EC4899", // Pink
  },
  ball: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#000",
  },
  uiOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  uiHalf: {
    flex: 1,
    flexDirection: "row",
  },
  joyZone: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  kickZone: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  hint: {
    fontSize: 24,
    fontWeight: "bold",
  }
});
