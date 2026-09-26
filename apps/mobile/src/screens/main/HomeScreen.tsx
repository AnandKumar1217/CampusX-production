import { useState, useEffect, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, View, Alert, Keyboard, Modal, TextInput, KeyboardAvoidingView, Platform, BackHandler, ToastAndroid } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  CXAvatar,
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
import { eventService } from "@/services/eventService";
import { EventItem } from "@/types/domain";
import { timetableService } from "@/services/timetableService";
import { getUpcomingClass, parseTimeToMins } from "@/utils/timetable";
import { fetchWeatherForLocation } from "@/services/weatherService";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { TimetableEntry } from "@/types/domain";

import { colors, gradients, radius, spacing } from "@/theme";

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
    label: "People",
    icon: "person-add-outline",
    route: "People",
    color: "#14B8A6",
  },
  {
    label: "Games",
    icon: "game-controller-outline",
    route: "GamesHub",
    color: "#8B5CF6",
  },
  {
    label: "Study Groups",
    icon: "people-outline",
    route: "StudyGroups",
    color: "#3B82F6",
  },
  {
    label: "Trips",
    icon: "airplane-outline",
    route: "Trips",
    color: "#F59E0B",
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
  const user = useAppStore(state => state.user);

  const { data: weather, refetch: refetchWeather } = useQuery({
    queryKey: ["weather", "current", "HomeScreen"],
    queryFn: async () => {
      let lat = 12.9716;
      let lon = 77.5946;
      let city = "Bengaluru, India";

      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
          city = "Current Location";
          try {
            const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
            if (reverse && reverse.length > 0) {
              const place = reverse[0]!.city || reverse[0]!.subregion || reverse[0]!.region;
              if (place) city = `${place}, ${reverse[0]!.country || ""}`.trim().replace(/,\s*$/, "");
            }
          } catch (e) {}
        }
      } catch (e) {}

      return fetchWeatherForLocation(lat, lon, city);
    },
    staleTime: 1000 * 60 * 15, // 15 mins for home screen
  });

  useFocusEffect(
    useCallback(() => {
      void refetchWeather();
    }, [refetchWeather])
  );
  const sgpas = useAppStore(state => state.sgpas);
  const { data: serverTimetable = [] } = useQuery<TimetableEntry[]>({
    queryKey: ["timetable", user?.id],
    queryFn: timetableService.getTimetable,
    enabled: !!user?.id,
  });
  const timetable = serverTimetable || [];
  const unreadNotifications = useAppStore((state) => state.unreadNotifications);

  const { data: events = [], refetch: refetchEvents } = useQuery<EventItem[]>({
    queryKey: ["events", user?.id, "home"],
    enabled: !!user?.id,
    queryFn: async () => (await eventService.listEvents()).items,
  });
  useFocusEffect(
    useCallback(() => {
      if (user?.id) void refetchEvents();
    }, [refetchEvents, user?.id])
  );

  const [currentTimeObj, setCurrentTimeObj] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeObj(new Date()), 60000); // 1 minute
    return () => clearInterval(timer);
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterActive, setFilterActive] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");



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
        if (modifier && modifier.toLowerCase() === "pm" && hours !== undefined) hours += 12;
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

  const featured = upcomingEvents.length > 0 ? upcomingEvents[0] : null;

  const jsDay = currentTimeObj.getDay();
  const currentDayOfWeek = jsDay === 0 ? 7 : jsDay;
  const classesForToday = timetable
    .filter((c) =>
      c.days?.includes(currentDayOfWeek) &&
      c.subject !== "BREAK" &&
      c.subject !== "BLANK"
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const upcomingData = getUpcomingClass(timetable);
  const nextClassTimeStr = upcomingData?.timeContext;

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
    c.room?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredFeatures = quickActions.filter((f) =>
    (activeFilter === "All" || activeFilter === "Features") &&
    (f.label.toLowerCase().includes(searchQuery.toLowerCase()))
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
          <Pressable onPress={() => navigation.navigate("Main", { screen: "Profile" })}>
            <CXAvatar source={user?.avatarUrl ?? undefined} name={user?.name ?? "You"} size={40} />
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
            {["All", "Classes", "Events", "Features"].map(f => (
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

            {filteredFeatures.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <CXText variant="smallStrong" color={colors.textMuted}>Features</CXText>
                {filteredFeatures.map((f) => (
                  <Pressable
                    key={f.label}
                    onPress={() => {
                      setSearchQuery("");
                      setFilterActive(false);
                      Keyboard.dismiss();
                      navigation.navigate(f.route as never);
                    }}
                  >
                    <CXCard style={styles.classCard}>
                      <View style={[styles.classIcon, { backgroundColor: `${f.color}16` }]}>
                        <Ionicons name={f.icon as any} size={23} color={f.color} />
                      </View>
                      <View style={styles.flex}>
                        <CXText variant="bodyStrong">{f.label}</CXText>
                      </View>
                    </CXCard>
                  </Pressable>
                ))}
              </View>
            )}

            {filteredClasses.length === 0 && filteredEvents.length === 0 && filteredFeatures.length === 0 && (
              <CXText color={colors.textMuted} align="center" style={{ marginTop: spacing.xl }}>
                {`No results found for "${searchQuery}"`}
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
                <Ionicons name={item.icon as any} size={21} color={item.color} />
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
          {(() => {
            const jsDay = currentTimeObj.getDay();
            const currentDayOfWeek = jsDay === 0 ? 7 : jsDay;
            const currentMins = currentTimeObj.getHours() * 60 + currentTimeObj.getMinutes();
            
            let upcomingClass: any = null;
            let timeText = "";
            let isCurrent = false;

            for (let offset = 0; offset < 7; offset++) {
              const checkDay = ((currentDayOfWeek - 1 + offset) % 7) + 1;
              const dayClasses = timetable
                .filter(c => c.days?.includes(checkDay) && c.subject !== "BREAK" && c.subject !== "BLANK")
                .sort((a, b) => parseTimeToMins(a.startTime) - parseTimeToMins(b.startTime));

              if (dayClasses.length === 0) continue;

              if (offset === 0) {
                // Today
                const validClasses = dayClasses.filter(c => parseTimeToMins(c.endTime) > currentMins);
                if (validClasses.length > 0) {
                  upcomingClass = validClasses[0];
                  
                  const startMins = parseTimeToMins(upcomingClass.startTime);
                  const endMins = parseTimeToMins(upcomingClass.endTime);
                  isCurrent = startMins <= currentMins && endMins > currentMins;
                  
                  if (isCurrent) {
                    timeText = "Happening Now";
                  } else {
                    const diffMin = startMins - currentMins;
                    if (diffMin > 0 && diffMin < 60) {
                      timeText = `In ${diffMin} min`;
                    } else if (diffMin >= 60) {
                      const h = Math.floor(diffMin / 60);
                      const m = diffMin % 60;
                      timeText = `In ${h}h ${m}m`;
                    }
                  }
                  break;
                }
              } else {
                // Future day
                upcomingClass = dayClasses[0];
                const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                const targetJsDay = checkDay === 7 ? 0 : checkDay;
                timeText = offset === 1 ? "Tomorrow" : (daysOfWeek[targetJsDay] ?? "Upcoming");
                break;
              }
            }

            if (!upcomingClass) {
              return (
                <CXText variant="body" color={colors.textMuted} align="center" style={{ marginVertical: spacing.md }}>
                  You have no upcoming classes! 🎉
                </CXText>
              );
            }

            return (
              <View style={{ gap: spacing.sm }}>
                <Pressable onPress={() => navigation.navigate("Timetable")}>
                  <CXCard style={styles.classCard}>
                    <View style={styles.classIcon}>
                      <Ionicons name="book-outline" size={23} color={colors.primary} />
                    </View>
                    <View style={styles.flex}>
                      <CXText variant="bodyStrong">{upcomingClass.subject || ""}</CXText>
                      <CXText variant="caption" color={colors.textMuted}>
                        {`${upcomingClass.startTime || ""} - ${upcomingClass.endTime || ""} • ${upcomingClass.room || "No room"}`}
                      </CXText>
                    </View>
                    {timeText ? (
                      <View style={styles.timeBadge}>
                        <CXText variant="caption" color={colors.primary}>
                          {timeText}
                        </CXText>
                      </View>
                    ) : null}
                  </CXCard>
                </Pressable>
              </View>
            );
          })()}

        <CXSectionHeader
          title="Campus Events"
          action="See all"
          onAction={() => navigation.navigate("Events")}
        />
        {featured ? (
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
        ) : (
          <CXText variant="body" color={colors.textMuted} align="center" style={{ marginVertical: spacing.md }}>
            No upcoming events right now.
          </CXText>
        )}

        <CXSectionHeader title="Your Progress" />
        <Pressable onPress={() => navigation.navigate("SGPACalculator" as never)}>
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
