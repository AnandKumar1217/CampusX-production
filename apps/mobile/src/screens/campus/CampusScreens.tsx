import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  Alert,
  Modal,
} from "react-native";
import MapView, { Marker } from "@/components/map/MapView";

import {
  CXAvatar,
  CXButton,
  CXCard,
  CXChip,
  CXHeader,
  CXIconButton,
  CXInput,
  CXKeyboardScreen,
  CXRow,
  CXScreen,
  CXScrollScreen,
  CXSearchBar,
  CXSectionHeader,
  CXText,
} from "@/components/ui";

import { useAppStore } from "@/store/appStore";
import { api, getApiErrorMessage } from "@/services/api";
import { colors, radius, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;


const locationSettings = [
  [
    "Share live location",
    "Share your real-time location with friends.",
    "navigate-outline",
  ],
  [
    "High accuracy mode",
    "Use GPS, Wi-Fi and mobile networks.",
    "locate-outline",
  ],
  [
    "Share with friends only",
    "Only connected friends see your location.",
    "people-outline",
  ],
  [
    "Allow group access",
    "Let groups access your location when active.",
    "people-circle-outline",
  ],
  [
    "Battery saver",
    "Reduce location update frequency.",
    "battery-half-outline",
  ],
] as const;

export function LocationSettingsScreen({
  navigation,
}: StackProps<"LocationSettings">) {
  const [values, setValues] = useState([true, true, true, false, true]);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/location/settings", {
        enabled: values[0],
        highAccuracy: values[1],
        friendsOnly: values[2],
        groups: values[3],
        batterySaver: values[4],
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <CXScrollScreen>
      <CXHeader title="Location Sharing" onBack={navigation.goBack} />
      <CXCard style={styles.locationHero}>
        <View style={styles.locationHeroIcon}>
          <Ionicons name="location" size={28} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <CXText variant="title">Who can see your location?</CXText>
          <CXText variant="small" color={colors.textMuted}>
            Your location helps friends find you on campus. You remain in
            control.
          </CXText>
        </View>
      </CXCard>
      {locationSettings.map(([title, subtitle, icon], index) => (
        <CXRow key={title} style={styles.settingRow}>
          <View style={styles.settingIcon}>
            <Ionicons name={icon} size={19} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <CXText variant="bodyStrong">{title}</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              {subtitle}
            </CXText>
          </View>
          <Switch
            accessibilityLabel={title}
            value={values[index]}
            onValueChange={(next) =>
              setValues((items) =>
                items.map((item, itemIndex) =>
                  itemIndex === index ? next : item,
                ),
              )
            }
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={colors.white}
          />
        </CXRow>
      ))}
      <CXSectionHeader title="Update frequency" />
      <CXRow style={styles.wrap}>
        {["Every 5 min", "Every 15 min", "Real time"].map((item, index) => (
          <CXChip key={item} label={item} active={index === 1} />
        ))}
      </CXRow>
      <CXCard style={styles.privacy}>
        <Ionicons
          name="shield-checkmark-outline"
          size={24}
          color={colors.primary}
        />
        <View style={styles.flex}>
          <CXText variant="bodyStrong">Your privacy matters</CXText>
          <CXText variant="caption" color={colors.textMuted}>
            Location sharing is encrypted and can be stopped at any time with
            Ghost Mode.
          </CXText>
        </View>
      </CXCard>
      <CXButton
        label="Save Settings"
        loading={saving}
        onPress={() => void save()}
      />
    </CXScrollScreen>
  );
}

