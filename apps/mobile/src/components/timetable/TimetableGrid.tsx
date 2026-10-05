import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { CXRow, CXText } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";
import type { TimeSlot } from "@/types/domain";
import { getSubjectColor } from "@/utils/timetable";

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
  currentDay?: number;
}

export function TimetableGrid({ slots, entries, onEntryPress, onEmptyCellPress, highlightedBounds, isReview, currentDay }: TimetableGridProps) {
  if (!slots.length) return null;
  const todayIndex = currentDay ?? new Date().getDay();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.gridScroll}>
      <View style={styles.gridContainer}>
        <View style={styles.tableWrapper}>
          {/* Header Row */}
          <View style={styles.tableRow}>
            <View style={styles.gridDayCellHeader}>
              <CXText variant="caption" align="center" color={colors.primary}>Day / Time</CXText>
            </View>
            {slots.map((slot) => (
              <View key={slot.id || slot.start} style={[styles.headerCell, slot.break && { width: 30, padding: 0 }]}>
                <CXText variant="caption" align="center" color={colors.primary} style={slot.break && { transform: [{ rotate: "-90deg" }], width: 45 }}>
                  {slot.break ? "BREAK" : slot.label}
                </CXText>
              </View>
            ))}
          </View>

          {/* Day Rows */}
          {DAYS.map((day) => {
            const isToday = day.value === todayIndex;
            return (
            <View style={styles.tableRow} key={day.value}>
              <View style={[styles.gridDayCell, isToday && styles.todayDayCell]}>
                <CXText variant={isToday ? "bodyStrong" : "smallStrong"} align="center" color={colors.ink}>{day.short}</CXText>
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
                for (let i = startIdx; i <= endIdx; i++) w += slots[i]!.break ? 30 : 75;
                return w;
              };

              const isCellActive = !!entry && !entry.needsReview && !isHighlighted;
              const cellColor = entry ? getSubjectColor(entry.subject) : null;

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
                    isCellActive && { backgroundColor: cellColor?.bg },
                    pressed && styles.pressedCell,
                  ]}
                >
                  {entry ? (
                    <View style={styles.entryContent}>
                      <CXText
                        variant="caption"
                        numberOfLines={(entry as any).room ? 2 : 3}
                        color={cellColor?.text}
                        style={styles.entryText}
                      >
                        {entry.subject}
                      </CXText>
                      {!!(entry as any).room && (
                        <CXText numberOfLines={1} style={[styles.entrySubText, { color: cellColor?.text }]}>
                          {(entry as any).room}
                        </CXText>
                      )}
                    </View>
                  ) : slot.break ? (
                    <View style={styles.breakContent}>
                      <CXText variant="caption" color={colors.ink} style={[{ textAlign: "center" }, !isReview && { transform: [{ rotate: "-90deg" }], width: 45 }]}>
                        {isReview ? "BREAK" : "SHORT BREAK"}
                      </CXText>
                    </View>
                  ) : (
                    <View style={[styles.emptyContent, { borderColor: "rgba(0,0,0,0.4)", backgroundColor: "rgba(0,0,0,0.01)" }]}>
                      <Ionicons name="add" size={20} color="rgba(0,0,0,0.2)" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          );
        })}
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
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.4)",
    backgroundColor: colors.surface,
  },
  tableRow: {
    flexDirection: "row",
  },
  todayRow: {},
  todayDayCell: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  gridDayCellHeader: {
    width: 65,
    height: 45,
    justifyContent: "center",
    backgroundColor: colors.primaryTint,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.4)",
  },
  gridDayCell: {
    width: 65,
    height: 45,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.4)",
  },
  headerCell: {
    width: 75,
    justifyContent: "center",
    alignItems: "center",
    padding: 2,
    backgroundColor: colors.primaryTint,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.4)",
  },
  gridCell: {
    width: 75,
    height: 45,
    justifyContent: "center",
    alignItems: "center",
    padding: 2,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.4)",
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "transparent", // only visible when applied
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
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  entryText: {
    textAlign: "center",
    fontFamily: "Inter-SemiBold",
    fontSize: 10,
    color: colors.ink,
  },
  entrySubText: {
    textAlign: "center",
    fontFamily: "Inter-Medium",
    fontSize: 8,
    marginTop: 2,
    color: colors.ink,
    opacity: 0.8,
  },
});
