import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, TextInput, Pressable } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CXScreen, CXText, CXRow, CXIconButton } from "@/components/ui";
import { colors, spacing, radius } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";

import { GameCard } from "../components/GameCard";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { GameStorage } from "../engine/GameStorage";

type Props = NativeStackScreenProps<RootStackParamList, "GamesHub">;

const GAMES = [
  { id: "tictactoe", title: "Tic Tac Toe", players: "2P", icon: "close", bg: "#EAE9FE", color: "#6A5BE2", category: "Board" },
  { id: "airhockey", title: "Air Hockey", players: "2P", icon: "disc", bg: "#DFF0FF", color: "#3B82F6", category: "Arcade" },
  { id: "pong", title: "Pong Battle", players: "2P", icon: "tennisball", bg: "#FFE4E6", color: "#E11D48", category: "Arcade" },
  { id: "chess", title: "Chess", players: "2P", icon: "extension-puzzle", bg: "#F3E8FF", color: "#9333EA", category: "Board" },
  { id: "connectfour", title: "Connect Four", players: "2P", icon: "apps", bg: "#DCFCE7", color: "#16A34A", category: "Board" },
  { id: "checkers", title: "Checkers", players: "2P", icon: "grid", bg: "#FFE4E6", color: "#E11D48", category: "Board" },
  { id: "reversi", title: "Reversi", players: "2P", icon: "radio-button-on", bg: "#E0F2FE", color: "#0284C7", category: "Board" },
  { id: "dotsandboxes", title: "Dots & Boxes", players: "2P", icon: "apps-outline", bg: "#DCFCE7", color: "#16A34A", category: "Board" },
  { id: "mancala", title: "Mancala", players: "2P", icon: "ellipse-outline", bg: "#FEF3C7", color: "#D97706", category: "Board" },
  { id: "snake", title: "Snake Battle", players: "2P", icon: "analytics", bg: "#DCFCE7", color: "#16A34A", category: "Arcade" },
  { id: "football", title: "Finger Football", players: "2P", icon: "football", bg: "#E0F2FE", color: "#0284C7", category: "Arcade" },
  { id: "memory", title: "Memory Battle", players: "2P", icon: "albums", bg: "#FCE7F3", color: "#DB2777", category: "Brain" },
  { id: "reaction", title: "Reaction Tap", players: "1P", icon: "flash", bg: "#FEF3C7", color: "#D97706", category: "Brain" },
  { id: "quiz", title: "Quick Quiz", players: "1P", icon: "help-circle", bg: "#EAE9FE", color: "#6A5BE2", category: "Brain" },
  { id: "maze", title: "Maze Paint", players: "1P", icon: "color-palette", bg: "#E0F2FE", color: "#0284C7", category: "Brain" },
];

const FILTERS = [
  { label: "All", icon: undefined },
  { label: "Multiplayer", icon: "people" },
  { label: "Arcade", icon: "game-controller" },
  { label: "Board", icon: "cube" },
  { label: "Brain", icon: "git-network" },
];

