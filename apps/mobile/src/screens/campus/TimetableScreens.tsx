import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Image,
} from "react-native";

import {
  CXButton,
  CXCard,
  CXChip,
  CXHeader,
  CXIconButton,
  CXInput,
  CXKeyboardScreen,
  CXRow,
  CXScreen,
  CXState,
  CXText,
  CXActionSheet,
  type CXAction
} from "@/components/ui";
import { useActualSchedule } from "@/hooks/useActualSchedule";
import { getApiErrorMessage } from "@/services/api";
import { processTimetableImageLocal } from "@/services/mlkitOcr";
import {
  invalidateScheduleData,
  scheduleQueryKeys,
  scheduleService,
  toLocalDateKey,
  type ChangeScope,
  type ConflictAction,
} from "@/services/scheduleService";
import { parseTimetableImage } from "@/services/timetableImageParser";
import { timetableService } from "@/services/timetableService";
import { TimetableGrid, type TimetableGridEntry } from "@/components/timetable/TimetableGrid";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme";
import type { ScheduleClass, TimeSlot } from "@/types/domain";
import type { RootStackParamList } from "@/types/navigation";
import { normalizeTimetableEntries, getSubjectColor } from "@/utils/timetable";
import { validateReviewEntry } from "@/utils/timetableValidation";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, Name>;

const DAYS = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
] as const;

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function timeToMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(value: string) {
  if (!TIME_PATTERN.test(value)) return value;
  const [rawHour, minutes] = value.split(":").map(Number);
  const suffix = rawHour! >= 12 ? "PM" : "AM";
  const hour = rawHour! % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function timeDate(value: string) {
  const [hours = 9, minutes = 0] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function timeKey(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function dateForWeekday(day: number) {
  const date = new Date();
  const today = date.getDay() || 7;
  date.setDate(date.getDate() + day - today);
  return toLocalDateKey(date);
}

function readableDate(dateKey: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, options ?? {
    weekday: "long", month: "long", day: "numeric",
  });
}

function scheduleState(item: ScheduleClass, date: string) {
  if (date !== toLocalDateKey()) return "future";
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  if (now >= timeToMinutes(item.endTime)) return "past";
  if (now >= timeToMinutes(item.startTime)) return "current";
  return "future";
}

function getStaticHoliday(dateString: string) {
  const d = new Date(`${dateString}T12:00:00`);
  if (d.getDay() === 0) return { id: "static", name: "Sunday", custom: false };
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const md = `${month}-${day}`;

  // Fixed annual holidays
  switch (md) {
    case "1-1": return { id: "static", name: "New Year's Day", custom: false };
    case "1-14": return { id: "static", name: "Makar Sankranti / Pongal", custom: false };
    case "1-26": return { id: "static", name: "Republic Day", custom: false };
    case "5-1": return { id: "static", name: "Labour Day", custom: false };
    case "8-15": return { id: "static", name: "Independence Day", custom: false };
    case "10-2": return { id: "static", name: "Gandhi Jayanti", custom: false };
    case "12-25": return { id: "static", name: "Christmas", custom: false };
  }

  // Movable / Lunar holidays (Festivals for 2025, 2026, 2027)
  const festivals: Record<string, string> = {
    // 2025
    "2025-02-26": "Maha Shivaratri",
    "2025-03-14": "Holi",
    "2025-03-30": "Ugadi / Gudi Padwa",
    "2025-03-31": "Eid ul-Fitr",
    "2025-04-06": "Ram Navami",
    "2025-04-18": "Good Friday",
    "2025-06-07": "Eid al-Adha",
    "2025-08-09": "Raksha Bandhan",
    "2025-08-16": "Janmashtami",
    "2025-08-27": "Ganesh Chaturthi",
    "2025-10-02": "Dasara (Vijayadashami)",
    "2025-10-20": "Diwali (Deepavali)",
    // 2026
    "2026-02-15": "Maha Shivaratri",
    "2026-03-04": "Holi",
    "2026-03-20": "Ugadi / Eid ul-Fitr",
    "2026-03-28": "Ram Navami",
    "2026-04-03": "Good Friday",
    "2026-05-27": "Eid al-Adha",
    "2026-06-26": "Muharram",
    "2026-08-26": "Milad-un-Nabi",
    "2026-08-28": "Raksha Bandhan",
    "2026-09-04": "Janmashtami",
    "2026-09-14": "Ganesh Chaturthi",
    "2026-10-19": "Dasara (Vijayadashami)",
    "2026-11-08": "Diwali (Deepavali)",
    "2026-11-24": "Guru Nanak Jayanti",
    // 2027
    "2027-03-08": "Maha Shivaratri",
    "2027-03-10": "Eid ul-Fitr",
    "2027-03-22": "Holi",
    "2027-03-26": "Good Friday",
    "2027-04-08": "Ugadi",
    "2027-04-16": "Ram Navami",
    "2027-05-17": "Eid al-Adha",
    "2027-08-17": "Raksha Bandhan",
    "2027-08-25": "Janmashtami",
    "2027-09-04": "Ganesh Chaturthi",
    "2027-10-10": "Dasara (Vijayadashami)",
    "2027-10-29": "Diwali (Deepavali)"
  };

  if (festivals[dateString]) {
    return { id: "static", name: festivals[dateString], custom: false };
  }

  return null;
}

function mutationError(error: unknown, fallback: string) {
  Alert.alert("Couldn’t save", getApiErrorMessage(error) || fallback);
}

function deriveTimeSlots(classes: any[]): TimeSlot[] {
  const times = new Set<string>();
  classes.forEach((c) => { times.add(c.startTime); times.add(c.endTime); });
  const sortedTimes = Array.from(times).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));

  if (sortedTimes.length < 2) return [];
  const slots: TimeSlot[] = [];
  for (let i = 0; i < sortedTimes.length - 1; i++) {
    const start = sortedTimes[i]!;
    const end = sortedTimes[i + 1]!;
    slots.push({ id: `${start}-${end}`, start, end, label: `${formatTime(start)} - ${formatTime(end)}`, break: false });
  }
  return slots;
}

