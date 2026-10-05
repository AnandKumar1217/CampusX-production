import React, { useState, useMemo } from "react";
import { View, FlatList, RefreshControl, StyleSheet, ActivityIndicator, TextInput, Pressable, Platform } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { CXScreen, CXText, CXButton, CXHeader } from "@/components/ui";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { eventService } from "@/services/eventService";
import { EventCard } from "./components/EventCard";
import { EventDateFilters } from "./components/EventDateFilters";
import { EventSearchBar } from "./components/EventSearchBar";
import { EventItem } from "@/types/domain";
import { getSocket } from "@/services/socket";
const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };

export function EventsScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);
  const [activeDateFilter, setActiveDateFilter] = useState("all");
  const [customDateString, setCustomDateString] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleFilterChange = (f: string) => {
    if (f === "custom") {
      if (Platform.OS === 'android') {
        DateTimePickerAndroid.open({
          value: new Date(),
          mode: 'date',
          onChange: (event, selectedDate) => {
            if (selectedDate) {
              const year = selectedDate.getFullYear();
              const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const day = String(selectedDate.getDate()).padStart(2, '0');
              setCustomDateString(`${year}-${month}-${day}`);
              setActiveDateFilter("custom");
            }
          },
        });
      } else {
        setShowDatePicker(true);
        setActiveDateFilter("custom");
      }
    } else {
      setActiveDateFilter(f);
    }
  };

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["events", "active"],
    queryFn: () => eventService.listEvents(),
  });

  React.useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refreshEvents = () => refetch();
    socket.on("event:created", refreshEvents);
    socket.on("event:updated", refreshEvents);
    socket.on("event:deleted", refreshEvents);
    socket.on("event:cancelled", refreshEvents);
    return () => {
      socket.off("event:created", refreshEvents);
      socket.off("event:updated", refreshEvents);
      socket.off("event:deleted", refreshEvents);
      socket.off("event:cancelled", refreshEvents);
    };
  }, [refetch]);

  const events = data?.items || [];

  const filteredEvents = useMemo(() => {
    let result = events;
    const now = new Date();

    // Apply search
    if (debouncedSearchQuery.trim() !== "") {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q)) ||
        (e.organizer?.name && e.organizer.name.toLowerCase().includes(q))
      );
    }

    // Apply date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // This week (until Sunday)
    const thisWeekEnd = new Date(today);
    thisWeekEnd.setDate(today.getDate() + (7 - today.getDay()));

    // Weekend (Saturday and Sunday)
    const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

    // Hide cancelled events from all normal discovery
    result = result.filter(e => {
      if (!e.startsAt) return false;
      return e.status !== "cancelled";
    });

    if (activeDateFilter === "today") {
      result = result.filter(e => {
        if (!e.startsAt) return false;
        const d = new Date(e.startsAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });
    } else if (activeDateFilter === "tomorrow") {
      result = result.filter(e => {
        if (!e.startsAt) return false;
        const d = new Date(e.startsAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === tomorrow.getTime();
      });
    } else if (activeDateFilter === "this_week") {
      result = result.filter(e => {
        if (!e.startsAt) return false;
        const d = new Date(e.startsAt);
        return d.getTime() >= today.getTime() && d.getTime() <= thisWeekEnd.getTime();
      });
    } else if (activeDateFilter === "weekend") {
      result = result.filter(e => {
        if (!e.startsAt) return false;
        const d = new Date(e.startsAt);
        return d.getTime() >= today.getTime() && isWeekend(d);
      });
    } else if (activeDateFilter === "custom" && customDateString) {
      result = result.filter(e => {
        if (!e.startsAt) return false;
        const d = new Date(e.startsAt);
        const [year, month, day] = customDateString.split("-").map(Number);
        if (!year || !month || !day) return false;
        return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
      });
    }

    // Sort logic: ongoing first, then nearest future date
    result = [...result].sort((a, b) => {
      const dateA = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const dateB = b.startsAt ? new Date(b.startsAt).getTime() : 0;

      const endA = a.endsAt ? new Date(a.endsAt).getTime() : dateA + 7200000;
      const endB = b.endsAt ? new Date(b.endsAt).getTime() : dateB + 7200000;

      const aIsOngoing = dateA <= now.getTime() && endA > now.getTime() && a.status !== "cancelled";
      const bIsOngoing = dateB <= now.getTime() && endB > now.getTime() && b.status !== "cancelled";

      if (aIsOngoing && !bIsOngoing) return -1;
      if (!aIsOngoing && bIsOngoing) return 1;

      return dateA - dateB;
    });

    return result;
  }, [events, debouncedSearchQuery, activeDateFilter, customDateString]);

  const handleEventPress = (event: EventItem) => {
    navigation.navigate("EventDetails", { eventId: event.id });
  };

  return (
    <CXScreen style={styles.container}>
      <CXHeader
        title="Events"
        subtitle="Find what's happening on campus"
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}
            onPress={() => navigation.navigate("CreateEvent")}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        }
      />

      <View style={styles.searchContainer}>
        <EventSearchBar value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      <View style={styles.filterContainer}>
        <EventDateFilters activeFilter={activeDateFilter} onFilterChange={handleFilterChange} />
        {Platform.OS === 'ios' && showDatePicker && (
          <DateTimePicker
            value={new Date()}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                const year = selectedDate.getFullYear();
                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDate.getDate()).padStart(2, '0');
                setCustomDateString(`${year}-${month}-${day}`);
                setActiveDateFilter("custom");
              }
            }}
          />
        )}
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <CXText>Error loading events.</CXText>
          <CXButton label="Retry" onPress={() => refetch()} variant="outline" style={{ marginTop: 16 }} />
        </View>
      ) : filteredEvents.length === 0 ? (
        <View style={styles.centerContainer}>
          <CXText style={styles.emptyText}>No events found.</CXText>
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
            <CXText style={{ fontWeight: '700', color: theme.colors.text, fontSize: 16 }}>Upcoming Events</CXText>
          </View>
          <FlatList
            data={filteredEvents}
            keyExtractor={(item) => item.id ? item.id.toString() : (item as any)._id ? (item as any)._id.toString() : item.title}
            renderItem={({ item, index }) => (
              <EventCard event={item} isFeatured={index === 0} onPress={() => handleEventPress(item)} />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />
            }
          />
        </>
      )}
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  filterContainer: {
    paddingBottom: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  }
});
