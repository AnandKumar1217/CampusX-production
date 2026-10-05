import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { CXText } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";

interface GameCardProps {
  title: string;
  players: string;
  isOffline?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  color: string;
  onPress: () => void;
}

export function GameCard({ title, players, isOffline = true, icon, bg, color, onPress }: GameCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.iconColumn}>
        <View style={[styles.iconBg, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
      </View>
      
      <View style={styles.infoColumn}>
        <CXText variant="bodyStrong" style={styles.title} numberOfLines={1}>
          {title}
        </CXText>
        
        <View style={styles.actionRow}>
          <View style={styles.tags}>
            <View style={styles.tag}>
              <CXText style={styles.tagText}>{players}</CXText>
            </View>
            {isOffline && (
              <View style={styles.tag}>
                <CXText style={styles.tagText}>Offline</CXText>
              </View>
            )}
          </View>
          
          <View style={styles.playBtn}>
            <CXText style={styles.playBtnText}>Play</CXText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 8,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  iconColumn: {
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  infoColumn: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    marginBottom: 4,
    color: "#1F2937",
    fontWeight: "bold",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tags: {
    flexDirection: "row",
    gap: 2,
    flexWrap: "wrap",
    width: 40,
  },
  tag: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 8,
    color: "#6B7280",
    fontWeight: "600",
  },
  playBtn: {
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  playBtnText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "bold",
  }
});