export function TimetableScreen({ navigation }: StackProps<"Timetable">) {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.user?.id);
  const currentDay = new Date().getDay();
  const todayVal = currentDay >= 1 && currentDay <= 6 ? currentDay : 1;

  const baseQuery = useQuery({
    queryKey: ["timetable", userId],
    queryFn: timetableService.getTimetable,
    enabled: Boolean(userId),
  });

  const settingsQuery = useQuery({
    queryKey: ["timetableSettings", userId],
    queryFn: timetableService.getSettings,
    enabled: Boolean(userId),
  });

  const refresh = async () => {
    await Promise.all([baseQuery.refetch(), settingsQuery.refetch()]);
  };

  const removeBase = async (id: string) => {
    await timetableService.deleteEntry(id);
    await invalidateScheduleData(queryClient);
  };

  const [selectedEntry, setSelectedEntry] = useState<TimetableGridEntry | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const menuActions: CXAction[] = [
    {
      label: "Import Timetable",
      icon: "cloud-upload-outline",
      onPress: () => {
        setMenuVisible(false);
        navigation.navigate("TimetableSettings");
      }
    },
    {
      label: "Delete Entire Timetable",
      icon: "trash",
      destructive: true,
      confirmationTitle: "Delete entire timetable?",
      confirmationMessage: "This will remove all classes and cannot be undone.",
      confirmationButtonText: "Delete All",
      onPress: async () => {
        try {
          await timetableService.clearTimetable();
          await invalidateScheduleData(queryClient);
          setMenuVisible(false);
        } catch (error) {
          mutationError(error, "Could not clear the timetable.");
        }
      }
    }
  ];


  const actionSheetActions: CXAction[] = selectedEntry ? [
    {
      label: "Edit Class",
      icon: "pencil",
      onPress: () => {
        setActionSheetVisible(false);
        navigation.navigate("EditClass", { entryId: selectedEntry.id, mode: "base", date: dateForWeekday(selectedEntry.day) });
      }
    },
    {
      label: "Move Class",
      icon: "swap-horizontal",
      onPress: () => {
        setActionSheetVisible(false);
        navigation.navigate("MoveClass", { classId: selectedEntry.id!, date: dateForWeekday(selectedEntry.day), mode: "base" });
      }
    },
    {
      label: "Delete Class",
      icon: "trash",
      destructive: true,
      confirmationTitle: `Delete ${selectedEntry.subject}?`,
      confirmationMessage: `This will remove ${selectedEntry.subject} from your weekly timetable.`,
      confirmationButtonText: "Delete",
      onPress: async () => {
        try {
          await removeBase(selectedEntry.id!);
        } catch (error) {
          mutationError(error, "Could not delete the class.");
        }
      }
    }
  ] : [];

  const showActions = (item: TimetableGridEntry) => {
    if (!item.id) return;
    setSelectedEntry(item);
    setActionSheetVisible(true);
  };

  const hasBaseTimetable = (baseQuery.data?.length ?? 0) > 0;

  let slots = settingsQuery.data?.gridTimeSlots ?? [];
  if (!slots.length && baseQuery.data) {
    slots = deriveTimeSlots(baseQuery.data as any);
  }

  const entries: TimetableGridEntry[] = normalizeTimetableEntries(baseQuery.data ?? [], slots);

  const [now, setNow] = useState(new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentMins = now.getHours() * 60 + now.getMinutes();

  const todayTimeline: any[] = [];
  entries.forEach(e => {
    if (e.day === todayVal) {
      const sMins = timeToMinutes(e.startTime);
      const eMins = timeToMinutes(e.endTime);

      let status = "upcoming";
      if (currentMins >= eMins) status = "completed";
      else if (currentMins >= sMins && currentMins < eMins) status = "current";

      todayTimeline.push({
        ...e,
        status,
        sMins,
      });
    }
  });

  // Sort by start time
  todayTimeline.sort((a, b) => a.sMins - b.sMins);

  const todayDateString = toLocalDateKey(new Date());
  const todayHoliday = getStaticHoliday(todayDateString);

  return (
    <CXScreen>
      <View style={styles.headerPad}>
        <CXHeader
          title="Timetable"
          subtitle="Your weekly schedule"
          onBack={navigation.goBack}
          right={(
            <CXRow style={styles.headerActions}>
              <CXButton
                size="sm"
                variant="secondary"
                iconLeft="calendar-outline"
                label="Calendar"
                fullWidth={false}
                onPress={() => navigation.navigate("Calendar")}
                style={{ borderRadius: 100 }}
              />
              <CXIconButton icon="ellipsis-vertical" label="Timetable options" onPress={() => setMenuVisible(true)} />
            </CXRow>
          )}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.timelineContent}
        refreshControl={<RefreshControl refreshing={baseQuery.isRefetching || settingsQuery.isRefetching} onRefresh={() => void refresh()} />}
      >

        {baseQuery.isLoading || settingsQuery.isLoading ? (
          <CXState icon="time-outline" title="Loading schedule" message="Getting your latest timetable…" />
        ) : !hasBaseTimetable ? (
          <CXState
            icon="calendar-clear-outline"
            title="No timetable yet"
            message="Add classes manually or import your college timetable."
            action={(
              <View style={styles.emptyActions}>
                <CXButton label="Add Class" iconLeft="add" onPress={() => navigation.navigate("EditClass", { defaultDay: todayVal, mode: "base" })} />
                <CXButton label="Import Timetable" iconLeft="sparkles-outline" variant="outline" onPress={() => navigation.navigate("TimetableSettings")} />
              </View>
            )}
          />
        ) : (
          <>
            <TimetableGrid
              slots={slots}
              entries={entries}
              currentDay={todayVal}
              onEntryPress={showActions}
              onEmptyCellPress={(day, slot) => {
                navigation.navigate("EditClass", {
                  defaultDay: day,
                  defaultStartTime: slot.start,
                  defaultEndTime: slot.end ?? slot.start,
                  mode: "base"
                });
              }}
            />

            <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.screen }}>
              <CXText variant="bodyStrong" style={{ marginBottom: spacing.lg }}>Today&apos;s Classes</CXText>

              {todayHoliday ? (
                <View style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderSoft, alignItems: "center" }}>
                  <Ionicons name="partly-sunny-outline" size={32} color={colors.primary} style={{ marginBottom: spacing.sm }} />
                  <CXText variant="h3" style={{ marginBottom: 4 }}>It's a Holiday!</CXText>
                  <CXText variant="body" color={colors.textMuted}>{todayHoliday.name}</CXText>
                </View>
              ) : todayTimeline.length === 0 ? (
                <CXText color={colors.textFaint}>No classes today.</CXText>
              ) : (
                <View style={{ gap: spacing.md }}>
                  {todayTimeline.map((item, idx) => {
                    const classColor = getSubjectColor(item.subject);
                    const isCurrent = item.status === "current";
                    const isDone = item.status === "completed";

                    return (
                      <View key={item.id || idx} style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
                        <View style={{ width: 45, paddingTop: 4 }}>
                          <CXText variant="smallStrong" color={isCurrent ? colors.primary : (isDone ? colors.textFaint : colors.ink)}>{item.startTime}</CXText>
                          <CXText variant="caption" color={colors.textFaint}>{item.endTime}</CXText>
                        </View>

                        <View style={{ marginTop: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: isCurrent ? colors.primary : (isDone ? colors.border : classColor.bg) }} />

                        <CXCard style={[{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.lg, borderRadius: 16 },
                        isCurrent && { borderColor: classColor.border, backgroundColor: classColor.bg, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
                        isDone && { opacity: 0.6 }
                        ]}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <CXText variant="caption" color={isCurrent ? classColor.text : colors.textFaint}>
                              {isCurrent ? "NOW" : isDone ? "DONE" : "UPCOMING"}
                            </CXText>
                            {!!item.room && <CXText variant="caption" color={isCurrent ? classColor.text : colors.textFaint}>{item.room}</CXText>}
                          </View>
                          <CXText variant="bodyStrong" color={isCurrent ? classColor.text : colors.ink}>{item.subject}</CXText>
                        </CXCard>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={{ marginTop: spacing.xxl, paddingHorizontal: spacing.screen, alignItems: "flex-end", marginBottom: spacing.xl }}>
              <CXButton label="Add Class" iconLeft="add" onPress={() => navigation.navigate("EditClass", { defaultDay: todayVal, mode: "base" })} fullWidth={false} />
            </View>
          </>
        )}
      </ScrollView>
      <CXActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        title={selectedEntry ? `${selectedEntry.subject}\n${DAYS.find(d => d.value === selectedEntry.day)?.short} • ${formatTime(selectedEntry.startTime)} – ${formatTime(selectedEntry.endTime)}` : undefined}
        actions={actionSheetActions}
      />
      <CXActionSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title="Timetable Options"
        actions={menuActions}
      />
    </CXScreen>
  );
}

export function EditClassScreen({ navigation, route }: StackProps<"EditClass">) {
  const params = route.params ?? {};
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.user?.id);
  const isSpecial = params.mode === "special" || (!params.entryId && Boolean(params.date));
  const baseQuery = useQuery({
    queryKey: ["timetable", userId],
    queryFn: timetableService.getTimetable,
    enabled: Boolean(userId),
  });
  const specialQuery = useActualSchedule(params.date ?? toLocalDateKey());
  const existingBase = baseQuery.data?.find((item) => item.id === params.entryId);
  const existingSpecial = specialQuery.data?.classes.find((item) => item.source === "special" && item.id === params.entryId);
  const existing = isSpecial ? existingSpecial : existingBase;
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [subjectCode, setSubjectCode] = useState(existing?.subjectCode ?? "");
  const [room, setRoom] = useState(existing?.room ?? "");
  const [lecturer, setLecturer] = useState(existing?.lecturer ?? "");
  const [day, setDay] = useState(params.defaultDay ?? (existingBase?.days[0] ?? (new Date().getDay() || 1)));
  const [startTime, setStartTime] = useState(params.defaultStartTime ?? existing?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(params.defaultEndTime ?? existing?.endTime ?? "10:00");
  const [picker, setPicker] = useState<"start" | "end" | null>(null);
  const [saving, setSaving] = useState(false);
  const [scheduleConflict, setScheduleConflict] = useState<any>(null);

  React.useEffect(() => {
    if (!existing) return;
    setSubject(existing.subject);
    setSubjectCode(existing.subjectCode ?? "");
    setRoom(existing.room ?? "");
    setLecturer(existing.lecturer ?? "");
    if (!isSpecial && "days" in existing) setDay(existing.days[0] ?? 1);
    setStartTime(existing.startTime);
    setEndTime(existing.endTime);
  }, [existing, isSpecial]);

  const validate = () => {
    if (!subject.trim()) return "Subject name is required.";
    if (!isSpecial && (day < 1 || day > 6)) return "Select a valid day.";
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return "Choose valid start and end times.";
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) return "End time must be after start time.";
    return null;
  };

  const save = async (conflictAction: "reject" | "replace" = "reject", conflictClassId?: string) => {
    const issue = validate();
    if (issue) return Alert.alert("Check class details", issue);
    const payload = {
      subject: subject.trim(), subjectCode: subjectCode.trim() || undefined,
      room: room.trim() || undefined, lecturer: lecturer.trim() || undefined,
      startTime, endTime, color: "#6338F2",
    };
    try {
      setSaving(true);
      if (isSpecial) {
        if (!params.date) throw new Error("A date is required for a special class.");
        if (params.entryId) await scheduleService.updateSpecialClass(params.entryId, { ...payload, date: params.date } as any);
        else await scheduleService.addSpecialClass({ ...payload, date: params.date } as any);
      } else if (params.entryId) {
        await timetableService.updateEntry(params.entryId, { ...payload, days: [day], repeat: "weekly" });
      } else {
        await timetableService.createEntry({ ...payload, days: [day], repeat: "weekly", conflictAction, conflictClassId });
      }
      await invalidateScheduleData(queryClient);
      navigation.goBack();
    } catch (error: any) {
      if (error?.response?.status === 409) {
        const conflict = error?.response?.data?.details?.conflict;
        if (conflict) {
          setScheduleConflict(conflict);
        } else {
          Alert.alert("Schedule conflict", error?.response?.data?.message ?? "This class overlaps with another class.");
        }
      } else mutationError(error, "Could not save this class.");
    } finally { setSaving(false); }
  };

  return (
    <CXKeyboardScreen contentContainerStyle={styles.formPage}>
      <CXHeader title={params.entryId ? "Edit Class" : isSpecial ? "Add Special Class" : "Add Class"} subtitle={isSpecial ? readableDate(params.date!) : "Every week"} onBack={navigation.goBack} />
      <CXInput label="Subject Name *" value={subject} onChangeText={setSubject} placeholder="Machine Learning" />
      <CXInput label="Subject Code" value={subjectCode} onChangeText={setSubjectCode} placeholder="CS401" autoCapitalize="characters" />
      {!isSpecial ? (
        <View style={styles.fieldGroup}>
          <CXText variant="smallStrong">Day *</CXText>
          <CXRow style={styles.chipWrap}>{DAYS.map((item) => <CXChip key={item.value} label={item.short} active={day === item.value} onPress={() => setDay(item.value)} />)}</CXRow>
        </View>
      ) : null}
      {!params.entryId || isSpecial ? <CXRow style={styles.timeFields}>
        <View style={styles.flex}><CXInput label="Start Time *" value={formatTime(startTime)} editable={false} onPress={() => setPicker("start")} icon="time-outline" /></View>
        <View style={styles.flex}><CXInput label="End Time *" value={formatTime(endTime)} editable={false} onPress={() => setPicker("end")} icon="time-outline" /></View>
      </CXRow> : <CXCard style={styles.recurrenceCard}><Ionicons name="time-outline" size={20} color={colors.primary} /><View style={styles.flex}><CXText variant="smallStrong">{formatTime(startTime)} – {formatTime(endTime)}</CXText><CXText variant="caption" color={colors.textMuted}>Use Move Class to change the permanent schedule.</CXText></View><CXButton label="Move Class" size="sm" fullWidth={false} variant="outline" onPress={() => navigation.navigate("MoveClass", { classId: params.entryId!, date: params.date ?? dateForWeekday(day), mode: isSpecial ? "occurrence" : "base" })} /></CXCard>}
      {picker ? (
        <DateTimePicker
          value={timeDate(picker === "start" ? startTime : endTime)}
          mode="time"
          is24Hour={false}
          onChange={(_event, value) => {
            setPicker(null);
            if (!value) return;
            if (picker === "start") setStartTime(timeKey(value)); else setEndTime(timeKey(value));
          }}
        />
      ) : null}
      <CXInput label="Room / Location" value={room} onChangeText={setRoom} placeholder="Room 402" />
      <CXInput label="Faculty Name" value={lecturer} onChangeText={setLecturer} placeholder="Prof. Ravi" />
      <CXCard style={styles.recurrenceCard}>
        <Ionicons name={isSpecial ? "calendar-outline" : "repeat-outline"} size={20} color={colors.primary} />
        <View style={styles.flex}><CXText variant="smallStrong">{isSpecial ? "One specific date" : "Every week"}</CXText><CXText variant="caption" color={colors.textMuted}>{isSpecial ? "This applies only to the selected date." : "This saves to your weekly timetable."}</CXText></View>
      </CXCard>
      <CXButton label={params.entryId ? "Save Changes" : "Add Class"} loading={saving} onPress={() => void save()} />
      <CXButton label="Cancel" variant="ghost" onPress={navigation.goBack} />

      <CXActionSheet
        visible={Boolean(scheduleConflict)}
        onClose={() => setScheduleConflict(null)}
        title="Schedule Conflict"
        actions={[
          {
            label: "Choose Another Time",
            icon: "time-outline",
            onPress: () => setScheduleConflict(null)
          },
          {
            label: `Move ${scheduleConflict?.subject}`,
            icon: "swap-horizontal",
            onPress: () => {
              const conflict = scheduleConflict;
              setScheduleConflict(null);
              navigation.navigate("MoveClass", { classId: conflict.id, date: dateForWeekday(day), mode: isSpecial ? "occurrence" : "base" });
            }
          },
          ...(!params.entryId ? [{
            label: `Replace ${scheduleConflict?.subject}`,
            icon: "trash",
            destructive: true,
            confirmationTitle: "Replace existing class?",
            confirmationMessage: `${scheduleConflict?.subject} will be replaced.`,
            confirmationButtonText: "Replace",
            onPress: () => {
              const conflict = scheduleConflict;
              setScheduleConflict(null);
              void save("replace", conflict.id);
            }
          } as CXAction] : [])
        ]}
      />
    </CXKeyboardScreen>
  );
}

export function MoveClassScreen({ navigation, route }: StackProps<"MoveClass">) {
  const { classId, date, mode } = route.params;
  const userId = useAppStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const scheduleQuery = useActualSchedule(date);
  const baseQuery = useQuery({ queryKey: ["timetable", userId], queryFn: timetableService.getTimetable, enabled: Boolean(userId) });
  const settingsQuery = useQuery({ queryKey: ["timetableSettings", userId], queryFn: timetableService.getSettings, enabled: Boolean(userId) });

  const item = mode === "occurrence"
    ? scheduleQuery.data?.classes.find((entry) => entry.baseClassId === classId || entry.id === classId)
    : baseQuery.data?.find((entry) => entry.id === classId);

  const itemDay = (item as any)?.day ?? (item as any)?.days?.[0] ?? 1;
  const [newDay, setNewDay] = useState(itemDay);
  const [newDate, setNewDate] = useState(date);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [scheduleConflict, setScheduleConflict] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  let slots = settingsQuery.data?.gridTimeSlots ?? [];
  if (!slots.length && baseQuery.data) {
    slots = deriveTimeSlots(baseQuery.data as any);
  }
  const availableSlots = slots.filter((s: TimeSlot) => !s.break && !s.label.toLowerCase().includes("break") && !s.label.toLowerCase().includes("lunch"));

  let requiredPeriods = 1;
  if (item?.startTime && item?.endTime && availableSlots.length > 0) {
    const durationMins = timeToMinutes(item.endTime) - timeToMinutes(item.startTime);
    const slotDurationMins = timeToMinutes(availableSlots[0]!.end ?? "") - timeToMinutes(availableSlots[0]!.start ?? "");
    if (slotDurationMins > 0) {
      requiredPeriods = Math.max(1, Math.round(durationMins / slotDurationMins));
    }
  }

  const validBlocks: { id: string; start: string; end: string; label: string; }[] = [];
  for (let i = 0; i <= availableSlots.length - requiredPeriods; i++) {
    const startSlot = availableSlots[i]!;
    const endSlot = availableSlots[i + requiredPeriods - 1]!;
    const originalStartIndex = slots.findIndex((s: TimeSlot) => s.id === startSlot.id);
    const originalEndIndex = slots.findIndex((s: TimeSlot) => s.id === endSlot.id);

    if (originalEndIndex - originalStartIndex === requiredPeriods - 1) {
      validBlocks.push({
        id: `${startSlot.start}-${endSlot.end}`,
        start: startSlot.start,
        end: endSlot.end ?? startSlot.end ?? "",
        label: `${formatTime(startSlot.start)} - ${formatTime(endSlot.end ?? startSlot.end ?? "")}`
      });
    }
  }

  const apply = async (conflictAction: ConflictAction = "reject", conflictClassId?: string) => {
    if (!selectedSlot) return Alert.alert("Missing slot", "Please select a time slot.");
    const [startTime, endTime] = selectedSlot.split("-");
    if (!startTime || !endTime) return;
    try {
      setSaving(true);
      await scheduleService.reschedule(classId, {
        scope: mode === "occurrence" ? "one_date" : "all",
        date: mode === "occurrence" ? newDate : date,
        newDay: mode === "occurrence" ? undefined : newDay,
        newStartTime: startTime,
        newEndTime: endTime,
        conflictAction,
        conflictClassId
      });
      await invalidateScheduleData(queryClient);
      navigation.popTo("Timetable");
    } catch (error: any) {
      const conflict = error?.response?.data?.details?.conflict;
      if (error?.response?.data?.code === "SCHEDULE_CONFLICT" && conflict) {
        setScheduleConflict(conflict);
      } else mutationError(error, "Could not move this class.");
    } finally { setSaving(false); }
  };

  return (
    <CXScreen>
      <CXHeader title="Move Class" subtitle={item?.subject ?? "Select new time"} onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.formPage}>
        <CXCard style={styles.originalCard}>
          <CXRow style={{ alignItems: "center", gap: spacing.md }}>
            <Ionicons name="calendar" size={24} color={colors.primary} />
            <View style={styles.flex}>
              <CXText variant="smallStrong" color={colors.primary}>Currently Scheduled</CXText>
              <CXText variant="bodyStrong">
                {item ? `${DAYS.find(d => d.value === itemDay)?.short} • ${formatTime(item.startTime)} – ${formatTime(item.endTime)}` : "Loading..."}
              </CXText>
            </View>
          </CXRow>
        </CXCard>

        {mode === "base" ? (
          <View style={styles.fieldGroup}>
            <CXText variant="smallStrong">Move to Day</CXText>
            <CXRow style={styles.chipWrap}>
              {DAYS.map((day) => (
                <CXChip key={day.value} label={day.short} active={newDay === day.value} onPress={() => setNewDay(day.value)} />
              ))}
            </CXRow>
          </View>
        ) : (
          <View style={styles.fieldGroup}>
            <CXText variant="smallStrong">Move to Date (Occurrence)</CXText>
            <CXText color={colors.textMuted}>{readableDate(newDate)}</CXText>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <CXText variant="smallStrong">Available Periods {requiredPeriods > 1 ? `(${requiredPeriods} consecutive)` : ""}</CXText>
          <View style={styles.slotList}>
            {validBlocks.length === 0 ? (
              <CXText color={colors.textMuted}>No suitable periods available on this day.</CXText>
            ) : validBlocks.map(block => (
              <Pressable
                key={block.id}
                onPress={() => setSelectedSlot(block.id)}
                style={[styles.slotItem, selectedSlot === block.id && styles.slotItemSelected]}
              >
                <CXRow style={{ gap: spacing.sm, flex: 0 }}>
                  <Ionicons name="time-outline" size={20} color={selectedSlot === block.id ? colors.primary : colors.textMuted} />
                  <CXText variant={selectedSlot === block.id ? "bodyStrong" : "body"} color={selectedSlot === block.id ? colors.primary : colors.ink}>
                    {block.label}
                  </CXText>
                </CXRow>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selectedSlot === block.id ? colors.primary : colors.border, alignItems: "center", justifyContent: "center" }}>
                  {selectedSlot === block.id && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />}
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <CXButton label="Move Class" loading={saving} disabled={!selectedSlot} onPress={() => void apply()} />
      </ScrollView>

      <CXActionSheet
        visible={Boolean(scheduleConflict)}
        onClose={() => setScheduleConflict(null)}
        title="Schedule Conflict"
        actions={[
          {
            label: "Choose Another Time",
            icon: "time-outline",
            onPress: () => setScheduleConflict(null)
          },
          {
            label: `Swap with ${scheduleConflict?.subject}`,
            icon: "swap-horizontal",
            onPress: () => {
              const conflict = scheduleConflict;
              setScheduleConflict(null);
              void apply("swap", conflict.baseClassId ?? conflict.id);
            }
          },
          {
            label: `Replace ${scheduleConflict?.subject}`,
            icon: "trash",
            destructive: true,
            confirmationTitle: "Replace existing class?",
            confirmationMessage: `${scheduleConflict?.subject} will be replaced.`,
            confirmationButtonText: "Replace",
            onPress: () => {
              const conflict = scheduleConflict;
              setScheduleConflict(null);
              void apply("replace", conflict.baseClassId ?? conflict.id);
            }
          }
        ]}
      />
    </CXScreen>
  );
}

function monthBounds(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { start: toLocalDateKey(start), end: toLocalDateKey(end) };
}

function calendarCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(start);
    value.setDate(start.getDate() + index);
    return { date: toLocalDateKey(value), day: value.getDate(), currentMonth: value.getMonth() === month.getMonth() };
  });
}

