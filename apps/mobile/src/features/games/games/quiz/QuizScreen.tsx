import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CXScreen, CXIconButton, CXText } from "@/components/ui";
import { colors } from "@/theme";
import { QuizEngine } from "./QuizEngine";
import { PauseSheet } from "../../components/PauseSheet";

type Props = NativeStackScreenProps<any, any>;

export function QuizScreen({ navigation, route }: Props) {
  const { mode } = route.params as any; // 1P, 2P, 3P, 4P
  
  const [engine, setEngine] = useState<QuizEngine | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [, forceRender] = useState({});

  useEffect(() => {
    const eng = new QuizEngine(
      mode, 
      () => forceRender({}),
      (winner, scores) => finishMatch(winner, scores)
    );
    setEngine(eng);
  }, []);

  const finishMatch = (winner: number | "DRAW", scores: number[]) => {
    let status = "DRAW";
    if (mode === "1P") status = "GAME OVER";
    else if (winner !== "DRAW") status = `P${winner}_WIN`;
    
    navigation.replace("GameResult" as any, {
      gameId: "quiz",
      status,
      scoreText: scores.slice(0, engine?.players || 1).join(" - "),
      ...route.params as any
    });
  };

  if (!engine) return <CXScreen style={styles.container} />;

  const currentQ = engine.questions[engine.currentQ];

  const renderPlayerControls = (playerId: number, color: string, rotate: boolean) => {
    if (engine.answered[playerId - 1]) {
      return (
        <View style={[styles.zone, { backgroundColor: color }]}>
          <View style={[styles.zoneContent, rotate && { transform: [{ rotate: "180deg" }] }]}>
            <CXText variant="h2" color="rgba(255,255,255,0.5)">ANSWERED</CXText>
            <CXText variant="body" color="white" style={{ marginTop: 10 }}>Score: {engine.scores[playerId - 1]}</CXText>
          </View>
        </View>
      );
    }
    
    return (
      <View style={[styles.zone, { backgroundColor: color }]}>
        <View style={[styles.zoneContent, rotate && { transform: [{ rotate: "180deg" }] }]}>
          <CXText variant="h3" color="white">P{playerId}</CXText>
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: "#10B981" }]} onPress={() => engine.submitAnswer(playerId, true)}>
              <CXText variant="h3" color="white">TRUE</CXText>
            </TouchableOpacity>
            <View style={{ width: 20 }} />
            <TouchableOpacity style={[styles.btn, { backgroundColor: "#EF4444" }]} onPress={() => engine.submitAnswer(playerId, false)}>
              <CXText variant="h3" color="white">FALSE</CXText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <CXScreen edges={["top", "bottom"]} style={styles.container}>
      <View style={styles.header}>
        <CXIconButton icon="arrow-back" onPress={() => navigation.goBack()} backgroundColor={colors.transparent} label="" />
        <CXIconButton icon="pause" onPress={() => setIsPaused(true)} backgroundColor={colors.transparent} label="" />
      </View>

      <View style={styles.questionOverlay} pointerEvents="none">
        <View style={styles.questionBox}>
          {engine.roundOver ? (
            <CXText variant="h2" color="white">
              Answer: {currentQ.answer ? "TRUE" : "FALSE"}
            </CXText>
          ) : (
            <CXText variant="h3" color="white" style={{ textAlign: "center" }}>
              {currentQ?.text}
            </CXText>
          )}
        </View>
      </View>

      {engine.mode === "1P" && (
        <View style={styles.split1}>
          {renderPlayerControls(1, "#3B82F6", false)}
        </View>
      )}

      {engine.mode === "2P" && (
        <View style={styles.split2}>
          {renderPlayerControls(2, "#EC4899", true)}
          {renderPlayerControls(1, "#3B82F6", false)}
        </View>
      )}

      {engine.mode === "3P" && (
        <View style={styles.split2}>
          <View style={styles.splitRow}>
            {renderPlayerControls(2, "#EC4899", true)}
            {renderPlayerControls(3, "#10B981", true)}
          </View>
          {renderPlayerControls(1, "#3B82F6", false)}
        </View>
      )}

      {engine.mode === "4P" && (
        <View style={styles.split2}>
          <View style={styles.splitRow}>
            {renderPlayerControls(2, "#EC4899", true)}
            {renderPlayerControls(3, "#10B981", true)}
          </View>
          <View style={styles.splitRow}>
            {renderPlayerControls(1, "#3B82F6", false)}
            {renderPlayerControls(4, "#F59E0B", false)}
          </View>
        </View>
      )}

      <PauseSheet 
        visible={isPaused}
        onResume={() => setIsPaused(false)}
        onRestart={() => {
          setIsPaused(false);
          const eng = new QuizEngine(
            mode, 
            () => forceRender({}),
            (winner, scores) => finishMatch(winner, scores)
          );
          setEngine(eng);
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
  container: { backgroundColor: "#111827" },
  header: {
    position: "absolute",
    top: 40,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  questionOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  questionBox: {
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#4B5563",
    maxWidth: "80%",
  },
  split1: { flex: 1 },
  split2: { flex: 1 },
  splitRow: { flex: 1, flexDirection: "row" },
  zone: {
    flex: 1,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoneContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  btnRow: {
    flexDirection: "row",
    marginTop: 20,
  },
  btn: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    elevation: 5,
  }
});
