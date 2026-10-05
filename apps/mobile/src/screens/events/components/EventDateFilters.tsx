import React from "react";
import { ScrollView, Pressable, StyleSheet, View } from "react-native";
import { CXText } from "@/components/ui";
import { Ionicons } from "@expo/vector-icons";

const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };

interface EventDateFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this_week", label: "This Week" },
  { id: "weekend", label: "Weekend" },
  { id: "custom", isIcon: true }
];

export function EventDateFilters({ activeFilter, onFilterChange }: EventDateFiltersProps) {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {FILTERS.map((f) => {
        const isActive = activeFilter === f.id;
        return (
          <Pressable
            key={f.id}
            onPress={() => onFilterChange(f.id)}
            style={({ pressed }) => [
              styles.pill,
              f.isIcon && styles.iconPill,
              isActive && styles.pillActive,
              pressed && styles.pillPressed
            ]}
          >
            {f.isIcon ? (
              <Ionicons name="calendar-outline" size={14} color={isActive ? "#fff" : theme.colors.textSecondary} />
            ) : (
              <CXText numberOfLines={1} style={[styles.text, isActive && styles.textActive]}>
                {f.label}
              </CXText>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPill: {
    paddingHorizontal: 8,
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pillPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  text: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
    fontSize: 11,
  },
  textActive: {
    color: "#fff",
    fontWeight: "700",
  }
});