export function CalendarScreen({ navigation }: StackProps<"Calendar">) {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.user?.id);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(toLocalDateKey());
  const [holidayModal, setHolidayModal] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const bounds = monthBounds(month);
  const rangeQuery = useQuery({
    queryKey: scheduleQueryKeys.range(userId, bounds.start, bounds.end),
    queryFn: () => scheduleService.getScheduleRange(bounds.start, bounds.end),
    enabled: Boolean(userId),
  });
  const selectedBackend = rangeQuery.data?.find((item) => item.date === selectedDate);
  const selectedHoliday = selectedBackend?.holiday ?? getStaticHoliday(selectedDate);
  const cells = calendarCells(month);

  const showMonth = (nextMonth: Date) => {
    const first = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    setMonth(first);
    setSelectedDate(toLocalDateKey(first));
  };

  const saveHoliday = async () => {
    if (!holidayName.trim()) return Alert.alert("Reason required", "Enter a name or reason for the no-class day.");
    try {
      if (editingHolidayId) await scheduleService.updateHoliday(editingHolidayId, { date: selectedDate, name: holidayName.trim() });
      else await scheduleService.addHoliday({ date: selectedDate, name: holidayName.trim() });
      setHolidayModal(false); setHolidayName(""); setEditingHolidayId(null);
      await invalidateScheduleData(queryClient);
    } catch (error) { mutationError(error, "Could not save the no-class day."); }
  };

  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [holidayActionSheetVisible, setHolidayActionSheetVisible] = useState(false);

  const holiday = selectedBackend?.holiday;

  const openHolidayActions = () => {
    if (!holiday?.custom) return;
    setHolidayActionSheetVisible(true);
  };

  const holidayActionSheetActions: CXAction[] = holiday?.custom ? [
    {
      label: "Edit",
      icon: "pencil",
      onPress: () => {
        setHolidayActionSheetVisible(false);
        setHolidayName(holiday.name);
        setEditingHolidayId(holiday.id);
        setHolidayModal(true);
      }
    },
    {
      label: "Remove",
      icon: "trash",
      onPress: async () => {
        setHolidayActionSheetVisible(false);
        try {
          await scheduleService.deleteHoliday(holiday.id);
          await invalidateScheduleData(queryClient);
        } catch (error) {
          mutationError(error, "Could not remove this no-class day.");
        }
      }
    }
  ] : [];

  const actionSheetActions: CXAction[] = selectedEntry ? [
    ...(selectedEntry.source === "special" ? [{
      label: "Edit Class",
      icon: "pencil",
      onPress: () => {
        setActionSheetVisible(false);
        navigation.navigate("EditClass", { entryId: selectedEntry.id, mode: "special", date: selectedDate });
      }
    } as CXAction] : []),
    {
      label: selectedEntry.source === "special" ? "Move Class" : "Move this class",
      icon: "swap-horizontal",
      onPress: () => {
        setActionSheetVisible(false);
        navigation.navigate("MoveClass", { classId: selectedEntry.id, date: selectedDate, mode: "occurrence" });
      }
    },
    {
      label: selectedEntry.source === "special" ? "Delete Class" : "Cancel this class",
      icon: "close-circle-outline",
      destructive: true,
      confirmationTitle: selectedEntry.source === "special" ? `Delete ${selectedEntry.subject}?` : `Cancel ${selectedEntry.subject} for ${readableDate(selectedDate)}?`,
      confirmationMessage: selectedEntry.source === "special" ? "This will remove the special class." : "",
      confirmationButtonText: selectedEntry.source === "special" ? "Delete" : "Cancel Class",
      onPress: async () => {
        try {
          if (selectedEntry.source === "special") {
            await scheduleService.deleteSpecialClass(selectedEntry.id!);
          } else {
            await scheduleService.cancelOccurrence(selectedEntry.id!, { date: selectedDate, scope: "one_date" });
          }
          await invalidateScheduleData(queryClient);
        } catch (error) { mutationError(error, "Could not cancel this class."); }
      }
    }
  ] : [];

  return (
    <CXScreen>
      <ScrollView contentContainerStyle={styles.calendarPage}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl, marginTop: spacing.md }}>
          <CXText variant="h3" style={{ fontSize: 24, letterSpacing: -0.5 }}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</CXText>
          <View style={{ flexDirection: "row", gap: spacing.xl }}>
            <Pressable onPress={() => showMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </Pressable>
            <Pressable onPress={() => showMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
              <Ionicons name="chevron-forward" size={24} color={colors.primary} />
            </Pressable>
            <Pressable onPress={navigation.goBack}>
              <Ionicons name="close" size={26} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.weekHeader}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
            <CXText key={i} variant="smallStrong" align="center" color={(i === 0) ? colors.danger : colors.textMuted} style={styles.calendarCell}>
              {day}
            </CXText>
          ))}
        </View>

        <View style={styles.monthGrid}>
          {cells.map((cell) => {
            const schedule = rangeQuery.data?.find((item) => item.date === cell.date);
            const staticHoliday = getStaticHoliday(cell.date);
            const holiday = schedule?.holiday ?? staticHoliday;
            const selectedCell = cell.date === selectedDate;
            const isRed = holiday;

            return (
              <Pressable key={cell.date} onPress={() => { setSelectedDate(cell.date); if (!cell.currentMonth) setMonth(new Date(`${cell.date}T12:00:00`)); }} style={[styles.calendarCell, styles.dateCell, selectedCell && styles.dateCellSelected]}>
                <CXText variant={selectedCell ? "smallStrong" : "body"} color={selectedCell ? colors.white : (isRed ? colors.danger : (cell.currentMonth ? colors.ink : colors.textFaint))}>{cell.day}</CXText>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.xl, marginTop: spacing.lg, marginBottom: spacing.xl }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger }} />
            <CXText variant="caption" color={colors.ink}>Holiday / Sunday</CXText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
            <CXText variant="caption" color={colors.ink}>Selected / Today</CXText>
          </View>
        </View>
        <CXCard style={styles.agendaCard}>
          <CXRow><View style={styles.flex}><CXText variant="title">{readableDate(selectedDate)}</CXText><CXText variant="caption" color={colors.textMuted}>{selectedHoliday ? "No classes today" : `${selectedBackend?.classes.length ?? 0} ${(selectedBackend?.classes.length ?? 0) === 1 ? "Class" : "Classes"}`}</CXText></View><CXButton label="Special Class" size="sm" fullWidth={false} variant="outline" disabled={Boolean(selectedHoliday)} onPress={() => navigation.navigate("EditClass", { mode: "special", date: selectedDate })} /></CXRow>
          {selectedHoliday ? (
            <Pressable onPress={openHolidayActions} style={styles.holidayRow}><Ionicons name="sunny-outline" size={22} color={colors.danger} /><View style={styles.flex}><CXText variant="bodyStrong">{selectedHoliday.name}</CXText><CXText variant="caption" color={colors.textMuted}>Holiday · No classes today{selectedHoliday.custom ? " · Tap to edit" : ""}</CXText></View></Pressable>
          ) : selectedBackend?.classes.length ? (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              {selectedBackend.classes.map((item, idx) => {
                const classColor = getSubjectColor(item.subject);
                const isSelectedDateToday = selectedDate === toLocalDateKey();

                const now = new Date();
                const currentMins = now.getHours() * 60 + now.getMinutes();
                const sMins = timeToMinutes(item.startTime);
                const eMins = timeToMinutes(item.endTime);

                let isCurrent = false;
                let isDone = false;

                if (isSelectedDateToday) {
                  if (currentMins >= eMins) isDone = true;
                  else if (currentMins >= sMins && currentMins < eMins) isCurrent = true;
                } else if (new Date(`${selectedDate}T12:00:00`) < new Date()) {
                  isDone = true;
                }

                return (
                  <Pressable key={`${item.source}-${item.id}`} onPress={() => { setSelectedEntry(item); setActionSheetVisible(true); }}>
                    <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
                      <View style={{ width: 45, paddingTop: 4 }}>
                        <CXText variant="smallStrong" color={isCurrent ? colors.primary : (isDone ? colors.textFaint : colors.ink)}>{formatTime(item.startTime)}</CXText>
                        <CXText variant="caption" color={colors.textFaint}>{formatTime(item.endTime)}</CXText>
                      </View>

                      <View style={{ marginTop: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: isCurrent ? colors.primary : (isDone ? colors.border : classColor.bg) }} />

                      <CXCard style={[{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.lg, borderRadius: 16 },
                      isCurrent && { borderColor: classColor.border, backgroundColor: classColor.bg, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
                      isDone && { opacity: 0.6 }
                      ]}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <CXText variant="caption" color={isCurrent ? classColor.text : colors.textFaint}>
                            {item.changed ? "CHANGED" : (isCurrent ? "NOW" : isDone ? "DONE" : "UPCOMING")}
                          </CXText>
                          {!!item.room && <CXText variant="caption" color={isCurrent ? classColor.text : colors.textFaint}>{item.room}</CXText>}
                        </View>
                        <CXText variant="bodyStrong" color={isCurrent ? classColor.text : colors.ink}>{item.subject}</CXText>
                      </CXCard>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : <CXText color={colors.textMuted}>No classes scheduled.</CXText>}
        </CXCard>
        {!selectedHoliday ? <CXButton label="Add Holiday / No Class Day" iconLeft="calendar-clear-outline" variant="outline" onPress={() => { setHolidayName(""); setEditingHolidayId(null); setHolidayModal(true); }} /> : null}
      </ScrollView>
      <Modal visible={holidayModal} transparent animationType="fade" onRequestClose={() => setHolidayModal(false)}>
        <View style={styles.modalBackdrop}><CXCard style={styles.modalCard}><CXText variant="h3">{editingHolidayId ? "Edit no-class day" : "Add no-class day"}</CXText><CXText color={colors.textMuted}>{readableDate(selectedDate)}</CXText><CXInput label="Name / Reason" value={holidayName} onChangeText={setHolidayName} placeholder="College holiday" autoFocus /><CXButton label="Save" onPress={() => void saveHoliday()} /><CXButton label="Cancel" variant="ghost" onPress={() => setHolidayModal(false)} /></CXCard></View>
      </Modal>
      <CXActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        title={selectedEntry ? `${selectedEntry.subject}\n${formatTime(selectedEntry.startTime)} - ${formatTime(selectedEntry.endTime)}` : undefined}
        actions={actionSheetActions}
      />
      <CXActionSheet
        visible={holidayActionSheetVisible}
        onClose={() => setHolidayActionSheetVisible(false)}
        title={holiday?.custom ? `${holiday.name}\n${readableDate(selectedDate)}` : undefined}
        actions={holidayActionSheetActions}
      />
    </CXScreen>
  );
}

export function TimetableSettingsScreen({ navigation }: StackProps<"TimetableSettings">) {
  const userId = useAppStore((state) => state.user?.id);
  const settings = useQuery({ queryKey: ["timetableSettings", userId], queryFn: timetableService.getSettings, enabled: Boolean(userId) });
  const [scanning, setScanning] = useState(false);

  const scan = async (uri: string, type: "image" | "camera", mimeType: string) => {
    try {
      setScanning(true);
      let localOcrJson;
      let ocrWords: any[] = [];

      try {
        const ocr = await processTimetableImageLocal(uri);
        ocrWords = ocr.words || [];
        localOcrJson = JSON.stringify(ocr);
      } catch (e) {
        console.warn("Local OCR failed", e);
      }

      try {
        const result = await timetableService.analyzeTimetable(uri, mimeType, type, localOcrJson);
        if (result && result.cloudVisionWords && result.cloudVisionWords.length > 0) {
          ocrWords = [...ocrWords, ...result.cloudVisionWords];
        }
      } catch (e) {
        // Silently ignore Cloud Vision failure as requested. Fallback to local
        console.warn("Cloud vision failed", e);
      }

      const parsed = parseTimetableImage(ocrWords);

      if (!parsed.isTimetable) {
        Alert.alert("Notice", "We couldn't read every part of this timetable. Check the schedule below and fill in anything missing.");
      }

      navigation.navigate("TimetableReview", {
        imageUri: uri,
        entries: parsed.entries,
        gridTimeSlots: parsed.gridTimeSlots.length ? parsed.gridTimeSlots : settings.data?.gridTimeSlots,
        missingCells: parsed.missingCells,
        warnings: parsed.warnings,
        hasExistingTimetable: ((settings.data as any)?.timetableRevision ?? 0) > 0,
      });
    } catch (e: any) {
      Alert.alert("Analysis failed", e.message || "Failed to process timetable.");
    } finally { setScanning(false); }
  };

  const chooseImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission needed", "Allow photo access to choose a timetable image.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 1 });
    if (!result.canceled && result.assets[0]?.uri) await scan(result.assets[0].uri, "image", "image/jpeg");
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission needed", "Allow camera access to photograph your timetable.");
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 1 });
    if (!result.canceled && result.assets[0]?.uri) await scan(result.assets[0].uri, "camera", "image/jpeg");
  };

  return (
    <CXScreen>
      <View style={styles.headerPad}><CXHeader title="Import Timetable" subtitle="Premium Recognition" onBack={navigation.goBack} /></View>
      <ScrollView contentContainerStyle={styles.settingsPage}>
        <CXCard style={styles.scanHero}>
          <View style={{ ...styles.scanIcon, backgroundColor: colors.surface }}>
            <Ionicons name="sparkles" size={28} color={colors.primary} />
          </View>
          <CXText variant="h3" align="center">Smart Timetable Import</CXText>
          <CXText align="center" color={colors.textMuted}>Upload your college timetable. CampusX uses advanced vision to accurately extract classes, labs, and breaks.</CXText>
          <CXRow style={{ gap: spacing.md, marginTop: spacing.md, flexWrap: "wrap", justifyContent: "center" }}>
            <CXButton style={{ flex: 1, minWidth: 140 }} label={scanning ? "Analyzing..." : "Take Photo"} iconLeft="camera-outline" loading={scanning} onPress={() => void takePhoto()} />
            <CXButton style={{ flex: 1, minWidth: 140 }} label="Choose Image" iconLeft="image-outline" variant="outline" disabled={scanning} onPress={() => void chooseImage()} />
          </CXRow>
        </CXCard>
        <CXCard>
          <CXText variant="bodyStrong">What happens next?</CXText>
          {[
            "We reconstruct the grid automatically",
            "All gaps and breaks are preserved",
            "You review and edit before saving",
            "Nothing is saved without your approval"
          ].map((line) => (
            <CXRow key={line} style={styles.checkRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <CXText variant="small" style={styles.flex}>{line}</CXText>
            </CXRow>
          ))}
        </CXCard>
      </ScrollView>
    </CXScreen>
  );
}

type ReviewTab = "original" | "extracted" | "compare";

export function TimetableReviewScreen({ navigation, route }: StackProps<"TimetableReview">) {
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<TimetableGridEntry[]>(route.params.entries.map((e: any) => ({ ...e, id: Math.random().toString() })));

  const [importing, setImporting] = useState(false);

  // OCR Edit Draft state
  const [editDraft, setEditDraft] = useState<TimetableGridEntry | null>(null);

  const slots: TimeSlot[] = route.params.gridTimeSlots ?? [];
  const invalidEntries = entries.filter((entry) => !validateReviewEntry(entry).valid);

  const validEntries = entries.filter((entry) => validateReviewEntry(entry).valid);
  const orphansCount = entries.length - validEntries.length;

  const importNow = async () => {
    if (validEntries.length === 0) {
      return Alert.alert("No valid classes", "There are no valid classes to import.");
    }
    const execute = async () => {
      try {
        setImporting(true);
        const result = await scheduleService.importTimetable({
          mode: "replace",
          gridTimeSlots: slots,
          entries: validEntries.map((entry) => ({
            subject: entry.subject.trim(), subjectCode: (entry as any).subjectCode?.trim() || undefined,
            room: (entry as any).room || undefined, lecturer: (entry as any).lecturer || undefined,
            day: entry.day, startTime: entry.startTime, endTime: entry.endTime, color: "#6338F2",
          })),
        });
        await invalidateScheduleData(queryClient);
        await queryClient.invalidateQueries({ queryKey: ["timetableSettings"] });
        navigation.popTo("Timetable");
      } catch (error: any) {
        mutationError(error, "Could not import the timetable.");
      } finally { setImporting(false); }
    };

    if (route.params.hasExistingTimetable !== false) {
      Alert.alert("Replace current timetable?", "Importing this timetable will replace your existing schedule.", [
        { text: "Cancel", style: "cancel" },
        { text: "Replace & Import", style: "destructive", onPress: () => void execute() },
      ]);
    } else await execute();
  };

  const handleSaveDraft = (draft: TimetableGridEntry) => {
    const normalizedDraft = normalizeTimetableEntries([draft], slots)[0];

    setEntries(curr => {
      const idx = curr.findIndex(e => e.id === draft.id);
      if (idx !== -1) {
        const next = [...curr];
        next[idx] = { ...normalizedDraft, needsReview: false };
        return next;
      } else {
        return [...curr, { ...normalizedDraft, needsReview: false, id: Math.random().toString() }];
      }
    });
    setEditDraft(null);
  };

  const handleDeleteDraft = (id: string) => {
    setEntries(curr => curr.filter(e => e.id !== id));
    setEditDraft(null);
  };

  return (
    <CXScreen>
      <View style={styles.headerPad}>
        <CXHeader title="Review Timetable" subtitle="Check the extracted schedule before importing." onBack={navigation.goBack} />
      </View>
      <ScrollView contentContainerStyle={styles.reviewPage}>
        <CXText variant="h3">Uploaded Timetable</CXText>
        <CXText variant="small" color={colors.textMuted} style={{ marginBottom: -spacing.sm }}>Your original source</CXText>
        <View style={styles.originalImageWrap}>
          <Image source={{ uri: route.params.imageUri }} resizeMode="contain" style={StyleSheet.absoluteFill} />
        </View>

        <CXText variant="h3" style={{ marginTop: spacing.md }}>Extracted Timetable</CXText>
        <TimetableGrid
          isReview
          slots={slots}
          entries={entries.map(e => ({ ...e, needsReview: e.needsReview || !validateReviewEntry(e).valid }))}
          onEntryPress={(entry) => setEditDraft(entry)}
          onEmptyCellPress={(day, slot) => {
            setEditDraft({
              id: Math.random().toString(),
              day,
              startTime: slot.start,
              endTime: slot.end ?? slot.start,
              subject: "",
              needsReview: true
            });
          }}
        />

        <CXCard>
          <CXRow style={styles.summaryCard}>
            <View style={styles.flex}>
              <CXText variant="bodyStrong">{entries.length} classes found</CXText>
              {entries.some(e => e.needsReview) && (
                <CXText variant="small" color={colors.warning}>{entries.filter(e => e.needsReview).length} may need review</CXText>
              )}
            </View>
            <CXButton label="Add Class" size="sm" iconLeft="add" fullWidth={false} onPress={() => setEditDraft({ id: Math.random().toString(), day: 1, startTime: "09:00", endTime: "10:00", subject: "", needsReview: false })} />
          </CXRow>
        </CXCard>

        {route.params.warnings?.map((warning: string) => <CXText key={warning} variant="caption" color={colors.warning}>⚠ {warning}</CXText>)}
        {orphansCount > 0 && <CXText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>{orphansCount} unreadable items will be excluded.</CXText>}



        <CXButton
          label="Import Timetable"
          disabled={validEntries.length === 0}
          loading={importing}
          onPress={() => void importNow()}
        />
      </ScrollView>

      <Modal visible={Boolean(editDraft)} transparent animationType="fade" onRequestClose={() => setEditDraft(null)}>
        <View style={styles.modalBackdrop}>
          <CXCard style={styles.modalCard}>
            <CXText variant="h3">{entries.find(e => e.id === editDraft?.id) ? "Edit OCR Draft Class" : "Add to Review"}</CXText>
            {editDraft ? <>
              <CXInput label="Subject Name *" value={editDraft.subject} onChangeText={(t) => setEditDraft({ ...editDraft, subject: t })} />
              <CXRow style={styles.timeFields}>
                <View style={styles.flex}><CXInput label="Start (HH:MM)" value={editDraft.startTime} onChangeText={(t) => setEditDraft({ ...editDraft, startTime: t })} /></View>
                <View style={styles.flex}><CXInput label="End (HH:MM)" value={editDraft.endTime} onChangeText={(t) => setEditDraft({ ...editDraft, endTime: t })} /></View>
              </CXRow>
              <CXRow style={styles.chipWrap}>
                {DAYS.map((day) => <CXChip key={day.value} label={day.short} active={editDraft.day === day.value} onPress={() => setEditDraft({ ...editDraft, day: day.value })} />)}
              </CXRow>

              {!validateReviewEntry(editDraft as any).valid ? (
                <CXText variant="caption" color={colors.warning}>{validateReviewEntry(editDraft as any).errors.join(" · ")}</CXText>
              ) : null}

              <CXRow style={{ gap: 8, marginTop: 16 }}>
                <View style={styles.flex}><CXButton label="Save" onPress={() => {
                  if (validateReviewEntry(editDraft as any).valid) {
                    handleSaveDraft(editDraft);
                  } else {
                    Alert.alert("Invalid Data", validateReviewEntry(editDraft as any).errors.join("\n"));
                  }
                }} /></View>
                <View style={styles.flex}><CXButton label="Cancel" variant="outline" onPress={() => setEditDraft(null)} /></View>
              </CXRow>
              {entries.find(e => e.id === editDraft.id) ? (
                <CXButton label="Delete" variant="ghost" onPress={() => handleDeleteDraft(editDraft.id!)} />
              ) : null}
            </> : null}
          </CXCard>
        </View>
      </Modal>
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.72 },
  headerPad: { paddingHorizontal: spacing.screen },
  headerActions: { gap: spacing.xxs },
  dayTabs: { flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.screen, paddingVertical: spacing.sm },
  dayTab: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  dayTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  timelineContent: { padding: spacing.screen, paddingBottom: spacing.xxxl, flexGrow: 1 },
  dateRow: { marginBottom: spacing.lg, gap: spacing.sm },
  emptyActions: { width: "100%", gap: spacing.sm, marginTop: spacing.sm },
  timeline: { gap: spacing.xs },
  timelineRow: { alignItems: "stretch" },
  timeRail: { width: 82, alignItems: "flex-start", paddingTop: spacing.md, position: "relative" },
  timelineDot: { position: "absolute", right: 2, top: 23, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  timelineDotCurrent: { backgroundColor: colors.primary, transform: [{ scale: 1.25 }] },
  timelineLine: { position: "absolute", right: 6, top: 33, bottom: -8, width: 2, backgroundColor: colors.borderSoft },
  classCard: { flex: 1, marginLeft: spacing.sm, marginBottom: spacing.sm, gap: 3 },
  classCardPast: { opacity: 0.58 },
  classCardCurrent: { borderColor: colors.primary, backgroundColor: colors.backgroundLavender },
  classTitleRow: { gap: spacing.xs, alignItems: "flex-start" },
  changedBadge: { borderRadius: radius.pill, backgroundColor: colors.primaryTint, paddingHorizontal: spacing.xs, paddingVertical: 3 },
  specialBadge: { borderRadius: radius.pill, backgroundColor: colors.infoTint, paddingHorizontal: spacing.xs, paddingVertical: 3 },
  formPage: { gap: spacing.md, paddingHorizontal: spacing.screen },
  fieldGroup: { gap: spacing.sm },
  chipWrap: { gap: spacing.xs, flexWrap: "wrap" },
  timeFields: { gap: spacing.sm, alignItems: "flex-start" },
  recurrenceCard: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: colors.backgroundLavender },
  originalCard: { gap: spacing.xs, backgroundColor: colors.primaryTint, borderColor: "rgba(99, 102, 241, 0.2)", borderWidth: 1 },
  slotList: { gap: spacing.sm },
  slotItem: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  slotItemSelected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  calendarPage: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxxl },
  weekHeader: { flexDirection: "row", marginBottom: spacing.md },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", paddingBottom: spacing.sm },
  calendarCell: { width: "14.2857%" },
  dateCell: { aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dateCellSelected: { backgroundColor: colors.primary, borderRadius: 100 },
  calendarDot: { width: 4, height: 4, borderRadius: 2 },
  agendaCard: { gap: spacing.md },
  agendaRow: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft },
  agendaTime: { width: 72 },
  holidayRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.warningTint },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.overlay },
  modalCard: { gap: spacing.md },
  settingsPage: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxxl },
  scanHero: { gap: spacing.md, alignItems: "stretch", padding: spacing.lg },
  scanIcon: { alignSelf: "center", width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryTint },
  checkRow: { gap: spacing.xs, marginTop: spacing.sm },
  reviewTabs: { flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.screen, paddingVertical: spacing.sm },
  reviewPage: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxxl },
  summaryCard: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap", alignItems: "center" },
  originalImageWrap: { width: "100%", height: 220, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface, position: "relative" },
  compareImage: { height: 260 },
  sourceHighlight: { position: "absolute", borderWidth: 3, borderColor: colors.warning, backgroundColor: "rgba(245, 158, 11, 0.22)", borderRadius: 4 },
  issueCard: { gap: spacing.sm, borderColor: colors.warning, backgroundColor: colors.warningTint },
  issueActions: { gap: spacing.sm },
  importMode: { gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
});
