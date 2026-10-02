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

  const showActions = (item: TimetableGridEntry) => {
    if (!item.id) return;
    const actions: any[] = [
      {
        text: "Edit Class",
        onPress: () => navigation.navigate("EditClass", { entryId: item.id, mode: "base", date: dateForWeekday(item.day) }),
      },
      {
        text: "Reschedule",
        onPress: () => navigation.navigate("RescheduleClass", { classId: item.id!, date: dateForWeekday(item.day) }),
      },
      {
        text: "Cancel Class",
        style: "destructive",
        onPress: () => {
          const cancel = async (scope: "one_date" | "future") => {
            try {
              await scheduleService.cancelOccurrence(item.id!, { date: dateForWeekday(item.day), scope });
              await invalidateScheduleData(queryClient);
            } catch (error) { mutationError(error, "Could not cancel this class."); }
          };
          Alert.alert("Cancel class", "Apply this cancellation to:", [
            { text: "Keep Class", style: "cancel" },
            { text: "Only This Date", onPress: () => void cancel("one_date") },
            { text: "This & Future", style: "destructive", onPress: () => void cancel("future") },
          ]);
        },
      },
      {
        text: "Delete Class",
        style: "destructive",
        onPress: () => Alert.alert(
          "Delete this class?",
          "This removes the recurring class from your timetable.",
          [
            { text: "Keep Class", style: "cancel" },
            {
              text: "Delete", style: "destructive", onPress: async () => {
                try { await removeBase(item.id!); }
                catch (error) { mutationError(error, "Could not delete the class."); }
              },
            },
          ],
        ),
      },
      { text: "Close", style: "cancel" }
    ];
    Alert.alert(item.subject, `${formatTime(item.startTime)} – ${formatTime(item.endTime)}`, actions);
  };

  const hasBaseTimetable = (baseQuery.data?.length ?? 0) > 0;
  
  let slots = settingsQuery.data?.gridTimeSlots ?? [];
  if (!slots.length && baseQuery.data) {
    slots = deriveTimeSlots(baseQuery.data as any);
  }

  const entries: TimetableGridEntry[] = (baseQuery.data ?? []).map(cls => {
    const sIdx = slots.findIndex((s) => timeToMinutes(s.start) <= timeToMinutes(cls.startTime) && timeToMinutes(s.end ?? "") > timeToMinutes(cls.startTime));
    const eIdx = slots.findIndex((s) => timeToMinutes(s.start) < timeToMinutes(cls.endTime) && timeToMinutes(s.end ?? "") >= timeToMinutes(cls.endTime));
    return {
      id: cls.id,
      day: cls.days[0] ?? 1,
      subject: cls.subject,
      startTime: cls.startTime,
      endTime: cls.endTime,
      columnStartIndex: sIdx === -1 ? slots.findIndex(s => s.start === cls.startTime) : sIdx,
      columnEndIndex: eIdx === -1 ? slots.findIndex(s => s.start === cls.startTime) : eIdx,
    };
  });

  return (
    <CXScreen>
      <View style={styles.headerPad}>
        <CXHeader
          title="Timetable"
          subtitle="Your weekly schedule"
          onBack={navigation.goBack}
          right={(
            <CXRow style={styles.headerActions}>
              <CXIconButton icon="calendar-outline" label="Academic Calendar" onPress={() => navigation.navigate("Calendar")} />
              <CXIconButton icon="settings-outline" label="Timetable settings" onPress={() => navigation.navigate("TimetableSettings")} />
            </CXRow>
          )}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.timelineContent}
        refreshControl={<RefreshControl refreshing={baseQuery.isRefetching || settingsQuery.isRefetching} onRefresh={() => void refresh()} />}
      >
        <CXRow style={styles.dateRow}>
          <View style={styles.flex}>
            <CXText variant="title">Weekly Schedule</CXText>
          </View>
          <CXButton label="Add Class" iconLeft="add" fullWidth={false} size="sm" onPress={() => navigation.navigate("EditClass", { defaultDay: todayVal, mode: "base" })} />
          <CXButton label="Import" iconLeft="download-outline" variant="outline" fullWidth={false} size="sm" onPress={() => navigation.navigate("TimetableSettings")} />
        </CXRow>

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
          <TimetableGrid 
            slots={slots} 
            entries={entries} 
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
        )}
      </ScrollView>
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
        Alert.alert(
          "Schedule conflict",
          error?.response?.data?.message ?? "This class overlaps with another class.",
          conflict ? [
            { text: "Choose Another Time", style: "cancel" },
            { text: `Move ${conflict.subject}`, onPress: () => navigation.navigate("RescheduleClass", { classId: conflict.id, date: dateForWeekday(day) }) },
            ...(!params.entryId ? [{ text: `Replace ${conflict.subject}`, style: "destructive" as const, onPress: () => Alert.alert("Replace existing class?", `${conflict.subject} will be removed from the recurring timetable.`, [
              { text: "Keep Existing", style: "cancel" },
              { text: "Replace", style: "destructive", onPress: () => void save("replace", conflict.id) },
            ]) }] : []),
          ] : [{ text: "Choose Another Time", style: "cancel" }],
        );
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
      </CXRow> : <CXCard style={styles.recurrenceCard}><Ionicons name="time-outline" size={20} color={colors.primary} /><View style={styles.flex}><CXText variant="smallStrong">{formatTime(startTime)} – {formatTime(endTime)}</CXText><CXText variant="caption" color={colors.textMuted}>Use Reschedule to change timing and choose its effective range.</CXText></View><CXButton label="Reschedule" size="sm" fullWidth={false} variant="outline" onPress={() => navigation.navigate("RescheduleClass", { classId: params.entryId!, date: params.date ?? dateForWeekday(day) })} /></CXCard>}
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
        <View style={styles.flex}><CXText variant="smallStrong">{isSpecial ? "One specific date" : "Every week"}</CXText><CXText variant="caption" color={colors.textMuted}>{isSpecial ? "This will not change your weekly timetable." : "Use Reschedule for temporary or future changes."}</CXText></View>
      </CXCard>
      <CXButton label={params.entryId ? "Save Changes" : "Add Class"} loading={saving} onPress={() => void save()} />
      <CXButton label="Cancel" variant="ghost" onPress={navigation.goBack} />
    </CXKeyboardScreen>
  );
}

