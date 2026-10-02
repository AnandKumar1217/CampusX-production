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
  isReview?: boolean;
}

export function TimetableGrid({ slots, entries, onEntryPress, onEmptyCellPress, highlightedBounds, isReview }: TimetableGridProps) {
  if (!slots.length) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.gridScroll}>
      <View style={styles.gridContainer}>
        <View style={styles.tableWrapper}>
          {/* Header Row */}
          <View style={styles.tableRow}>
            <View style={styles.gridDayCell}>
              <CXText variant="caption" align="center" color={colors.textFaint}>DAY</CXText>
            </View>
            {slots.map((slot) => (
              <View key={slot.id || slot.start} style={[styles.headerCell, slot.break && { width: 40, padding: 0 }]}>
                <CXText variant="caption" align="center" color={colors.textMuted} style={slot.break && { transform: [{ rotate: "-90deg" }], width: 60 }}>
                  {slot.break ? "BREAK" : slot.label}
                </CXText>
              </View>
            ))}
          </View>

          {/* Day Rows */}
          {DAYS.map((day) => (
            <View style={styles.tableRow} key={day.value}>
              <View style={styles.gridDayCell}>
                <CXText variant="smallStrong" align="center">{day.short}</CXText>
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

              const getCellWidth = (startIdx: number, endIdx: number) => {
                let w = 0;
                for (let i = startIdx; i <= endIdx; i++) w += slots[i]!.break ? 40 : 90;
                return w;
              };

              return (
                <Pressable
                  key={slot.id || slot.start}
                  onPress={() => {
                    if (entry && onEntryPress) onEntryPress(entry);
                    if (!entry && !slot.break && onEmptyCellPress) onEmptyCellPress(day.value, slot);
                  }}
                  style={({ pressed }) => [
                    styles.gridCell,
                    { width: getCellWidth(startIndex, endIndex) },
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
                        color={colors.ink}
                        style={styles.entryText}
                      >
                        {entry.subject}
                      </CXText>
                    </View>
                  ) : slot.break ? (
                    <View style={styles.breakContent}>
                      <CXText variant="caption" color={colors.textFaint} style={{ transform: [{ rotate: "-90deg" }], width: 60, textAlign: "center" }}>BREAK</CXText>
                    </View>
                  ) : (
                    <View style={[styles.emptyContent, isReview && { borderStyle: "dashed", borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.surface }]}>
                      {isReview && <Ionicons name="add" size={20} color={colors.border} />}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
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
  tableWrapper: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#E6E1FA", // soft purple border
    backgroundColor: colors.surface,
  },
  tableRow: {
    flexDirection: "row",
  },
  gridDayCell: {
    width: 45,
    height: 55,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E6E1FA",
  },
  headerCell: {
    width: 90,
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E6E1FA",
  },
  gridCell: {
    width: 90,
    height: 55,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    padding: 4,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E6E1FA",
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  breakContent: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  breakCell: {
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewCell: {
    backgroundColor: colors.warningTint,
  },
  activeCell: {
    backgroundColor: colors.surface, // no background for active classes
  },
  highlightedCell: {
    backgroundColor: colors.primaryTint,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pressedCell: {
    opacity: 0.7,
  },
  entryContent: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    paddingLeft: 4,
  },
  entryText: {
    textAlign: "left",
    fontFamily: "Inter-Medium",
    fontSize: 10,
    color: colors.ink,
  },
});
