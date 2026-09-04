import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, View, Alert, Keyboard, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";

import {
  CXButton,
  CXCard,
  CXIconButton,
  CXRow,
  CXScreen,
  CXSearchBar,
  CXSectionHeader,
  CXText,
} from "@/components/ui";
import { useRootNavigation } from "@/hooks/useRootNavigation";
import { useAppStore } from "@/store/appStore";

import { colors, gradients, radius, spacing } from "@/theme";

const avatar = require("../../../assets/avatars/anand.png");

const quickActions = [
  {
    label: "Timetable",
    icon: "calendar-outline",
    route: "Timetable",
    color: "#6D4AF6",
  },
  {
    label: "Events",
    icon: "ticket-outline",
    route: "Events",
    color: "#F59E0B",
  },
  {
    label: "Marketplace",
    icon: "storefront-outline",
    route: "Marketplace",
    color: "#22C55E",
  },
  {
    label: "Study Groups",
    icon: "people-outline",
    route: "StudyGroups",
    color: "#3B82F6",
  },
  {
    label: "Games",
    icon: "game-controller-outline",
    route: "GamesHub",
    color: "#8B5CF6",
  },
  { label: "More", icon: "grid-outline", route: "CreateHub", color: "#EC4899" },
] as const;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning!";
  if (hour < 17) return "Good Afternoon!";
  if (hour < 21) return "Good Evening!";
  return "Good Night!";
}

