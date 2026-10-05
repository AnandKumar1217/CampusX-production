// @ts-nocheck
import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { useAnimatedStyle, withTiming, interpolate } from "react-native-reanimated";
import { CXScreen, CXIconButton, CXText } from "@/components/ui";
import { colors } from "@/theme";
import { MemoryEngine } from "./MemoryEngine";
import { PauseSheet } from "../../components/PauseSheet";
import { GameStorage } from "../../engine/GameStorage";

type Props = NativeStackScreenProps<any, any>;

const ICONS = ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🦄"];

export function MemoryScreen({ navigation, route }: Props) {
  const { mode } = route.params as any;
  const isSolo = mode === "1P";

  const [engine, setEngine] = useState<MemoryEngine | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [, forceRender] = useState({});

  useEffect(() => {
    const loadProgress = async () => {
      let startLevel = 1;
      if (isSolo) {
        const stats = await GameStorage.getStats("memory");
        startLevel = stats.maxLevel ? Math.max(1, stats.maxLevel) : 1;
      }
      
      const eng = new MemoryEngine(
        mode,
        () => forceRender({}),
        () => {}, // on match (maybe play sound)
        (winner, scores) => finishMatch(eng, winner, scores)
      );
      eng.startLevel(startLevel);
      setEngine(eng);
    };
    loadProgress();
  }, []);

  const finishMatch = async (eng: MemoryEngine, winner: number | "DRAW" | "WIN", scores: number[]) => {
    let status = "DRAW";
    let scoreText = "";

    if (isSolo) {
      status = "LEVEL COMPLETE";
      scoreText = `Moves: ${eng.moves}`;
      const stats = await GameStorage.getStats("memory");
      const nextLevel = eng.level + 1;
      await GameStorage.updateStats("memory", {
        played: 1,
        maxLevel: Math.max(stats.maxLevel || 1, nextLevel)
      });
      
      navigation.replace("GameResult" as any, {
        gameId: "memory",
        status,
        scoreText,
        ...route.params as any,
        nextLevel // Custom param for next action
      });
    } else {
      if (winner === "DRAW") status = "DRAW";
      else status = `P${winner}_WIN`;
      
      scoreText = scores.slice(0, eng.players).join(" - ");
      navigation.replace("GameResult" as any, {
        gameId: "memory",
        status,
        scoreText,
        ...route.params as any
      });
    }
  };

  if (!engine) return <CXScreen style={styles.container} />;

  const getGridStyle = () => {
    const len = engine.cards.length;
    let cols = 2;
    if (len > 4) cols = 3;
    if (len > 12) cols = 4;
    return {
      width: `${100 / cols}%` as any,
      padding: 5,
    };
  };

  return (
    <CXScreen edges={["top", "bottom"]} style={styles.container}>
      <View style={styles.header}>
        <CXIconButton icon="arrow-back" onPress={() => navigation.goBack()} backgroundColor={colors.transparent} label="" />
        <View style={{ alignItems: "center" }}>
          <CXText variant="h3" color={colors.white}>
            {isSolo ? `Level ${engine.level}` : `Memory Battle`}
          </CXText>
          <CXText variant="body" color={colors.gray400}>
            {isSolo ? `Moves: ${engine.moves}` : `P${engine.currentPlayer + 1}'s Turn`}
          </CXText>
        </View>
        <CXIconButton icon="pause" onPress={() => setIsPaused(true)} backgroundColor={colors.transparent} label="" />
      </View>

      {!isSolo && (
        <View style={styles.scoreBoard}>
          {engine.scores.slice(0, engine.players).map((s, i) => (
            <View key={i} style={[styles.scorePill, engine.currentPlayer === i && styles.activePill]}>
              <CXText variant="h4" color={engine.currentPlayer === i ? "#FFF" : colors.gray400}>
                P{i + 1}: {s}
              </CXText>
            </View>
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.boardContainer}>
        <View style={styles.board}>
          {engine.cards.map((card, idx) => (
            <View key={card.id} style={getGridStyle()}>
              <CardView 
                card={card} 
                onPress={() => engine.flipCard(idx)} 
              />
            </View>
          ))}
        </View>
      </ScrollView>

      <PauseSheet 
        visible={isPaused}
        onResume={() => setIsPaused(false)}
        onRestart={() => {
          setIsPaused(false);
          engine.startLevel(engine.level);
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

function CardView({ card, onPress }: { card: any, onPress: () => void }) {
  const isFlipped = card.isFlipped || card.isMatched;
  
  const animatedStyle = useAnimatedStyle(() => {
    const rotateY = withTiming(isFlipped ? 180 : 0, { duration: 300 });
    return {
      transform: [{ rotateY: `${rotateY}deg` }]
    };
  });

  const frontStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isFlipped ? 0 : 1, { duration: 150 })
    };
  });

  const backStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isFlipped ? 1 : 0, { duration: 150 }),
      transform: [{ rotateY: "180deg" }]
    };
  });

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.cardWrapper}>
      <Animated.View style={[styles.card, animatedStyle, card.isMatched && { opacity: 0.5 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.cardFace, styles.cardFront, frontStyle]}>
          <CXText variant="h2" color="#FFF">?</CXText>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.cardFace, styles.cardBack, backStyle]}>
          <CXText variant="h1">{ICONS[card.value % ICONS.length]}</CXText>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#4C1D95" }, // Deep purple
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 60,
  },
  scoreBoard: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  scorePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  activePill: {
    backgroundColor: "#EC4899",
  },
  boardContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 10,
  },
  board: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  cardWrapper: {
    aspectRatio: 3/4,
    width: "100%",
  },
  card: {
    width: "100%",
    height: "100%",
  },
  cardFace: {
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backfaceVisibility: "hidden",
  },
  cardFront: {
    backgroundColor: "#7C3AED", // Purple lighter
    borderWidth: 2,
    borderColor: "#8B5CF6",
  },
  cardBack: {
    backgroundColor: "#F3F4F6", // White
  }
});
