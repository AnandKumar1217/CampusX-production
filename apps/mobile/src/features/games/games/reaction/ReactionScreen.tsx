// @ts-nocheck
import { CommonActions } from "@react-navigation/native";
import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CXScreen, CXIconButton, CXText } from "@/components/ui";
import { colors } from "@/theme";
import { ReactionEngine } from "./ReactionEngine";
import { PauseSheet } from "../../components/PauseSheet";

type Props = NativeStackScreenProps<any, any>;

export function ReactionScreen({ navigation, route }: Props) {
  const { mode } = route.params as any; // 2P, 3P, 4P
  
  const [engine, setEngine] = useState<ReactionEngine | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [, forceRender] = useState({});

  useEffect(() => {
    const eng = new ReactionEngine(
      mode, 
      () => forceRender({}),
      (winner) => finishMatch(winner, eng.scores)
    );
    setEngine(eng);
    
    return () => eng.cleanup();
  }, []);

  const finishMatch = (winner: number, scores: number[]) => {
    navigation.replace("GameResult" as any, {
      gameId: "reaction",
      status: `P${winner}_WIN`,
      scoreText: scores.join(" - "),
      ...route.params as any
    });
  };

  if (!engine) return <CXScreen style={styles.container} />;

  const renderZone = (playerId: number, color: string, rotate: boolean) => {
    return (
      <TouchableOpacity 
        activeOpacity={1}
        style={[styles.zone, { backgroundColor: color }]} 
        onPress={() => engine.tap(playerId)}
      >
        <View style={[styles.zoneContent, rotate && { transform: [{ rotate: "180deg" }] }]}>
          <CXText variant="h3" color="white">Player {playerId}</CXText>
          <CXText variant="h1" color="white" style={{ fontSize: 48, marginVertical: 10 }}>{engine.scores[playerId - 1]}</CXText>
          
          {engine.state === "WAITING" && <CXText variant="h2" color="rgba(255,255,255,0.5)">WAIT...</CXText>}
          {engine.state === "GO" && <CXText variant="h1" color="white" style={{ fontSize: 64 }}>TAP!</CXText>}
          
          {engine.state === "FINISHED" && engine.roundWinner === playerId && (
            <CXText variant="h2" color="#10B981">+1 POINT</CXText>
          )}
          {engine.state === "FINISHED" && engine.roundLoser === playerId && (
            <CXText variant="h2" color="#EF4444">EARLY TAP!</CXText>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <CXScreen edges={["top", "bottom"]} style={styles.container}>
      <View style={styles.header}>
        <CXIconButton icon="arrow-back" onPress={() => navigation.goBack()} backgroundColor={colors.transparent} label="" />
        <CXIconButton icon="pause" onPress={() => setIsPaused(true)} backgroundColor={colors.transparent} label="" />
      </View>

      {engine.state === "READY" && (
        <View style={styles.centerStart}>
          <TouchableOpacity style={styles.startBtn} onPress={() => engine.startRound()}>
            <CXText variant="h2" color="white">START ROUND</CXText>
          </TouchableOpacity>
        </View>
      )}

      {engine.mode === "2P" && (
        <View style={styles.split2}>
          {renderZone(2, "#EC4899", true)}
          {renderZone(1, "#3B82F6", false)}
        </View>
      )}

      {engine.mode === "3P" && (
        <View style={styles.split2}>
          <View style={styles.splitRow}>
            {renderZone(2, "#EC4899", true)}
            {renderZone(3, "#10B981", true)}
          </View>
          {renderZone(1, "#3B82F6", false)}
        </View>
      )}

      {engine.mode === "4P" && (
        <View style={styles.split2}>
          <View style={styles.splitRow}>
            {renderZone(2, "#EC4899", true)}
            {renderZone(3, "#10B981", true)}
          </View>
          <View style={styles.splitRow}>
            {renderZone(1, "#3B82F6", false)}
            {renderZone(4, "#F59E0B", false)}
          </View>
        </View>
      )}

      <PauseSheet 
        visible={isPaused}
        onResume={() => setIsPaused(false)}
        onRestart={() => {
          setIsPaused(false);
          engine.cleanup();
          const eng = new ReactionEngine(
            mode, 
            () => forceRender({}),
            (winner) => finishMatch(winner, eng.scores)
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
  centerStart: {
    position: "absolute",
    top: "45%",
    left: 0,
    width: "100%",
    alignItems: "center",
    zIndex: 20,
  },
  startBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 30,
    elevation: 10,
  },
  split2: {
    flex: 1,
  },
  splitRow: {
    flex: 1,
    flexDirection: "row",
  },
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
  }
});