export function RescheduleClassScreen({ navigation, route }: StackProps<"RescheduleClass">) {
  const { classId, date } = route.params;
  const queryClient = useQueryClient();
  const scheduleQuery = useActualSchedule(date);
  const item = scheduleQuery.data?.classes.find((entry) => entry.baseClassId === classId || entry.id === classId);
  const [startTime, setStartTime] = useState(item?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(item?.endTime ?? "10:00");
  const [scope, setScope] = useState<ChangeScope>("one_date");
  const [newDay, setNewDay] = useState(item?.day ?? 1);
  const [picker, setPicker] = useState<"start" | "end" | null>(null);
  const [scheduleConflict, setScheduleConflict] = useState<any>(null);
  const [moveConflict, setMoveConflict] = useState<any>(null);
  const [moveStart, setMoveStart] = useState("08:00");
  const [moveEnd, setMoveEnd] = useState("09:00");
  const [movePicker, setMovePicker] = useState<"start" | "end" | null>(null);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!item) return;
    setStartTime(item.startTime);
    setEndTime(item.endTime);
    setNewDay(item.day);
  }, [item]);

  const apply = async (
    conflictAction: ConflictAction = "reject",
    conflictClassId?: string,
    moveExistingTo?: { startTime: string; endTime: string },
  ) => {
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) return Alert.alert("Invalid time", "End time must be after start time.");
    try {
      setSaving(true);
      await scheduleService.reschedule(classId, { scope, date, newDay: scope === "one_date" ? undefined : newDay, newStartTime: startTime, newEndTime: endTime, conflictAction, conflictClassId, moveExistingTo });
      await invalidateScheduleData(queryClient);
      navigation.popTo("Timetable");
    } catch (error: any) {
      const conflict = error?.response?.data?.details?.conflict;
      if (error?.response?.data?.code === "SCHEDULE_CONFLICT" && conflict) {
        setScheduleConflict(conflict);
      } else mutationError(error, "Could not reschedule this class.");
    } finally { setSaving(false); }
  };

  return (
    <CXKeyboardScreen contentContainerStyle={styles.formPage}>
      <CXHeader title="Reschedule" subtitle={item?.subject ?? "Class schedule"} onBack={navigation.goBack} />
      <CXCard style={styles.originalCard}>
        <CXText variant="smallStrong">Originally</CXText>
        <CXText>{item?.original ? `${formatTime(item.original.startTime)} – ${formatTime(item.original.endTime)}` : `${formatTime(item?.startTime ?? startTime)} – ${formatTime(item?.endTime ?? endTime)}`}</CXText>
        <CXText variant="caption" color={colors.textMuted}>{readableDate(date)}</CXText>
      </CXCard>
      <CXRow style={styles.timeFields}>
        <View style={styles.flex}><CXInput label="New Start" value={formatTime(startTime)} editable={false} onPress={() => setPicker("start")} /></View>
        <View style={styles.flex}><CXInput label="New End" value={formatTime(endTime)} editable={false} onPress={() => setPicker("end")} /></View>
      </CXRow>
      {picker ? <DateTimePicker value={timeDate(picker === "start" ? startTime : endTime)} mode="time" onChange={(_event, value) => { setPicker(null); if (!value) return; if (picker === "start") setStartTime(timeKey(value)); else setEndTime(timeKey(value)); }} /> : null}
      <View style={styles.fieldGroup}>
        <CXText variant="smallStrong">Apply this change to</CXText>
        <CXChip label="Only this date" active={scope === "one_date"} onPress={() => setScope("one_date")} />
        <CXChip label="This date and future weeks" active={scope === "future"} onPress={() => setScope("future")} />
        <CXChip label="Every occurrence" active={scope === "all"} onPress={() => setScope("all")} />
      </View>
      {scope !== "one_date" ? <View style={styles.fieldGroup}><CXText variant="smallStrong">Day from this change onward</CXText><CXRow style={styles.chipWrap}>{DAYS.map((day) => <CXChip key={day.value} label={day.short} active={newDay === day.value} onPress={() => setNewDay(day.value)} />)}</CXRow></View> : null}
      <CXButton label="Check & Apply Change" loading={saving} onPress={() => void apply()} />
      {item?.changed ? <CXButton label="Restore Original Schedule" variant="outline" onPress={async () => { try { await scheduleService.restoreOriginal(classId, { overrideId: item.overrideId, date }); await invalidateScheduleData(queryClient); navigation.goBack(); } catch (error) { mutationError(error, "Could not restore this class."); } }} /> : null}
      <Modal visible={Boolean(scheduleConflict)} transparent animationType="fade" onRequestClose={() => setScheduleConflict(null)}>
        <View style={styles.modalBackdrop}>
          <CXCard style={styles.modalCard}>
            <CXText variant="h3">Schedule conflict</CXText>
            <CXText color={colors.textMuted}>{item?.subject ?? "This class"} {formatTime(startTime)} – {formatTime(endTime)} overlaps with {scheduleConflict?.subject} {formatTime(scheduleConflict?.startTime ?? "")} – {formatTime(scheduleConflict?.endTime ?? "")}.</CXText>
            <CXButton label="Choose Another Time" variant="outline" onPress={() => setScheduleConflict(null)} />
            <CXButton label="Swap Classes" variant="secondary" onPress={() => { const conflict = scheduleConflict; setScheduleConflict(null); void apply("swap", conflict.baseClassId ?? conflict.id); }} />
            <CXButton label={`Move ${scheduleConflict?.subject ?? "Existing Class"}`} variant="secondary" onPress={() => {
              const conflict = scheduleConflict;
              setScheduleConflict(null);
              if (!conflict.baseClassId) return Alert.alert("Special class", "Edit the special class directly to move it.");
              setMoveConflict(conflict);
              setMoveStart(item?.startTime ?? "08:00");
              setMoveEnd(item?.endTime ?? "09:00");
            }} />
            <CXButton label={`Replace ${scheduleConflict?.subject ?? "Existing Class"}`} variant="danger" onPress={() => {
              const conflict = scheduleConflict;
              setScheduleConflict(null);
              Alert.alert("Replace existing class?", `${conflict.subject} will be cancelled for the selected range.`, [
                { text: "Keep Existing", style: "cancel" },
                { text: "Replace", style: "destructive", onPress: () => void apply("replace", conflict.baseClassId ?? conflict.id) },
              ]);
            }} />
          </CXCard>
        </View>
      </Modal>
      <Modal visible={Boolean(moveConflict)} transparent animationType="fade" onRequestClose={() => setMoveConflict(null)}>
        <View style={styles.modalBackdrop}>
          <CXCard style={styles.modalCard}>
            <CXText variant="h3">Move {moveConflict?.subject}</CXText>
            <CXText color={colors.textMuted}>Choose a free destination for the existing class. Both changes will be saved together.</CXText>
            <CXRow style={styles.timeFields}>
              <View style={styles.flex}><CXInput label="New Start" value={formatTime(moveStart)} editable={false} onPress={() => setMovePicker("start")} /></View>
              <View style={styles.flex}><CXInput label="New End" value={formatTime(moveEnd)} editable={false} onPress={() => setMovePicker("end")} /></View>
            </CXRow>
            {movePicker ? <DateTimePicker value={timeDate(movePicker === "start" ? moveStart : moveEnd)} mode="time" onChange={(_event, value) => { setMovePicker(null); if (!value) return; if (movePicker === "start") setMoveStart(timeKey(value)); else setMoveEnd(timeKey(value)); }} /> : null}
            <CXButton label="Move Existing & Apply" onPress={() => {
              if (timeToMinutes(moveEnd) <= timeToMinutes(moveStart)) return Alert.alert("Invalid time", "End time must be after start time.");
              const conflict = moveConflict;
              setMoveConflict(null);
              void apply("move_existing", conflict.baseClassId, { startTime: moveStart, endTime: moveEnd });
            }} />
            <CXButton label="Choose Another Time" variant="ghost" onPress={() => setMoveConflict(null)} />
          </CXCard>
        </View>
      </Modal>
    </CXKeyboardScreen>
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
  const selected = rangeQuery.data?.find((item) => item.date === selectedDate);
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

  const openHolidayActions = () => {
    const holiday = selected?.holiday;
    if (!holiday?.custom) return;
    Alert.alert(holiday.name, readableDate(selectedDate), [
      { text: "Edit", onPress: () => { setHolidayName(holiday.name); setEditingHolidayId(holiday.id); setHolidayModal(true); } },
      { text: "Remove", style: "destructive", onPress: async () => { try { await scheduleService.deleteHoliday(holiday.id); await invalidateScheduleData(queryClient); } catch (error) { mutationError(error, "Could not remove this no-class day."); } } },
      { text: "Close", style: "cancel" },
    ]);
  };

  return (
    <CXScreen>
      <View style={styles.headerPad}><CXHeader title="Academic Calendar" subtitle="Classes, changes and holidays" onBack={navigation.goBack} /></View>
      <ScrollView contentContainerStyle={styles.calendarPage}>
        <CXRow style={styles.monthHeader}>
          <CXIconButton icon="chevron-back" label="Previous month" onPress={() => showMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
          <CXText variant="title">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</CXText>
          <CXIconButton icon="chevron-forward" label="Next month" onPress={() => showMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
        </CXRow>
        <View style={styles.weekHeader}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <CXText key={day} variant="caption" align="center" color={colors.textMuted} style={styles.calendarCell}>{day}</CXText>)}</View>
        <View style={styles.monthGrid}>
          {cells.map((cell) => {
            const schedule = rangeQuery.data?.find((item) => item.date === cell.date);
            const selectedCell = cell.date === selectedDate;
            return (
              <Pressable key={cell.date} onPress={() => { setSelectedDate(cell.date); if (!cell.currentMonth) setMonth(new Date(`${cell.date}T12:00:00`)); }} style={[styles.calendarCell, styles.dateCell, selectedCell && styles.dateCellSelected]}>
                <CXText variant="smallStrong" color={selectedCell ? colors.white : cell.currentMonth ? colors.ink : colors.textFaint}>{cell.day}</CXText>
                {schedule?.holiday ? <View style={[styles.calendarDot, { backgroundColor: selectedCell ? colors.white : colors.warning }]} /> : schedule?.classes.length ? <View style={[styles.calendarDot, { backgroundColor: selectedCell ? colors.white : colors.primary }]} /> : null}
              </Pressable>
            );
          })}
        </View>
        <CXCard style={styles.agendaCard}>
          <CXRow><View style={styles.flex}><CXText variant="title">{readableDate(selectedDate)}</CXText><CXText variant="caption" color={colors.textMuted}>{selected?.holiday ? "No classes today" : `${selected?.classes.length ?? 0} ${(selected?.classes.length ?? 0) === 1 ? "Class" : "Classes"}`}</CXText></View><CXButton label="Special Class" size="sm" fullWidth={false} variant="outline" disabled={Boolean(selected?.holiday)} onPress={() => navigation.navigate("EditClass", { mode: "special", date: selectedDate })} /></CXRow>
          {selected?.holiday ? (
            <Pressable onPress={openHolidayActions} style={styles.holidayRow}><Ionicons name="sunny-outline" size={22} color={colors.warning} /><View style={styles.flex}><CXText variant="bodyStrong">{selected.holiday.name}</CXText><CXText variant="caption" color={colors.textMuted}>Holiday · No classes today{selected.holiday.custom ? " · Tap to edit" : ""}</CXText></View></Pressable>
          ) : selected?.classes.length ? selected.classes.map((item) => (
            <CXRow key={`${item.source}-${item.id}`} style={styles.agendaRow}><CXText variant="smallStrong" style={styles.agendaTime}>{formatTime(item.startTime)}</CXText><View style={styles.flex}><CXText variant="bodyStrong">{item.subject}</CXText><CXText variant="caption" color={colors.textMuted}>{item.room ?? (item.changed ? "Changed schedule" : "Class")}</CXText></View>{item.changed ? <CXText variant="caption" color={colors.primary}>Changed</CXText> : null}</CXRow>
          )) : <CXText color={colors.textMuted}>No classes scheduled.</CXText>}
        </CXCard>
        {!selected?.holiday ? <CXButton label="Add Holiday / No Class Day" iconLeft="calendar-clear-outline" variant="outline" onPress={() => { setHolidayName(""); setEditingHolidayId(null); setHolidayModal(true); }} /> : null}
      </ScrollView>
      <Modal visible={holidayModal} transparent animationType="fade" onRequestClose={() => setHolidayModal(false)}>
        <View style={styles.modalBackdrop}><CXCard style={styles.modalCard}><CXText variant="h3">{editingHolidayId ? "Edit no-class day" : "Add no-class day"}</CXText><CXText color={colors.textMuted}>{readableDate(selectedDate)}</CXText><CXInput label="Name / Reason" value={holidayName} onChangeText={setHolidayName} placeholder="College holiday" autoFocus /><CXButton label="Save" onPress={() => void saveHoliday()} /><CXButton label="Cancel" variant="ghost" onPress={() => setHolidayModal(false)} /></CXCard></View>
      </Modal>
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
  const [entries, setEntries] = useState<TimetableGridEntry[]>(route.params.entries.map((e: any) => ({...e, id: Math.random().toString()})));

  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [importing, setImporting] = useState(false);
  
  // OCR Edit Draft state
  const [editDraft, setEditDraft] = useState<TimetableGridEntry | null>(null);
  
  const slots: TimeSlot[] = route.params.gridTimeSlots ?? [];
  const invalidEntries = entries.filter((entry) => !validateReviewEntry(entry).valid);

  const verifiedCount = entries.length - invalidEntries.length;

  const importNow = async () => {
    if (invalidEntries.length) {
      return Alert.alert("Review required", `${invalidEntries.length} invalid classes need to be fixed or deleted before importing.`);
    }
    const execute = async () => {
      try {
        setImporting(true);
        const result = await scheduleService.importTimetable({
          mode,
          gridTimeSlots: slots,
          entries: entries.map((entry) => ({
            subject: entry.subject.trim(), subjectCode: (entry as any).subjectCode?.trim() || undefined,
            room: (entry as any).room || undefined, lecturer: (entry as any).lecturer || undefined,
            day: entry.day, startTime: entry.startTime, endTime: entry.endTime, color: "#6338F2",
          })),
        });
        await invalidateScheduleData(queryClient);
        await queryClient.invalidateQueries({ queryKey: ["timetableSettings"] });
        navigation.popTo("Timetable");
      } catch (error: any) {
        if (error?.response?.data?.code === "IMPORT_CONFLICTS") Alert.alert("Import conflicts", error.response.data.message + ". Review the existing timetable or choose Replace.");
        else mutationError(error, "Could not import the timetable.");
      } finally { setImporting(false); }
    };
    if (mode === "replace") {
      Alert.alert("Replace current timetable?", "This replaces recurring base classes. Account data, holidays and special classes are preserved.", [
        { text: "Keep Current", style: "cancel" },
        { text: "Replace", style: "destructive", onPress: () => void execute() },
      ]);
    } else await execute();
  };
  
  const handleSaveDraft = (draft: TimetableGridEntry) => {
    setEntries(curr => {
      const idx = curr.findIndex(e => e.id === draft.id);
      if (idx !== -1) {
        const next = [...curr];
        next[idx] = { ...draft, needsReview: false };
        return next;
      } else {
        return [...curr, { ...draft, needsReview: false, id: Math.random().toString() }];
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
        <CXText variant="smallStrong">Uploaded Timetable</CXText>
        <View style={styles.originalImageWrap}>
          <Image source={{ uri: route.params.imageUri }} resizeMode="contain" style={StyleSheet.absoluteFill} />
        </View>

        <CXText variant="smallStrong">Extracted Timetable</CXText>
        <TimetableGrid 
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

        <CXRow style={styles.summaryCard}>
          <View style={styles.flex}>
            <CXText variant="bodyStrong">{entries.length} classes detected</CXText>
            <CXText variant="small" color={colors.success}>{verifiedCount} verified</CXText>
            <CXText variant="small" color={invalidEntries.length ? colors.warning : colors.success}>{invalidEntries.length ? `${invalidEntries.length} need review` : `All valid`}</CXText>
          </View>
          <CXButton label="Add Missing Class" size="sm" iconLeft="add" fullWidth={false} onPress={() => setEditDraft({ id: Math.random().toString(), day: 1, startTime: "09:00", endTime: "10:00", subject: "", needsReview: true })} />
        </CXRow>
        
        {route.params.warnings?.map((warning: string) => <CXText key={warning} variant="caption" color={colors.warning}>⚠ {warning}</CXText>)}


        
        <CXButton 
          label={invalidEntries.length ? `Fix ${invalidEntries.length} Issues` : `Verify & Import`} 
          disabled={Boolean(invalidEntries.length || !entries.length)} 
          loading={importing} 
          onPress={() => void importNow()} 
        />
      </ScrollView>

      <Modal visible={Boolean(editDraft)} transparent animationType="fade" onRequestClose={() => setEditDraft(null)}>
        <View style={styles.modalBackdrop}>
          <CXCard style={styles.modalCard}>
            <CXText variant="h3">{entries.find(e => e.id === editDraft?.id) ? "Edit OCR Draft Class" : "Add to Review"}</CXText>
            {editDraft ? <>
              <CXInput label="Subject Name *" value={editDraft.subject} onChangeText={(t) => setEditDraft({...editDraft, subject: t})} />
              <CXRow style={styles.timeFields}>
                <View style={styles.flex}><CXInput label="Start (HH:MM)" value={editDraft.startTime} onChangeText={(t) => setEditDraft({...editDraft, startTime: t})} /></View>
                <View style={styles.flex}><CXInput label="End (HH:MM)" value={editDraft.endTime} onChangeText={(t) => setEditDraft({...editDraft, endTime: t})} /></View>
              </CXRow>
              <CXRow style={styles.chipWrap}>
                {DAYS.map((day) => <CXChip key={day.value} label={day.short} active={editDraft.day === day.value} onPress={() => setEditDraft({...editDraft, day: day.value})} />)}
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
  originalCard: { gap: spacing.xs, backgroundColor: colors.backgroundLavender },
  calendarPage: { padding: spacing.screen, gap: spacing.md, paddingBottom: spacing.xxxl },
  monthHeader: { justifyContent: "space-between" },
  weekHeader: { flexDirection: "row" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSoft, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface },
  calendarCell: { width: "14.2857%" },
  dateCell: { aspectRatio: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  dateCellSelected: { backgroundColor: colors.primary, borderRadius: radius.sm },
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
  originalImageWrap: { width: "100%", height: 420, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.ink, position: "relative" },
  compareImage: { height: 260 },
  sourceHighlight: { position: "absolute", borderWidth: 3, borderColor: colors.warning, backgroundColor: "rgba(245, 158, 11, 0.22)", borderRadius: 4 },
  gridDayCell: { width: 58, minHeight: 62, padding: spacing.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, justifyContent: "center" },
  gridCell: { width: 112, minHeight: 62, padding: spacing.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, justifyContent: "center", backgroundColor: colors.surface },
  breakCell: { backgroundColor: colors.warningTint },
  reviewCell: { backgroundColor: colors.warningTint, borderColor: colors.warning },
  issueCard: { gap: spacing.sm, borderColor: colors.warning, backgroundColor: colors.warningTint },
  issueActions: { gap: spacing.sm },
  importMode: { gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
});
