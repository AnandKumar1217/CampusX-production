// @ts-nocheck
import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, GestureResponderEvent } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { CXScreen, CXIconButton } from "@/components/ui";
import { colors } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";
import { PongEngine } from "./PongEngine";
import { GameLoop } from "../../engine/GameLoop";
import { globalTouchManager } from "../../engine/MultiTouchManager";
import { PauseSheet } from "../../components/PauseSheet";
import { ScoreBoard } from "../../components/ScoreBoard";
import { GameStorage } from "../../engine/GameStorage";
import { TouchDebugOverlay } from "../../components/TouchDebugOverlay";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// Game area is roughly screen minus safe areas and headers
const GAME_WIDTH = SCREEN_WIDTH;
const GAME_HEIGHT = SCREEN_HEIGHT - 200; 

type Props = NativeStackScreenProps<any, any>;

export function PongScreen({ navigation, route }: Props) {
  const { mode, difficulty, matchLength } = route.params as any;
  const isAI = mode === "1P";
  const targetScore = matchLength === 1 ? 5 : matchLength === 3 ? 10 : 15; // Example scaling

  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [isPaused, setIsPaused] = useState(false);
  
  const p1X = useSharedValue(GAME_WIDTH / 2);
  const p2X = useSharedValue(GAME_WIDTH / 2);
  const ballX = useSharedValue(GAME_WIDTH / 2);
  const ballY = useSharedValue(GAME_HEIGHT / 2);

  const engineRef = useRef<PongEngine | null>(null);
  const loopRef = useRef<GameLoop | null>(null);

  useEffect(() => {
    engineRef.current = new PongEngine(GAME_WIDTH, GAME_HEIGHT, (s1, s2) => {
      setScore({ p1: s1, p2: s2 });
      if (s1 >= targetScore || s2 >= targetScore) {
        finishMatch(s1, s2);
      }
    });

    loopRef.current = new GameLoop((dt) => {
      if (!engineRef.current || isPaused) return;
      
      const engine = engineRef.current;
      
      // Update touches
      const p1Touches = globalTouchManager.getActiveTouchesForPlayer(1);
      if (p1Touches.length > 0) {
        engine.setP1Position(p1Touches[0].currentX);
      }

      if (!isAI) {
        const p2Touches = globalTouchManager.getActiveTouchesForPlayer(2);
        if (p2Touches.length > 0) {
          engine.setP2Position(p2Touches[0].currentX);
        }
      } else {
        engine.updateAI(difficulty, dt);
      }

      engine.update(dt);

      // Sync to shared values for UI
      p1X.value = engine.p1X;
      p2X.value = engine.p2X;
      ballX.value = engine.ballX;
      ballY.value = engine.ballY;
    });

    loopRef.current.start();

    return () => {
      loopRef.current?.stop();
    };
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
      await GameStorage.updateStats("pong", {
        played: 1,
        wins: status === "WON" ? 1 : 0,
        losses: status === "LOST" ? 1 : 0,
      });
    }

    navigation.replace("GameResult" as any, {
      gameId: "pong",
      status,
      scoreText: `${s1} - ${s2}`,
      ...route.params as any
    });
  };

  const handleTouchStart = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]!;
      const playerId = t.locationY > GAME_HEIGHT / 2 ? 1 : 2;
      globalTouchManager.startTouch(String(t.identifier), playerId, "paddle", t.locationX, t.locationY);
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
    transform: [{ translateX: p1X.value - 50 }] // paddleWidth / 2
  }));

  const p2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: p2X.value - 50 }]
  }));

  const ballStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ballX.value - 8 }, // ballSize / 2
      { translateY: ballY.value - 8 }
    ]
  }));

  return (
    <CXScreen edges={["top", "bottom"]} style={styles.container}>
      <View style={styles.header}>
        <CXIconButton icon="arrow-back" onPress={() => navigation.goBack()} backgroundColor={colors.transparent} label="" />
        <ScoreBoard 
          scoreP1={score.p1} 
          scoreP2={score.p2} 
          nameP1="Player 1" 
          nameP2={isAI ? "AI" : "Player 2"}
          colorP1="#3B82F6"
          colorP2="#EC4899"
        />
        <CXIconButton icon="pause" onPress={() => setIsPaused(true)} backgroundColor={colors.transparent} label="" />
      </View>

      <View 
        style={styles.gameArea}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onStartShouldSetResponderCapture={() => true}
        onMoveShouldSetResponderCapture={() => true}
        onResponderTerminationRequest={() => false}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Center Line */}
        <View style={styles.centerLine} pointerEvents="none" />

        {/* Paddle 2 (Top) */}
        <Animated.View style={[styles.paddle, styles.paddleP2, p2Style]} pointerEvents="none" />

        {/* Paddle 1 (Bottom) */}
        <Animated.View style={[styles.paddle, styles.paddleP1, p1Style]} pointerEvents="none" />

        {/* Ball */}
        <Animated.View style={[styles.ball, ballStyle]} pointerEvents="none" />
      </View>

      <PauseSheet 
        visible={isPaused}
        onResume={() => setIsPaused(false)}
        onRestart={() => {
          setIsPaused(false);
          setScore({ p1: 0, p2: 0 });
          if (engineRef.current) {
            engineRef.current.scoreP1 = 0;
            engineRef.current.scoreP2 = 0;
            engineRef.current.resetBall();
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
    backgroundColor: "#111827", // Dark background for arcade feel
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  gameArea: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  centerLine: {
    position: "absolute",
    top: "50%",
    width: "100%",
    height: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  paddle: {
    position: "absolute",
    width: 100,
    height: 20,
    borderRadius: 10,
  },
  paddleP2: {
    top: 40,
    backgroundColor: "#EC4899",
  },
  paddleP1: {
    bottom: 40,
    backgroundColor: "#3B82F6",
  },
  ball: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  }
});
