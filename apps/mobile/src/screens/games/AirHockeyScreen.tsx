import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Dimensions, Text, Pressable, PanResponder } from "react-native";
import type { RootStackParamList } from "@/types/navigation";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;

const { width, height } = Dimensions.get("window");
const PADDLE_RADIUS = 35;
const PUCK_RADIUS = 20;
const GOAL_WIDTH = width * 0.4;

export function AirHockeyScreen({ navigation }: StackProps<"AirHockey">) {
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [isPaused, setIsPaused] = useState(false);

  // Use refs for positions to avoid state closure issues in requestAnimationFrame
  const p1Pos = useRef({ x: width / 2, y: height - 100 });
  const p2Pos = useRef({ x: width / 2, y: 100 });
  const puckPos = useRef({ x: width / 2, y: height / 2 });
  const puckVel = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);

  // Force re-render just to update UI based on refs
  const [, setTick] = useState(0);

  const resetPuck = (server: "p1" | "p2") => {
    puckPos.current = { x: width / 2, y: height / 2 };
    puckVel.current = { x: 0, y: server === "p1" ? 5 : -5 };
  };

  const gameLoop = () => {
    if (isPaused) return;

    // Apply velocity
    puckPos.current.x += puckVel.current.x;
    puckPos.current.y += puckVel.current.y;

    // Friction
    puckVel.current.x *= 0.99;
    puckVel.current.y *= 0.99;

    // Wall collisions
    if (puckPos.current.x - PUCK_RADIUS < 0) {
      puckPos.current.x = PUCK_RADIUS;
      puckVel.current.x *= -1;
    }
    if (puckPos.current.x + PUCK_RADIUS > width) {
      puckPos.current.x = width - PUCK_RADIUS;
      puckVel.current.x *= -1;
    }

    // Goal collisions (Top and Bottom)
    if (puckPos.current.y - PUCK_RADIUS < 0) {
      if (puckPos.current.x > width / 2 - GOAL_WIDTH / 2 && puckPos.current.x < width / 2 + GOAL_WIDTH / 2) {
        // P1 scores
        setScore(s => ({ ...s, p1: s.p1 + 1 }));
        resetPuck("p1");
      } else {
        puckPos.current.y = PUCK_RADIUS;
        puckVel.current.y *= -1;
      }
    }
    if (puckPos.current.y + PUCK_RADIUS > height) {
      if (puckPos.current.x > width / 2 - GOAL_WIDTH / 2 && puckPos.current.x < width / 2 + GOAL_WIDTH / 2) {
        // P2 scores
        setScore(s => ({ ...s, p2: s.p2 + 1 }));
        resetPuck("p2");
      } else {
        puckPos.current.y = height - PUCK_RADIUS;
        puckVel.current.y *= -1;
      }
    }

    // Paddle Collisions
    const checkPaddleCollision = (paddle: {x: number, y: number}) => {
      const dx = puckPos.current.x - paddle.x;
      const dy = puckPos.current.y - paddle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = PADDLE_RADIUS + PUCK_RADIUS;

      if (distance < minDistance) {
        // Normalization
        const nx = dx / distance;
        const ny = dy / distance;

        // Push puck out
        puckPos.current.x = paddle.x + nx * minDistance;
        puckPos.current.y = paddle.y + ny * minDistance;

        // Bounce velocity (add some extra speed based on paddle hit)
        const speed = Math.max(Math.sqrt(puckVel.current.x ** 2 + puckVel.current.y ** 2), 5);
        puckVel.current.x = nx * (speed + 2);
        puckVel.current.y = ny * (speed + 2);

        // Max speed cap
        const maxSpeed = 15;
        const currentSpeed = Math.sqrt(puckVel.current.x ** 2 + puckVel.current.y ** 2);
        if (currentSpeed > maxSpeed) {
          puckVel.current.x = (puckVel.current.x / currentSpeed) * maxSpeed;
          puckVel.current.y = (puckVel.current.y / currentSpeed) * maxSpeed;
        }
      }
    };

    checkPaddleCollision(p1Pos.current);
    checkPaddleCollision(p2Pos.current);

    setTick(t => t + 1);
    frameRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    resetPuck("p1");
    frameRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const p1Responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (evt, gestureState) => {
      const newX = gestureState.moveX;
      const newY = gestureState.moveY;
      if (newY > height / 2 + PADDLE_RADIUS) { // Restrict to bottom half
        p1Pos.current = { x: newX, y: newY };
      }
    }
  });

  const p2Responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (evt, gestureState) => {
      const newX = gestureState.moveX;
      const newY = gestureState.moveY;
      if (newY < height / 2 - PADDLE_RADIUS) { // Restrict to top half
        p2Pos.current = { x: newX, y: newY };
      }
    }
  });

  return (
    <View style={styles.container}>
      {/* Center Line */}
      <View style={styles.centerLine} />

      {/* Goals */}
      <View style={[styles.goal, { top: 0, borderColor: "#3B82F6", borderTopWidth: 0 }]} />
      <View style={[styles.goal, { bottom: 0, borderColor: "#EC4899", borderBottomWidth: 0 }]} />

      {/* Scores */}
      <Text style={[styles.score, { top: height / 2 - 100, transform: [{ rotate: "180deg" }], color: "#3B82F6" }]}>{score.p2}</Text>
      <Text style={[styles.score, { bottom: height / 2 - 100, color: "#EC4899" }]}>{score.p1}</Text>

      {/* P2 Touch Area (Top) */}
      <View
        style={[styles.touchArea, { top: 0 }]}
        {...p2Responder.panHandlers}
      />

      {/* P1 Touch Area (Bottom) */}
      <View
        style={[styles.touchArea, { bottom: 0 }]}
        {...p1Responder.panHandlers}
      />

      {/* P2 Paddle (Top) */}
      <View style={[
        styles.paddle,
        styles.p2Paddle,
        { left: p2Pos.current.x - PADDLE_RADIUS, top: p2Pos.current.y - PADDLE_RADIUS }
      ]} />

      {/* P1 Paddle (Bottom) */}
      <View style={[
        styles.paddle,
        styles.p1Paddle,
        { left: p1Pos.current.x - PADDLE_RADIUS, top: p1Pos.current.y - PADDLE_RADIUS }
      ]} />

      {/* Puck */}
      <View style={[
        styles.puck,
        { left: puckPos.current.x - PUCK_RADIUS, top: puckPos.current.y - PUCK_RADIUS }
      ]} />

      <Pressable style={styles.backButton} onPress={navigation.goBack}>
        <Ionicons name="close" size={32} color="#FFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  touchArea: {
    position: "absolute",
    width: width,
    height: height / 2,
    zIndex: 10,
  },
  centerLine: {
    position: "absolute",
    top: height / 2 - 1,
    width: "100%",
    height: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  goal: {
    position: "absolute",
    left: width / 2 - GOAL_WIDTH / 2,
    width: GOAL_WIDTH,
    height: 10,
    borderWidth: 4,
    borderLeftWidth: 4,
    borderRightWidth: 4,
  },
  score: {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    fontSize: 80,
    fontWeight: "bold",
    opacity: 0.1,
    zIndex: 1,
  },
  paddle: {
    position: "absolute",
    width: PADDLE_RADIUS * 2,
    height: PADDLE_RADIUS * 2,
    borderRadius: PADDLE_RADIUS,
    borderWidth: 4,
    zIndex: 5,
    backgroundColor: "#0F172A",
  },
  p1Paddle: {
    borderColor: "#EC4899",
    shadowColor: "#EC4899",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  p2Paddle: {
    borderColor: "#3B82F6",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  puck: {
    position: "absolute",
    width: PUCK_RADIUS * 2,
    height: PUCK_RADIUS * 2,
    borderRadius: PUCK_RADIUS,
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 4,
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: 50,
    zIndex: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