export function HomeScreen() {
  const navigation = useRootNavigation();
  const { user, weather, fetchWeather, sgpas, updateSgpa } = useAppStore();
  const timetable = useAppStore((state) => state.timetable);
  const events = useAppStore((state) => state.events);
  const unreadNotifications = useAppStore((state) => state.unreadNotifications);
  
  const [currentTimeObj, setCurrentTimeObj] = useState(new Date());
  const [isSgpaModalVisible, setSgpaModalVisible] = useState(false);
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeObj(new Date()), 60000); // 1 minute
    return () => clearInterval(timer);
  }, []);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterActive, setFilterActive] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  
  useEffect(() => {
    if (!weather) {
      void fetchWeather();
    }
  }, [weather, fetchWeather]);

  const firstName = user?.name ? user.name.split(" ")[0] : "Student";
  const now = new Date();
  const currentY = now.getFullYear();
  const currentM = now.getMonth() + 1;
  const currentD = now.getDate();
  const currentT = now.getHours() * 60 + now.getMinutes();

  const parseEventDate = (dateStr: string, timeStr: string) => {
    let y = 0, m = 0, d = 0;
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      d = Number(parts[0]);
      m = Number(parts[1]);
      y = Number(parts[2]);
    } else {
      const parts = dateStr.split(" ");
      d = Number(parts[0]);
      const monthStr = parts[1]?.substring(0, 3).toLowerCase() || "";
      const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      m = months.indexOf(monthStr) + 1;
      y = parts[2] ? Number(parts[2]) : new Date().getFullYear();
    }
    
    let totalMinutes = 0;
    if (timeStr) {
      const [time, modifier] = timeStr.split(" ");
      if (time) {
        let [hours, minutes] = time.split(":").map(Number);
        if (hours === 12) hours = 0;
        if (modifier && modifier.toLowerCase() === "pm") hours += 12;
        totalMinutes = (hours || 0) * 60 + (minutes || 0);
      }
    }
    return { y, m, d, t: totalMinutes };
  };

  const upcomingEvents = events.filter(e => {
    const pd = parseEventDate(e.date, e.time);
    const isPast =
      pd.y < currentY ||
      (pd.y === currentY && pd.m < currentM) ||
      (pd.y === currentY && pd.m === currentM && pd.d < currentD) ||
      (pd.y === currentY && pd.m === currentM && pd.d === currentD && pd.t < currentT);
    return !isPast;
  }).sort((a, b) => {
    const pa = parseEventDate(a.date, a.time);
    const pb = parseEventDate(b.date, b.time);
    if (pa.y !== pb.y) return pa.y - pb.y;
    if (pa.m !== pb.m) return pa.m - pb.m;
    if (pa.d !== pb.d) return pa.d - pb.d;
    return pa.t - pb.t;
  });

  const featured = upcomingEvents[0] ?? events[0]!;

  const gridTimeSlots = useAppStore((state) => state.gridTimeSlots);
  const currentDayOfWeek = currentTimeObj.getDay() === 0 ? 7 : currentTimeObj.getDay();
  
  // To perfectly sync the Home Screen with the Timetable Screen, we only count
  // the exact unique classes that successfully bind to a valid grid slot.
  const getDisplayedClasses = (dayIndex: number) => {
    const dayClasses = timetable.filter((c) => c.day === dayIndex);
    const displayed = [];
    for (const slot of gridTimeSlots) {
      if (slot.break) continue;
      const slotClass = dayClasses.find(c => c.startTime === slot.start || (c.startTime < slot.start && c.endTime > slot.start));
      if (slotClass && !displayed.includes(slotClass)) {
        displayed.push(slotClass);
      }
    }
    return displayed;
  };

  const classesForToday = getDisplayedClasses(currentDayOfWeek);

  const parseTime = (timeStr: string) => {
    const match = timeStr.match(/(\d+):(\d+)/);
    if (!match) return 0;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (timeStr.toLowerCase().includes("pm") && h < 12) h += 12;
    if (timeStr.toLowerCase().includes("am") && h === 12) h = 0;
    return h * 60 + m;
  };

  const currentTimeMins = currentTimeObj.getHours() * 60 + currentTimeObj.getMinutes();
  
  let realNextClass = null;
  let nextClassDayDiff = 0;

  for (let offset = 0; offset < 7; offset++) {
    let checkDay = currentDayOfWeek + offset;
    if (checkDay > 7) checkDay -= 7;

    const dayClasses = getDisplayedClasses(checkDay);
    if (dayClasses.length === 0) continue;

    let upcoming = dayClasses;
    if (offset === 0) {
      upcoming = dayClasses.filter(c => parseTime(c.endTime) > currentTimeMins);
    }
    
    if (upcoming.length > 0) {
      upcoming = [...upcoming].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
      realNextClass = upcoming[0];
      nextClassDayDiff = offset;
      break;
    }
  }

  let nextClassTimeStr = "";
  if (realNextClass) {
    if (nextClassDayDiff === 0) {
      const startMins = parseTime(realNextClass.startTime);
      if (startMins <= currentTimeMins) {
        nextClassTimeStr = "Happening Now";
      } else {
        const diffMins = startMins - currentTimeMins;
        if (diffMins >= 60) {
          const h = Math.floor(diffMins / 60);
          const m = diffMins % 60;
          nextClassTimeStr = `In ${h}h ${m}m`;
        } else {
          nextClassTimeStr = `In ${diffMins} min`;
        }
      }
    } else if (nextClassDayDiff === 1) {
      nextClassTimeStr = "Tomorrow";
    } else {
      const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      let d = currentTimeObj.getDay() + nextClassDayDiff;
      if (d >= 7) d -= 7;
      nextClassTimeStr = shortDays[d] || "Upcoming";
    }
  }
  
  const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const todayDateStr = `${shortDays[currentTimeObj.getDay()]}, ${currentTimeObj.getDate()} ${shortMonths[currentTimeObj.getMonth()]}`;

  const sgpaValues = Object.values(sgpas).filter((val): val is number => typeof val === 'number' && !isNaN(val) && val > 0);
  const calculatedCgpa = sgpaValues.length > 0 
    ? (sgpaValues.reduce((a, b) => a + b, 0) / sgpaValues.length).toFixed(2) 
    : "N/A";

  const filteredEvents = events.filter((e) =>
    (activeFilter === "All" || activeFilter === "Events") &&
    (e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.location.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  const filteredClasses = timetable.filter((c) =>
    (activeFilter === "All" || activeFilter === "Classes") &&
    (c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.room.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <CXScreen edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <CXRow style={styles.header}>
          <View style={styles.flex}>
            <CXText variant="h3">Hi, {firstName} 👋</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              {getGreeting()}
            </CXText>
          </View>
          <CXIconButton
            icon="notifications-outline"
            label="Notifications"
            backgroundColor={colors.white}
            badge={unreadNotifications}
            onPress={() => navigation.navigate("Notifications")}
          />
          <Pressable onPress={() => navigation.navigate("Settings")}>
            <Image source={user?.avatarUrl ? { uri: user.avatarUrl } : avatar} contentFit="cover" style={styles.avatar} />
          </Pressable>
        </CXRow>
        <CXSearchBar 
          placeholder="Search people, events, groups..." 
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => {
            setSearchQuery("");
            setFilterActive(false);
            Keyboard.dismiss();
          }}
          onPressFilter={() => setFilterActive(!isFilterActive)}
        />

        {isFilterActive && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {["All", "Classes", "Events", "Groups"].map(f => (
              <Pressable
                key={f}
                onPress={() => setActiveFilter(f)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: activeFilter === f ? colors.primary : colors.white,
                  borderWidth: 1,
                  borderColor: activeFilter === f ? colors.primary : colors.borderSoft,
                }}
              >
                <CXText variant="smallStrong" color={activeFilter === f ? colors.white : colors.textMuted}>
                  {f}
                </CXText>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {searchQuery ? (
          <View style={{ marginTop: spacing.md, gap: spacing.md }}>
            <CXText variant="h3">Search Results</CXText>
            {filteredClasses.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <CXText variant="smallStrong" color={colors.textMuted}>Classes</CXText>
                {filteredClasses.map((c) => (
                  <Pressable 
                    key={c.id} 
                    onPress={() => {
                      setSearchQuery("");
                      setFilterActive(false);
                      Keyboard.dismiss();
                      navigation.navigate("Timetable");
                    }}
                  >
                    <CXCard style={styles.classCard}>
                      <View style={styles.classIcon}>
                        <Ionicons name="book-outline" size={23} color={colors.primary} />
                      </View>
                      <View style={styles.flex}>
                        <CXText variant="bodyStrong">{c.subject}</CXText>
                        <CXText variant="caption" color={colors.textMuted}>
                          {c.startTime} – {c.endTime} · {c.room}
                        </CXText>
                      </View>
                    </CXCard>
                  </Pressable>
                ))}
              </View>
            )}
            
            {filteredEvents.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <CXText variant="smallStrong" color={colors.textMuted}>Events</CXText>
                {filteredEvents.map((e) => (
                  <Pressable 
                    key={e.id} 
                    onPress={() => {
                      setSearchQuery("");
                      setFilterActive(false);
                      Keyboard.dismiss();
                      navigation.navigate("EventDetails", { eventId: e.id });
                    }}
                  >
                    <CXCard style={styles.eventCard}>
                      <Image source={e.image} contentFit="cover" style={styles.eventImage} />
                      <View style={styles.flex}>
                        <CXText variant="bodyStrong">{e.title}</CXText>
                        <CXText variant="caption" color={colors.textMuted}>
                          {e.date} · {e.location}
                        </CXText>
                      </View>
                    </CXCard>
                  </Pressable>
                ))}
              </View>
            )}

            {filteredClasses.length === 0 && filteredEvents.length === 0 && (
              <CXText color={colors.textMuted} align="center" style={{ marginTop: spacing.xl }}>
                No results found for "{searchQuery}"
              </CXText>
            )}
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <CXRow style={styles.topCards}>
          <Pressable
            style={styles.flex}
            onPress={() => navigation.navigate("Weather")}
          >
            <LinearGradient
              colors={["#FFFFFF", "#F1ECFF"]}
              style={styles.weatherCard}
            >
              <Ionicons 
                name={(weather?.iconOutline as any) ?? "sunny-outline"}
                size={32} 
                color={colors.primary} 
              />
              <View>
                <CXText variant="h2">{weather ? `${weather.temp}°C` : "--"}</CXText>
                <CXText variant="caption" color={colors.textMuted}>
                  {weather?.city ?? "Locating..."}
                </CXText>
              </View>
            </LinearGradient>
          </Pressable>
          <Pressable
            style={styles.flex}
            onPress={() => navigation.navigate("Timetable")}
          >
            <LinearGradient colors={gradients.primary} style={styles.dateCard}>
              <Ionicons
                name="calendar-clear-outline"
                size={30}
                color={colors.white}
              />
              <View>
                <CXText variant="bodyStrong" color={colors.white}>
                  {todayDateStr}
                </CXText>
                <CXText variant="caption" color="#EDE9FF">
                  {classesForToday.length} {classesForToday.length === 1 ? "class" : "classes"} today
                </CXText>
              </View>
            </LinearGradient>
          </Pressable>
        </CXRow>

        <CXSectionHeader
          title="Quick Actions"
          action="See all"
          onAction={() => navigation.navigate("Main", { screen: "CreateHub" })}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {quickActions.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => navigation.navigate(item.route as never)}
              style={styles.quickItem}
            >
              <View
                style={[
                  styles.quickIcon,
                  { backgroundColor: `${item.color}16` },
                ]}
              >
                <Ionicons name={item.icon} size={21} color={item.color} />
              </View>
              <CXText variant="caption" align="center">
                {item.label}
              </CXText>
            </Pressable>
          ))}
        </ScrollView>

        <CXSectionHeader
          title="Upcoming Classes"
          action="See all"
          onAction={() => navigation.navigate("Timetable")}
        />
        {realNextClass ? (
          <Pressable onPress={() => navigation.navigate("Timetable")}>
            <CXCard style={styles.classCard}>
              <View style={styles.classIcon}>
                <Ionicons name="book-outline" size={23} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <CXText variant="bodyStrong">{realNextClass.subject}</CXText>
                <CXText variant="caption" color={colors.textMuted}>
                  {realNextClass.startTime} – {realNextClass.endTime} · {realNextClass.room}
                </CXText>
              </View>
              <View style={styles.timeBadge}>
                <CXText variant="caption" color={colors.primary}>
                  {nextClassTimeStr}
                </CXText>
              </View>
            </CXCard>
          </Pressable>
        ) : (
          <CXText variant="body" color={colors.textMuted} align="center" style={{ marginVertical: spacing.md }}>
            You have no more classes for today! 🎉
          </CXText>
        )}

        <CXSectionHeader
          title="Campus Events"
          action="See all"
          onAction={() => navigation.navigate("Events")}
        />
        <Pressable
          onPress={() =>
            navigation.navigate("EventDetails", { eventId: featured.id })
          }
        >
          <CXCard style={styles.eventCard}>
            <Image
              source={featured.image}
              contentFit="cover"
              style={styles.eventImage}
            />
            <View style={styles.flex}>
              <CXText variant="bodyStrong">{featured.title}</CXText>
              <CXText variant="caption" color={colors.textMuted}>
                {featured.date} · {featured.location}
              </CXText>
            </View>
            <Ionicons
              name="bookmark-outline"
              size={18}
              color={colors.primary}
            />
          </CXCard>
        </Pressable>

        <CXSectionHeader title="Your Progress" />
        <Pressable onPress={() => setSgpaModalVisible(true)}>
          <CXCard style={styles.classCard}>
            <View style={styles.classIcon}>
              <Ionicons name="school-outline" size={23} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <CXText variant="bodyStrong">Current CGPA</CXText>
              <CXText variant="caption" color={colors.textMuted}>
                Tap to update your semester grades
              </CXText>
            </View>
            <View style={[styles.timeBadge, { backgroundColor: colors.primaryTint, paddingVertical: 4, paddingHorizontal: 8 }]}>
              <CXText variant="bodyStrong" color={colors.primary}>
                {calculatedCgpa}
              </CXText>
            </View>
          </CXCard>
        </Pressable>

        <LinearGradient colors={["#F4EEFF", "#FFFFFF"]} style={styles.aiCard}>
          <View style={styles.aiIcon}>
            <Ionicons name="sparkles" size={24} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <CXText variant="bodyStrong">AI Study Assistant</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              Need help with assignments or revision?
            </CXText>
          </View>
          <CXButton
            label="Ask now"
            variant="outline"
            size="sm"
            fullWidth={false}
            onPress={() => navigation.navigate("AIChat")}
          />
        </LinearGradient>
        </View>
        )}
      </ScrollView>

      <Modal
        visible={isSgpaModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSgpaModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={{ flex: 1 }}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setSgpaModalVisible(false)}
          >
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <CXRow style={{ justifyContent: "space-between", marginBottom: spacing.md }}>
                <CXText variant="h3">Calculate CGPA</CXText>
                <CXIconButton
                  icon="close"
                  onPress={() => setSgpaModalVisible(false)}
                />
              </CXRow>
              
              <CXText variant="body" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
                Enter your SGPA for each semester to automatically calculate your overall CGPA.
              </CXText>
              
              <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
                <CXText variant="caption" color={colors.textMuted}>Current CGPA</CXText>
                <CXText variant="h1" color={colors.primary}>{calculatedCgpa}</CXText>
              </View>

              <ScrollView style={{ maxHeight: 300, marginBottom: spacing.md }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <View key={sem} style={styles.sgpaInputRow}>
                    <CXText variant="bodyStrong">Semester {sem}</CXText>
                    <TextInput
                      style={styles.sgpaInput}
                      placeholder="e.g. 8.5"
                      keyboardType="decimal-pad"
                      defaultValue={sgpas[sem] ? sgpas[sem].toString() : ""}
                      onChangeText={(text) => {
                        if (text.trim() === "") {
                          updateSgpa(sem, undefined as any);
                          return;
                        }
                        const val = parseFloat(text);
                        if (!isNaN(val) && val <= 10 && val >= 0) {
                          updateSgpa(sem, val);
                        }
                      }}
                    />
                  </View>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl,
    gap: spacing.xs,
  },
  header: { minHeight: 58, gap: spacing.xs },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  topCards: { gap: spacing.sm, marginTop: spacing.sm },
  weatherCard: {
    minHeight: 92,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  dateCard: {
    minHeight: 92,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  quickRow: { flexDirection: "row", justifyContent: "flex-start", gap: 10 },
  quickItem: { width: 72, alignItems: "center", gap: spacing.xs },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  classCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  classIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  timeBadge: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.screen,
    maxHeight: "80%",
  },
  sgpaInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  sgpaInput: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: 80,
    textAlign: "center",
    fontFamily: "Inter-SemiBold",
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  eventImage: { width: 96, height: 68, borderRadius: radius.sm },
  progressRow: { gap: spacing.xs },
  progressCard: {
    flex: 1,
    alignItems: "center",
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  aiCard: {
    minHeight: 82,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
});