function formatTimeAgo(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function GamesHomeScreen({ navigation }: Props) {
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentGames, setRecentGames] = useState<{ gameId: string, playedAt: number }[]>([]);

  useFocusEffect(
    useCallback(() => {
      GameStorage.getRecentGames().then(setRecentGames);
    }, [])
  );

  const matched = GAMES.filter(g => {
    const matchesFilter =
      filter === "All" ? true :
        filter === "Multiplayer" ? g.players === "2P" :
          g.category === filter;

    const matchesSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handlePlayGame = async (gameId: string) => {
    await GameStorage.addRecentGame(gameId);
    navigation.navigate("GameSetup", { gameId } as any);
  };

  return (
    <CXScreen edges={["top", "left", "right"]} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.backBtnWrapper}>
          <CXIconButton
            icon="arrow-back"
            onPress={navigation.goBack}
            backgroundColor="#F3F4F6"
            label="Back"
          />
        </View>
        <View style={styles.headerText}>
          <CXText variant="h1" style={{ fontSize: 24, color: "#111827", fontWeight: "800" }}>Games</CXText>
          <CXText variant="caption" style={{ color: "#6B7280", marginTop: 2, fontSize: 13 }}>Play offline with friends</CXText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            placeholder="Search games..."
            style={styles.searchInput}
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {FILTERS.map(f => (
            <Pressable
              key={f.label}
              style={[styles.customChip, filter === f.label ? styles.chipActive : styles.chipInactive]}
              onPress={() => setFilter(f.label)}
            >
              {f.icon && (
                <Ionicons
                  name={f.icon as any}
                  size={14}
                  color={filter === f.label ? colors.white : "#7C3AED"}
                  style={styles.chipIcon}
                />
              )}
              <CXText style={[styles.chipText, filter === f.label ? { color: colors.white } : { color: "#4B5563" }]}>
                {f.label}
              </CXText>
            </Pressable>
          ))}
        </ScrollView>

        <LinearGradient
          colors={["#8B5CF6", "#6D28D9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerContent}>
            <CXText variant="h1" color={colors.white} style={{ marginBottom: 4, fontSize: 24 }}>
              Quick Play
            </CXText>
            <CXText variant="caption" style={{ color: "#EBE9FE", marginBottom: 16, fontSize: 13, lineHeight: 18 }}>
              Jump into a fun game{"\n"}with your friends offline!
            </CXText>
            <Pressable style={styles.bannerBtn}>
              <CXText style={styles.bannerBtnText}>Let's Play →</CXText>
            </Pressable>
          </View>
          <View style={styles.bannerIcon}>
            <Ionicons name="game-controller" size={100} color="rgba(255,255,255,0.2)" />
          </View>
        </LinearGradient>

        {recentGames.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <CXText variant="h2" style={{ fontSize: 16 }}>Recently Played</CXText>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
              {recentGames.map((rg) => {
                const g = GAMES.find(game => game.id === rg.gameId);
                if (!g) return null;
                return (
                  <Pressable key={rg.gameId} style={styles.recentCard} onPress={() => handlePlayGame(g.id)}>
                    <View style={[styles.recentIconBg, { backgroundColor: g.bg }]}>
                      <Ionicons name={g.icon as any} size={24} color={g.color} />
                    </View>
                    <CXText variant="bodyStrong" style={{ fontSize: 11, textAlign: "center", marginBottom: 2, color: "#111827" }} numberOfLines={1}>{g.title}</CXText>
                    <CXText variant="caption" color="#9CA3AF" style={{ fontSize: 9 }}>{formatTimeAgo(rg.playedAt)}</CXText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        <View style={styles.sectionHeader}>
          <CXText variant="h2" style={{ fontSize: 16 }}>All Games</CXText>
        </View>
        <View style={styles.grid}>
          {matched.map(g => (
            <GameCard
              key={g.id}
              title={g.title}
              players={g.players}
              icon={g.icon as any}
              bg={g.bg}
              color={g.color}
              onPress={() => handlePlayGame(g.id)}
            />
          ))}
        </View>
      </ScrollView>
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FAFAFA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backBtnWrapper: {
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#111827",
    paddingVertical: 0,
  },
  chipScroll: {
    gap: 10,
    marginBottom: 20,
  },
  customChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipActive: {
    backgroundColor: "#7C3AED",
  },
  chipInactive: {
    backgroundColor: "#F3F4F6",
  },
  chipIcon: {
    marginRight: 6,
  },
  chipText: {
    fontWeight: "600",
    fontSize: 12,
  },
  banner: {
    borderRadius: 24,
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    overflow: "hidden",
  },
  bannerContent: {
    flex: 1,
    zIndex: 2,
  },
  bannerBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  bannerBtnText: {
    color: "#7C3AED",
    fontWeight: "bold",
    fontSize: 14,
  },
  bannerIcon: {
    position: "absolute",
    right: -20,
    bottom: -20,
    transform: [{ rotate: "-15deg" }],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionHeader: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  recentScroll: {
    gap: 16,
    marginBottom: 24,
  },
  recentCard: {
    alignItems: "center",
    width: 64,
  },
  recentIconBg: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  }
});
