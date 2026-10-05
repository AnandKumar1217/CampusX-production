import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, GestureResponderEvent } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { CXScreen, CXIconButton, CXText } from "@/components/ui";
import { colors } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";
import { AirHockeyEngine } from "./AirHockeyEngine";
import { GameLoop } from "../../engine/GameLoop";
import { globalTouchManager } from "../../engine/MultiTouchManager";
import { PauseSheet } from "../../components/PauseSheet";
import { GameStorage } from "../../engine/GameStorage";
import { TouchDebugOverlay } from "../../components/TouchDebugOverlay";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// Leave room for header/safe areas
const GAME_WIDTH = SCREEN_WIDTH;
const GAME_HEIGHT = SCREEN_HEIGHT - 120; 

type Props = NativeStackScreenProps<any, any>;

export function AirHockeyScreen({ navigation, route }: Props) {
  const { mode, difficulty, matchLength } = route.params as any;
  const isAI = mode === "1P";
  const targetScore = matchLength === 1 ? 5 : matchLength === 3 ? 10 : 15;

  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [isPaused, setIsPaused] = useState(false);
  
  const p1X = useSharedValue(GAME_WIDTH / 2);
  const p1Y = useSharedValue(GAME_HEIGHT - 100);
  const p2X = useSharedValue(GAME_WIDTH / 2);
  const p2Y = useSharedValue(100);
  const puckX = useSharedValue(GAME_WIDTH / 2);
  const puckY = useSharedValue(GAME_HEIGHT / 2);

  const engineRef = useRef<AirHockeyEngine | null>(null);
  const loopRef = useRef<GameLoop | null>(null);

  useEffect(() => {
    engineRef.current = new AirHockeyEngine(GAME_WIDTH, GAME_HEIGHT, (s1, s2) => {
      setScore({ p1: s1, p2: s2 });
      if (s1 >= targetScore || s2 >= targetScore) {
        finishMatch(s1, s2);
      }
    });

    loopRef.current = new GameLoop((dt) => {
      if (!engineRef.current || isPaused) return;
      
      const engine = engineRef.current;
      
      const p1Touches = globalTouchManager.getActiveTouchesForPlayer(1);
      if (p1Touches.length > 0) {
        engine.setP1Position(p1Touches[0].currentX, p1Touches[0].currentY);
      }

      if (!isAI) {
        const p2Touches = globalTouchManager.getActiveTouchesForPlayer(2);
        if (p2Touches.length > 0) {
          engine.setP2Position(p2Touches[0].currentX, p2Touches[0].currentY);
        }
      } else {
        engine.updateAI(difficulty, dt);
      }

      engine.update(dt);

      p1X.value = engine.p1X;
      p1Y.value = engine.p1Y;
      p2X.value = engine.p2X;
      p2Y.value = engine.p2Y;
      puckX.value = engine.puckX;
      puckY.value = engine.puckY;
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
      await GameStorage.updateStats("airhockey", {
        played: 1,
        wins: status === "WON" ? 1 : 0,
        losses: status === "LOST" ? 1 : 0,
      });
    }

    navigation.replace("GameResult" as any, {
      gameId: "airhockey",
      status,
      scoreText: `${s1} - ${s2}`,
      ...route.params as any
    });
  };

  const handleTouchStart = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i]!;
      // Offset touch Y by header height (~80) to map to game area properly if needed
      // but nativeEvent.locationY is relative to the element
      const locY = t.locationY;
      const playerId = locY > GAME_HEIGHT / 2 ? 1 : 2;
      globalTouchManager.startTouch(String(t.identifier), playerId, "mallet", t.locationX, locY);
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
    transform: [{ translateX: p1X.value - 30 }, { translateY: p1Y.value - 30 }]
  }));

  const p2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: p2X.value - 30 }, { translateY: p2Y.value - 30 }]
  }));

  const puckStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: puckX.value - 20 }, { translateY: puckY.value - 20 }]
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
        onStartShouldSetResponderCapture={() => true}
        onMoveShouldSetResponderCapture={() => true}
        onResponderTerminationRequest={() => false}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Board graphics */}
        <View style={styles.centerLine} pointerEvents="none" />
        <View style={styles.centerCircle} pointerEvents="none" />
        
        {/* Goals */}
        <View style={[styles.goal, styles.goalTop]} pointerEvents="none" />
        <View style={[styles.goal, styles.goalBottom]} pointerEvents="none" />

        {/* Paddle 2 (Top) */}
        <Animated.View style={[styles.mallet, styles.malletP2, p2Style]} pointerEvents="none">
          <View style={styles.malletInner} />
        </Animated.View>

        {/* Paddle 1 (Bottom) */}
        <Animated.View style={[styles.mallet, styles.malletP1, p1Style]} pointerEvents="none">
          <View style={styles.malletInner} />
        </Animated.View>

        {/* Puck */}
        <Animated.View style={[styles.puck, puckStyle]} pointerEvents="none">
          <View style={styles.puckInner} />
        </Animated.View>
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
            engineRef.current.resetPuck();
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
    backgroundColor: "#111827",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 10,
    height: 60,
  },
  gameArea: {
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#FFFFFF",
    borderColor: "#EF4444",
    borderWidth: 5,
    borderRadius: 20,
    alignSelf: "center",
    position: "relative",
    overflow: "hidden",
  },
  centerLine: {
    position: "absolute",
    top: "50%",
    width: "100%",
    height: 4,
    backgroundColor: "#EF4444",
  },
  centerCircle: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 100,
    height: 100,
    marginLeft: -50,
    marginTop: -50,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: "#EF4444",
  },
  goal: {
    position: "absolute",
    width: 140,
    height: 10,
    left: "50%",
    marginLeft: -70,
    backgroundColor: "#222",
  },
  goalTop: {
    top: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  goalBottom: {
    bottom: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  mallet: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  malletInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  malletP2: {
    backgroundColor: "#EC4899",
  },
  malletP1: {
    backgroundColor: "#3B82F6",
  },
  puck: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FCD34D",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#F59E0B",
  },
  puckInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F59E0B",
  }
});
