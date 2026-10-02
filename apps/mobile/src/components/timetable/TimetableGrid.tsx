import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { CXRow, CXText } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";
import type { TimeSlot } from "@/types/domain";

const DAYS = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
];

export interface TimetableGridEntry {
  id?: string;
  day: number;
  subject: string;
  startTime: string;
  endTime: string;
  needsReview?: boolean;
  columnStartIndex?: number;
  columnEndIndex?: number;
  sourceBounds?: any;
}

export interface TimetableGridProps {
  slots: TimeSlot[];
  entries: TimetableGridEntry[];
  onEntryPress?: (entry: TimetableGridEntry) => void;
  onEmptyCellPress?: (day: number, slot: TimeSlot) => void;
  highlightedBounds?: any;
}

export function TimetableGrid({ slots, entries, onEntryPress, onEmptyCellPress, highlightedBounds }: TimetableGridProps) {
  if (!slots.length) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.gridScroll}>
      <View style={styles.gridContainer}>
        {/* Header Row */}
        <CXRow>
          <View style={styles.gridDayCell}>
            <CXText variant="caption" color={colors.textFaint}>DAY</CXText>
          </View>
          {slots.map((slot) => (
            <View key={slot.id || slot.start} style={[styles.gridCell, slot.break && styles.breakCell]}>
              <CXText variant="caption" align="center" color={colors.textMuted}>{slot.label}</CXText>
            </View>
          ))}
        </CXRow>

        {/* Day Rows */}
        {DAYS.map((day) => (
          <CXRow key={day.value}>
            <View style={styles.gridDayCell}>
              <CXText variant="smallStrong">{day.short}</CXText>
            </View>
            {slots.map((slot, columnIndex) => {
              const entry = entries.find(
                (candidate) =>
                  candidate.day === day.value &&
                  columnIndex >= (candidate.columnStartIndex ?? slots.findIndex((item) => item.start === candidate.startTime)) &&
                  columnIndex <= (candidate.columnEndIndex ?? slots.findIndex((item) => item.start === candidate.startTime))
              );

              const startIndex = entry ? (entry.columnStartIndex ?? slots.findIndex((item) => item.start === entry.startTime)) : columnIndex;
              const endIndex = entry ? (entry.columnEndIndex ?? startIndex) : columnIndex;

              // Skip cells that are merged into an earlier column
              if (entry && columnIndex > startIndex) return null;

              const isHighlighted =
                highlightedBounds &&
                entry?.sourceBounds &&
                highlightedBounds.x0 === entry.sourceBounds.x0 &&
                highlightedBounds.y0 === entry.sourceBounds.y0;

              return (
                <Pressable
                  key={slot.id || slot.start}
                  onPress={() => {
                    if (entry && onEntryPress) onEntryPress(entry);
                    if (!entry && !slot.break && onEmptyCellPress) onEmptyCellPress(day.value, slot);
                  }}
                  style={({ pressed }) => [
                    styles.gridCell,
                    { width: 112 * (endIndex - startIndex + 1) },
                    slot.break && styles.breakCell,
                    entry?.needsReview && styles.reviewCell,
                    isHighlighted && styles.highlightedCell,
                    entry && !entry.needsReview && !isHighlighted && styles.activeCell,
                    pressed && styles.pressedCell,
                  ]}
                >
                  {entry ? (
                    <View style={styles.entryContent}>
                      <CXText
                        variant="caption"
                        numberOfLines={3}
                        color={entry.needsReview ? colors.warning : isHighlighted ? colors.primary : colors.ink}
                        style={styles.entryText}
                      >
                        {entry.subject}
                      </CXText>
                    </View>
                  ) : !slot.break ? (
                    <View style={styles.emptyContent}>
                      <Ionicons name="add" size={20} color={colors.textFaint} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </CXRow>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  gridScroll: {
    flexGrow: 0,
    marginHorizontal: -spacing.md,
  },
  gridContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  gridDayCell: {
    width: 60,
    height: 60,
    justifyContent: "center",
  },
  gridCell: {
    width: 112,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderStyle: "dashed",
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  breakCell: {
    backgroundColor: colors.background,
    borderColor: "transparent",
  },
  reviewCell: {
    backgroundColor: `${colors.warning}15`,
    borderColor: colors.warning,
    borderStyle: "solid",
  },
  activeCell: {
    backgroundColor: `${colors.primary}08`,
    borderColor: `${colors.primary}40`,
    borderStyle: "solid",
  },
  highlightedCell: {
    backgroundColor: `${colors.primary}20`,
    borderColor: colors.primary,
    borderStyle: "solid",
  },
  pressedCell: {
    opacity: 0.7,
  },
  entryContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  entryText: {
    textAlign: "center",
  },
});