export function GhostModeScreen({ navigation }: StackProps<"GhostMode">) {
  const [enabled, setEnabled] = useState(false);
  const [duration, setDuration] = useState("Until I turn it off");
  const [visible, setVisible] = useState("No one");
  const toggle = async (value: boolean) => {
    setEnabled(value);
    try {
      await api.patch("/location/ghost-mode", {
        enabled: value,
        duration,
        visible,
      });
    } catch {
      setEnabled(!value);
    }
  };
  return (
    <CXScrollScreen>
      <CXHeader title="Ghost Mode" onBack={navigation.goBack} />
      <CXCard style={styles.ghostHero}>
        <View style={styles.ghostIcon}>
          <Ionicons
            name="shield-half-outline"
            size={38}
            color={colors.primary}
          />
        </View>
        <View style={styles.flex}>
          <CXText variant="title">Stay Private, Your Way</CXText>
          <CXText variant="small" color={colors.textMuted}>
            Ghost Mode hides your location and online status from others on
            CampusX.
          </CXText>
        </View>
        <Switch value={enabled} onValueChange={(value) => void toggle(value)} />
      </CXCard>
      <CXSectionHeader title="Set duration" />
      <CXRow style={styles.durationRow}>
        {(
          [
            ["1 hour", "time-outline"],
            ["8 hours", "timer-outline"],
            ["24 hours", "calendar-outline"],
            ["Until I turn it off", "infinite-outline"],
          ] as const
        ).map(([label, icon]) => (
          <Pressable
            key={label}
            onPress={() => setDuration(label)}
            style={[
              styles.duration,
              duration === label && styles.durationActive,
            ]}
          >
            <Ionicons
              name={icon}
              size={20}
              color={duration === label ? colors.primary : colors.textMuted}
            />
            <CXText variant="caption" align="center">
              {label}
            </CXText>
          </Pressable>
        ))}
      </CXRow>
      <CXSectionHeader title="Who can see me" />
      {["Visible to everyone", "Friends only", "No one"].map((label) => (
        <Pressable
          key={label}
          onPress={() => setVisible(label)}
          style={styles.radioRow}
        >
          <View style={[styles.radio, visible === label && styles.radioActive]}>
            {visible === label ? <View style={styles.radioDot} /> : null}
          </View>
          <View>
            <CXText variant="bodyStrong">{label}</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              {label === "No one"
                ? "Hide your location from everyone"
                : `Allow ${label.toLowerCase()} to see your location`}
            </CXText>
          </View>
        </Pressable>
      ))}
      <CXCard style={styles.privacy}>
        <Ionicons
          name="information-circle-outline"
          size={22}
          color={colors.primary}
        />
        <CXText variant="small" color={colors.inkSoft} style={styles.flex}>
          When Ghost Mode is active, friends can’t see your live location and
          presence.
        </CXText>
      </CXCard>
    </CXScrollScreen>
  );
}

const isHoliday = (day: number, month: number, year: number) => {
  const d = new Date(year, month, day);
  // Weekends
  if (d.getDay() === 0 || d.getDay() === 6) return true;

  // Major Static Indian/Global Holidays (Month is 0-indexed)
  if (month === 0 && day === 1) return true; // New Year
  if (month === 0 && day === 26) return true; // Republic Day
  if (month === 4 && day === 1) return true; // Labour Day
  if (month === 7 && day === 15) return true; // Independence Day
  if (month === 9 && day === 2) return true; // Gandhi Jayanti
  if (month === 11 && day === 25) return true; // Christmas

  // 2026 Dynamic Indian Festivals (Lunar/Solar mapped)
  if (year === 2026) {
    if (month === 0 && day === 14) return true; // Makar Sankranti
    if (month === 1 && day === 15) return true; // Maha Shivaratri
    if (month === 2 && day === 3) return true; // Holi
    if (month === 2 && day === 20) return true; // Eid al-Fitr
    if (month === 2 && day === 28) return true; // Ram Navami
    if (month === 4 && day === 27) return true; // Eid al-Adha
    if (month === 7 && day === 28) return true; // Raksha Bandhan
    if (month === 8 && day === 4) return true; // Janmashtami
    if (month === 8 && day === 14) return true; // Ganesh Chaturthi
    if (month === 9 && day === 19) return true; // Dussehra
    if (month === 10 && day === 8) return true; // Diwali
  }
  
  return false;
};

const CalendarModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

  const renderDays = () => {
    const blanks = Array(firstDayOfMonth).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    
    return [...blanks, ...days].map((day, idx) => {
      const isDayHoliday = day ? isHoliday(day, month, year) : false;
      const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

      return (
        <View key={idx} style={{ width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' }}>
          {day && (
            <View style={[
              isToday && { backgroundColor: colors.primary, borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }
            ]}>
              <CXText 
                variant="bodyStrong" 
                color={isToday ? colors.white : isDayHoliday ? colors.danger : colors.ink}
              >
                {day}
              </CXText>
            </View>
          )}
        </View>
      );
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, paddingBottom: 40 }}>
          <CXRow style={{ justifyContent: 'space-between', marginBottom: spacing.xl }}>
            <CXText variant="h2">{monthNames[month]} {year}</CXText>
            <CXRow style={{ gap: spacing.md }}>
              <CXIconButton icon="chevron-back" onPress={handlePrevMonth} backgroundColor={colors.backgroundHover} />
              <CXIconButton icon="chevron-forward" onPress={handleNextMonth} backgroundColor={colors.backgroundHover} />
              <CXIconButton icon="close" onPress={onClose} backgroundColor={colors.backgroundHover} />
            </CXRow>
          </CXRow>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
            {weekDays.map((d, i) => (
              <View key={i} style={{ width: '14.28%', alignItems: 'center', paddingBottom: spacing.sm }}>
                <CXText variant="smallStrong" color={i === 0 || i === 6 ? colors.danger : colors.textMuted}>{d}</CXText>
              </View>
            ))}
            {renderDays()}
          </View>
          
          <CXRow style={{ marginTop: spacing.md, justifyContent: 'center', gap: spacing.xl }}>
            <CXRow style={{ gap: spacing.xs }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger }} /><CXText variant="caption">Holiday / Weekend</CXText></CXRow>
            <CXRow style={{ gap: spacing.xs }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /><CXText variant="caption">Today</CXText></CXRow>
          </CXRow>
        </View>
      </View>
    </Modal>
  );
};

export function TimetableScreen({ navigation }: StackProps<"Timetable">) {
  const timetable = useAppStore((state) => state.timetable);
  const gridTimeSlots = useAppStore((state) => state.gridTimeSlots);
  const [currentTimeObj, setCurrentTimeObj] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeObj(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentDay = currentTimeObj.getDay() === 0 ? 7 : currentTimeObj.getDay();
  const classesForToday = timetable.filter((c) => c.day === currentDay);

  const isClassActive = (startTime: string, endTime: string) => {
    const currentHours = currentTimeObj.getHours();
    const currentMinutes = currentTimeObj.getMinutes();
    const currentTime = currentHours * 60 + currentMinutes;

    const parseTime = (timeStr: string) => {
      const match = timeStr.match(/(\d+):(\d+)/);
      if (!match) return 0;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (timeStr.toLowerCase().includes("pm") && h < 12) h += 12;
      if (timeStr.toLowerCase().includes("am") && h === 12) h = 0;
      return h * 60 + m;
    };

    const start = parseTime(startTime);
    const end = parseTime(endTime);
    return currentTime >= start && currentTime <= end;
  };

  const isClassPast = (endTimeStr: string) => {
    const currentTime = currentTimeObj.getHours() * 60 + currentTimeObj.getMinutes();

    const match = endTimeStr.match(/(\d+):(\d+)/);
    if (!match) return false;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (endTimeStr.toLowerCase().includes("pm") && h < 12) h += 12;
    if (endTimeStr.toLowerCase().includes("am") && h === 12) h = 0;
    
    return currentTime > (h * 60 + m);
  };

  const gridWeekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <CXScreen>
      <CXHeader
        title="Timetable"
        onBack={navigation.goBack}
        right={
          <CXRow>
            <CXIconButton
              icon="options-outline"
              label="Timetable settings"
              backgroundColor={colors.transparent}
              onPress={() => navigation.navigate("TimetableSettings")}
            />
            <CXIconButton
              icon="calendar-outline"
              label="Calendar"
              backgroundColor={colors.transparent}
              onPress={() => setShowCalendar(true)}
            />
          </CXRow>
        }
      />
      <CalendarModal visible={showCalendar} onClose={() => setShowCalendar(false)} />
      <ScrollView contentContainerStyle={styles.page}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ marginBottom: spacing.xl }}>
              <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: colors.border }}>
                <View style={{ width: 100, padding: spacing.sm, borderRightWidth: 1, borderColor: colors.border, justifyContent: 'center' }}>
                  <CXText variant="smallStrong">Day / Time</CXText>
                </View>
                {gridTimeSlots.map(slot => (
                  <View key={slot.id} style={{ width: 110, padding: spacing.sm, borderRightWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    <CXText variant="caption" align="center">{slot.label}</CXText>
                  </View>
                ))}
              </View>
              {gridWeekDays.map((dayName, dayIndex) => {
                const dayClasses = timetable.filter(c => c.day === dayIndex + 1);
                return (
                  <View key={dayName} style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: colors.border }}>
                    <View style={{ width: 100, padding: spacing.sm, borderRightWidth: 1, borderColor: colors.border, justifyContent: 'center' }}>
                      <CXText variant="smallStrong">{dayName}</CXText>
                    </View>
                    {gridTimeSlots.map(slot => {
                      const slotClass = dayClasses.find(c => c.startTime === slot.start || (c.startTime < slot.start && c.endTime > slot.start));
                      if (slot.break) {
                        return (
                          <View key={slot.id} style={{ width: 110, padding: spacing.sm, borderRightWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundHover, justifyContent: 'center', alignItems: 'center' }}>
                            <CXText variant="caption" color={colors.textMuted}>{slot.label.includes("Lunch") ? "LUNCH" : "BREAK"}</CXText>
                          </View>
                        );
                      }
                      if (slotClass) {
                        return (
                          <Pressable key={slot.id} onPress={() => navigation.navigate("EditClass", { entryId: slotClass.id })} style={{ width: 110, padding: spacing.xs, borderRightWidth: 1, borderColor: colors.border, backgroundColor: slotClass.color + '20', justifyContent: 'center' }}>
                            <CXText variant="smallStrong" color={slotClass.color} numberOfLines={2}>{slotClass.subject}</CXText>
                            <CXText variant="caption" color={colors.textMuted} numberOfLines={1}>{slotClass.room}</CXText>
                          </Pressable>
                        );
                      }
                      return (
                        <Pressable 
                          key={slot.id} 
                          onPress={() => navigation.navigate("EditClass", { defaultDay: dayIndex + 1, defaultStartTime: slot.start })}
                          style={{ width: 110, padding: spacing.sm, borderRightWidth: 1, borderColor: colors.border }} 
                        />
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <View style={{ padding: spacing.xl, paddingBottom: spacing.xxl }}>
            <CXText variant="bodyStrong" style={{ marginBottom: spacing.md }}>
              Today's Classes
            </CXText>
            {classesForToday.length === 0 ? (
              <CXText variant="small" color={colors.textMuted}>
                No classes scheduled for today.
              </CXText>
            ) : (
              <View style={styles.timeline}>
                {gridTimeSlots.map((slot) => {
                  const slotClass = classesForToday.find(c => c.startTime === slot.start || (c.startTime < slot.start && c.endTime > slot.start));
                  const endTimeStr = slot.label.match(/-\s*(\d{1,2}:\d{2})/)?.[1] ?? "";
                  const active = isClassActive(slot.start, endTimeStr || slot.start);
                  
                  if (slot.break) {
                    return (
                      <View key={slot.id} style={[styles.classRow, { opacity: 0.7 }]}>
                        <View style={styles.timeCol}>
                          <CXText variant="smallStrong">{slot.start}</CXText>
                          <CXText variant="caption" color={colors.textMuted}>{endTimeStr}</CXText>
                        </View>
                        <View style={[styles.timelineDot, { backgroundColor: colors.border }]} />
                        <View style={[styles.classBlock, { borderLeftColor: colors.border, backgroundColor: colors.backgroundHover }]}>
                          <CXText variant="bodyStrong" color={colors.textMuted}>{slot.label.includes("Lunch") ? "LUNCH BREAK" : "SHORT BREAK"}</CXText>
                          {active && (
                            <CXText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                              ● Happening Now
                            </CXText>
                          )}
                        </View>
                      </View>
                    );
                  }

                  if (slotClass) {
                    return (
                      <Pressable
                        key={slot.id}
                        onPress={() => navigation.navigate("EditClass", { entryId: slotClass.id })}
                        style={[
                          styles.classRow,
                          active && { backgroundColor: slotClass.color + "1A", borderRadius: 8, padding: spacing.xs, marginHorizontal: -spacing.xs }
                        ]}
                      >
                        <View style={styles.timeCol}>
                          <CXText variant="smallStrong">{slot.start}</CXText>
                          <CXText variant="caption" color={colors.textMuted}>
                            {endTimeStr}
                          </CXText>
                        </View>
                        <View
                          style={[
                            styles.timelineDot,
                            { backgroundColor: slotClass.color },
                            active && { transform: [{ scale: 1.5 }], borderWidth: 2, borderColor: colors.white }
                          ]}
                        />
                        <View style={[styles.classBlock, { borderLeftColor: slotClass.color }]}>
                          <CXText variant="bodyStrong">{slotClass.subject}</CXText>
                          <CXText variant="caption" color={colors.textMuted}>
                            {slotClass.lecturer} {slotClass.lecturer && slotClass.room ? "•" : ""} {slotClass.room}
                          </CXText>
                          {active && (
                            <CXText variant="caption" color={slotClass.color} style={{ marginTop: spacing.xs }}>
                              ● Happening Now
                            </CXText>
                          )}
                        </View>
                      </Pressable>
                    );
                  }

                  return (
                    <Pressable
                      key={slot.id}
                      onPress={() => navigation.navigate("EditClass", { defaultDay: currentDay, defaultStartTime: slot.start })}
                      style={[styles.classRow, { opacity: 0.5 }]}
                    >
                      <View style={styles.timeCol}>
                        <CXText variant="smallStrong">{slot.start}</CXText>
                        <CXText variant="caption" color={colors.textMuted}>{endTimeStr}</CXText>
                      </View>
                      <View style={[styles.timelineDot, { backgroundColor: colors.border }]} />
                      <View style={[styles.classBlock, { borderLeftColor: colors.border }]}>
                        <CXText variant="bodyStrong" color={colors.textMuted}>Free Period</CXText>
                        <CXText variant="caption" color={colors.textMuted}>Tap to add a class</CXText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
      </ScrollView>
      <CXButton
        label="Add Class"
        iconLeft="add"
        fullWidth={false}
        style={styles.fab}
        onPress={() => navigation.navigate("EditClass")}
      />
    </CXScreen>
  );
}

export function EditClassScreen({
  navigation,
  route,
}: StackProps<"EditClass">) {
  const timetable = useAppStore((state) => state.timetable);
  const addTimetableEntry = useAppStore((state) => state.addTimetableEntry);
  const updateTimetableEntry = useAppStore((state) => state.updateTimetableEntry);
  const deleteTimetableEntry = useAppStore((state) => state.deleteTimetableEntry);
  
  const existing = timetable.find((item) => item.id === route.params?.entryId);
  const defaultDay = route.params?.defaultDay ?? 1;
  const defaultStartTime = route.params?.defaultStartTime ?? "09:00";
  const defaultEndHour = (parseInt(defaultStartTime.split(":")[0]) + 1).toString().padStart(2, "0");
  const defaultEndTime = `${defaultEndHour}:${defaultStartTime.split(":")[1] ?? "00"}`;
  
  const [form, setForm] = useState({
    subject: existing?.subject ?? "",
    room: existing?.room ?? "",
    lecturer: existing?.lecturer ?? "",
    startTime: existing?.startTime ?? defaultStartTime,
    endTime: existing?.endTime ?? defaultEndTime,
    repeat: "Every week",
    day: existing?.day ?? defaultDay,
    color: existing?.color ?? "#6338F2",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!form.subject.trim()) {
      setError("Subject name is required");
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        updateTimetableEntry(existing.id, form);
      } else {
        addTimetableEntry({ 
          ...form, 
          id: `tt-${Date.now()}`, 
        } as any);
      }
      navigation.goBack();
    } catch (caught) {
      setError("Failed to save class");
    } finally {
      setSaving(false);
    }
  };
  return (
    <CXScrollScreen>
      <CXHeader
        title={existing ? "Edit Class" : "Add Class"}
        subtitle="Add the details for a class to your timetable"
        onBack={navigation.goBack}
      />
      <View style={styles.calendarArt}>
        <Ionicons name="calendar" size={34} color={colors.primary} />
      </View>
      <CXInput
        label="Class Name"
        placeholder="e.g. Data Structures"
        value={form.subject}
        onChangeText={(subject) => setForm((value) => ({ ...value, subject }))}
      />
      <CXInput
        label="Faculty Name"
        placeholder="e.g. Prof. Ravi"
        value={form.lecturer}
        onChangeText={(lecturer) =>
          setForm((value) => ({ ...value, lecturer }))
        }
      />
      <CXSectionHeader title="Select Days" />
      <CXRow style={styles.days}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
          (label, index) => (
            <CXChip 
              key={label} 
              label={label} 
              active={form.day === index + 1} 
              onPress={() => setForm((value) => ({ ...value, day: index + 1 }))}
            />
          ),
        )}
      </CXRow>

      <CXRow style={{ gap: spacing.md, paddingHorizontal: spacing.screen }}>
        <View style={{ flex: 1 }}>
          <CXInput
            label="Start Time"
            placeholder="09:00"
            value={form.startTime}
            onChangeText={(startTime) => setForm((value) => ({ ...value, startTime }))}
          />
        </View>
        <View style={{ flex: 1 }}>
          <CXInput
            label="End Time"
            placeholder="10:00"
            value={form.endTime}
            onChangeText={(endTime) => setForm((value) => ({ ...value, endTime }))}
          />
        </View>
      </CXRow>

      <CXInput
        label="Room / Location"
        placeholder="e.g. Room A-204"
        value={form.room}
        onChangeText={(room) => setForm((value) => ({ ...value, room }))}
      />
      <CXSectionHeader title="Repeat" />
      <CXRow style={styles.wrap}>
        {["Does not repeat", "Every week", "Custom"].map((item) => (
          <CXChip
            key={item}
            label={item}
            active={form.repeat === item}
            onPress={() => setForm((value) => ({ ...value, repeat: item }))}
          />
        ))}
      </CXRow>
      <CXSectionHeader title="Choose Color" />
      <CXRow style={styles.colorRow}>
        {["#6338F2", "#3B82F6", "#22C55E", "#F59E0B", "#EC4899", "#EF4444"].map(
          (color) => (
            <Pressable
              key={color}
              onPress={() => setForm((value) => ({ ...value, color }))}
              style={[
                styles.color, 
                { backgroundColor: color },
                form.color === color && { borderWidth: 3, borderColor: colors.ink }
              ]}
            />
          ),
        )}
      </CXRow>
      {error ? <CXText color={colors.danger}>{error}</CXText> : null}
      <View style={{ gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.xl }}>
        <CXButton
          label="Save Class"
          iconLeft="save-outline"
          loading={saving}
          onPress={() => void save()}
        />
        {existing ? (
          <CXButton
            label="Delete Class"
            iconLeft="trash-outline"
            variant="danger"
            onPress={() => {
              Alert.alert("Delete Class", "Are you sure you want to delete this class?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    setSaving(true);
                    try {
                      deleteTimetableEntry(existing.id);
                      navigation.goBack();
                    } catch (e) {
                      setError("Failed to delete class");
                      setSaving(false);
                    }
                  },
                },
              ]);
            }}
          />
        ) : null}
        <CXButton label="Cancel" variant="ghost" onPress={navigation.goBack} />
      </View>
    </CXScrollScreen>
  );
}

export function TimetableSettingsScreen({ navigation }: StackProps<"TimetableSettings">) {
  const gridTimeSlots = useAppStore((state) => state.gridTimeSlots);
  const addTimeSlot = useAppStore((state) => state.addTimeSlot);
  const deleteTimeSlot = useAppStore((state) => state.deleteTimeSlot);
  const scanTimetableImage = useAppStore((state) => state.scanTimetableImage);

  const [form, setForm] = useState({ label: "", start: "", break: false });
  const [scanning, setScanning] = useState(false);

  const handleLabelChange = (text: string) => {
    let newLabel = text;
    let newStart = form.start;

    // Matches formats like "16-17", "9 - 10"
    const match = text.trim().match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    if (match) {
      const s = parseInt(match[1]);
      const e = parseInt(match[2]);
      
      const sAmPm = (s >= 12 && s < 24) ? "PM" : "AM";
      const eAmPm = (e >= 12 && e < 24) ? "PM" : "AM";
      
      const sStr = s.toString().padStart(2, '0');
      const eStr = e.toString().padStart(2, '0');
      
      newLabel = `${sStr}:00 - ${eStr}:00 ${eAmPm}`;
      newStart = `${sStr}:00`;
    }
    
    setForm((prev) => ({ ...prev, label: newLabel, start: newStart }));
  };

  const handleAIScan = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to scan your timetable.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setScanning(true);
      try {
        await scanTimetableImage(result.assets[0].base64);
        Alert.alert(
          "Success", 
          "Timetable structure and classes imported successfully using AI!",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } catch (e) {
        Alert.alert("Error", "Failed to parse timetable image");
      } finally {
        setScanning(false);
      }
    }
  };

  return (
    <CXKeyboardScreen>
      <ScrollView contentContainerStyle={styles.page}>
        <CXHeader
          title="Timetable Settings"
          subtitle="Customize your week view columns"
          onBack={navigation.goBack}
        />
      
      <View style={{ marginBottom: spacing.lg, padding: spacing.md, backgroundColor: colors.primary + "10", borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary + "30" }}>
        <CXText variant="bodyStrong" color={colors.primary} style={{ marginBottom: spacing.sm }}>AI Timetable Scanner 🪄</CXText>
        <CXText variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Upload a photo of your class schedule and let AI automatically build your grid structure and add your classes!</CXText>
        <CXButton 
          label={scanning ? "AI is analyzing your timetable..." : "Upload Timetable Image"} 
          icon={scanning ? undefined : "scan-outline"}
          onPress={handleAIScan}
          disabled={scanning}
        />
      </View>

      <CXSectionHeader title="Current Time Slots" />
      {gridTimeSlots.map(slot => (
        <CXRow key={slot.id} style={{ marginBottom: spacing.md, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md }}>
          <View style={styles.flex}>
            <CXText variant="bodyStrong">{slot.label} {slot.break && "(Break)"}</CXText>
            <CXText variant="caption" color={colors.textMuted}>Start Time: {slot.start}</CXText>
          </View>
          <CXIconButton 
            icon="trash-outline" 
            label="Delete"
            backgroundColor={colors.danger + "20"}
            onPress={() => deleteTimeSlot(slot.id)}
          />
        </CXRow>
      ))}

      <CXSectionHeader title="Add New Slot" />
      <CXInput
        label="Slot Label"
        placeholder="e.g. 09:00 - 10:00 (type 9-10 to auto-format)"
        value={form.label}
        onChangeText={(label) => setForm((prev) => ({ ...prev, label }))}
        onBlur={() => handleLabelChange(form.label)}
      />
      <CXInput
        label="Start Time (24h)"
        placeholder="e.g. 09:00"
        value={form.start}
        onChangeText={(start) => setForm((prev) => ({ ...prev, start }))}
      />
      <CXRow style={{ marginVertical: spacing.md }}>
        <CXText variant="bodyStrong" style={styles.flex}>Is this a Break / Lunch slot?</CXText>
        <CXButton 
          label={form.break ? "Yes" : "No"} 
          variant={form.break ? "primary" : "outline"}
          fullWidth={false}
          onPress={() => setForm((prev) => ({ ...prev, break: !prev.break }))} 
        />
      </CXRow>
      
      <CXButton 
        label="Add Time Slot" 
        onPress={() => {
          if (!form.label || !form.start) return Alert.alert("Error", "Please fill out label and start time");
          addTimeSlot({ id: `ts-${Date.now()}`, ...form });
          setForm({ label: "", start: "", break: false });
        }} 
      />
      </ScrollView>
    </CXKeyboardScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  mapHeader: { paddingHorizontal: spacing.screen, gap: spacing.xs, zIndex: 2 },
  chips: { gap: spacing.xs, paddingVertical: spacing.xs },
  fullMap: { flex: 1, minHeight: 360 },
  mapNotice: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
  },
  mapControls: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    gap: spacing.xs,
  },
  mapSheet: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.sm,
  },
  friendCards: { gap: spacing.md },
  mapFriend: { width: 72, alignItems: "center", gap: 3 },
  locationHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.backgroundLavender,
  },
  locationHeroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  settingRow: {
    minHeight: 72,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  wrap: { flexWrap: "wrap", gap: spacing.xs },
  privacy: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.backgroundLavender,
  },
  ghostHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.backgroundLavender,
  },
  ghostIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  durationRow: { gap: spacing.xs },
  duration: {
    flex: 1,
    minHeight: 80,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    padding: spacing.xs,
  },
  durationActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceLavender,
  },
  radioRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  feedFilters: { gap: spacing.xs },
  week: { gap: spacing.xs },
  day: {
    width: 54,
    height: 68,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  todayCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  todayIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  timeline: { gap: spacing.sm },
  classRow: { flexDirection: "row", alignItems: "stretch", gap: spacing.sm },
  timeCol: { width: 52, alignItems: "flex-end", paddingTop: spacing.sm },
  timelineDot: { width: 9, height: 9, borderRadius: 5, marginTop: spacing.md },
  classBlock: {
    flex: 1,
    minHeight: 86,
    borderLeftWidth: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    minWidth: 132,
  },
  calendarArt: {
    width: 82,
    height: 82,
    borderRadius: 24,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  days: { flexWrap: "wrap", gap: spacing.xs },
  timeInputs: { gap: spacing.sm },
  colorRow: { gap: spacing.md },
  color: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.white,
  },
});
