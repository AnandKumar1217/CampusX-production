
--- CreateEventScreen.tsx ---
import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { CXHeader, CXScrollScreen, CXText, CXButton } from "@/components/ui";
import { TextInput, View as RNView } from "react-native";
const CustomInput = ({label, ...props}: any) => (<RNView style={{marginBottom: 16}}><CXText variant="caption" style={{marginBottom: 4, fontWeight: "600"}}>{label}</CXText><TextInput style={{borderWidth: 1, borderColor: "#e5e7eb", padding: 12, borderRadius: 8, backgroundColor: "#fff"}} {...props} /></RNView>);
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { eventService } from "@/services/eventService";
const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };
// We would ideally import a DateTimePicker, but standard text inputs or native integrations might be needed here
// I'll assume we use basic string inputs for a prototype, or a placeholder for real date pickers.

export function CreateEventScreen({ navigation, route }: any) {
  const queryClient = useQueryClient();
  const editMode = !!route.params?.event;
  const event = route.params?.event;

  const [form, setForm] = useState({
    title: event?.title || "",
    description: event?.description || "",
    category: event?.category || "",
    location: event?.location || "",
    capacity: event?.capacity?.toString() || "",
    startsAt: event?.startsAt || new Date(Date.now() + 86400000).toISOString().split('T')[0], // tomorrow
    endsAt: event?.endsAt || "",
    registrationDeadline: event?.registrationDeadline || "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (editMode) {
        return eventService.updateEvent(event.id, data);
      }
      return eventService.createEvent(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      if (editMode) {
        queryClient.invalidateQueries({ queryKey: ["event", event.id] });
      }
      navigation.goBack();
    },
    onError: (err: any) => {
      Alert.alert("Error", err.response?.data?.message || "Failed to save event");
    }
  });

  const handleSave = () => {
    if (!form.title || !form.category || !form.location || !form.startsAt) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const payload: any = {
      title: form.title,
      description: form.description,
      category: form.category,
      location: { name: form.location },
      startsAt: new Date(form.startsAt), // expecting YYYY-MM-DD for simple MVP
    };
    
    if (form.endsAt) payload.endsAt = new Date(form.endsAt);
    if (form.capacity) payload.capacity = parseInt(form.capacity, 10);
    if (form.registrationDeadline) payload.registrationDeadline = new Date(form.registrationDeadline);

    mutation.mutate(payload);
  };

  return (
    <CXScrollScreen>
      <CXHeader title={editMode ? "Edit Event" : "Create Event"} onBack={() => navigation.goBack()} />
      <View style={styles.form}>
        <CustomInput 
          label="Event Title *"
          placeholder="What's happening?"
          value={form.title}
          onChangeText={(v: string) => setForm({ ...form, title: v })}
        />
        <CustomInput 
          label="Description"
          placeholder="Tell people about your event..."
          value={form.description}
          onChangeText={(v: string) => setForm({ ...form, description: v })}
          multiline
          numberOfLines={4}
        />
        <CustomInput 
          label="Category *"
          placeholder="e.g. Academic, Tech, Sports"
          value={form.category}
          onChangeText={(v: string) => setForm({ ...form, category: v })}
        />
        <CustomInput 
          label="Location *"
          placeholder="Where is it taking place?"
          value={form.location}
          onChangeText={(v: string) => setForm({ ...form, location: v })}
        />
        <CustomInput 
          label="Starts At (YYYY-MM-DD HH:mm) *"
          placeholder="e.g. 2026-10-15 14:00"
          value={form.startsAt}
          onChangeText={(v: string) => setForm({ ...form, startsAt: v })}
        />
        <CustomInput 
          label="Ends At (Optional)"
          placeholder="e.g. 2026-10-15 16:00"
          value={form.endsAt}
          onChangeText={(v: string) => setForm({ ...form, endsAt: v })}
        />
        <CustomInput 
          label="Max Capacity (Optional)"
          placeholder="e.g. 100"
          keyboardType="numeric"
          value={form.capacity}
          onChangeText={(v: string) => setForm({ ...form, capacity: v })}
        />
        <CustomInput 
          label="Registration Deadline (Optional)"
          placeholder="e.g. 2026-10-14 23:59"
          value={form.registrationDeadline}
          onChangeText={(v: string) => setForm({ ...form, registrationDeadline: v })}
        />
        
        <CXButton 
          label={editMode ? "Save Changes" : "Create Event"} 
          onPress={handleSave} 
          loading={mutation.isPending}
          style={styles.btn}
        />
      </View>
    </CXScrollScreen>
  );
}

const styles = StyleSheet.create({
  form: { padding: 16, gap: 16, paddingBottom: 100 },
  btn: { marginTop: 16 }
});

--- EventDetailsScreen.tsx ---
import React, { useMemo, useState } from "react";
import { View, StyleSheet, Image, ScrollView, ActivityIndicator, Alert, Pressable } from "react-native";
import { CXScrollScreen, CXText, CXButton, CXHeader } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventService } from "@/services/eventService";
import { useAppStore } from "@/store/appStore";
const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };
import { Ionicons } from "@expo/vector-icons";

export function EventDetailsScreen({ navigation, route }: any) {
  const { eventId } = route.params;
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [showOptions, setShowOptions] = useState(false);

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventService.getEvent(eventId),
  });

  const { data: savedEvents = [] } = useQuery({
    queryKey: ["savedEvents"],
    queryFn: () => eventService.getSavedEvents(),
  });

  const isSaved = savedEvents.some(e => e.id === eventId);
  const isOwner = event?.organizer?.id === user?.id || event?.organizer?.id === user?.id;
  const isCancelled = event?.status === "cancelled";
  
  const attendeeRecord = event?.attendees?.find(a => a.user?.id === user?.id || a.user?.id === user?.id);
  const isRegistered = attendeeRecord?.status === "going";
  const isFull = event?.capacity && event?.interested >= event.capacity;
  const isDeadlinePassed = event?.registrationDeadline && new Date(event.registrationDeadline) < new Date();

  const toggleSaveMutation = useMutation({
    mutationFn: (saved: boolean) => eventService.setSaved(eventId, saved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedEvents"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: () => eventService.setAttendance(eventId, isRegistered ? "none" : "going"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err.response?.data?.message || "Failed to update registration");
    }
  });
  
  const cancelEventMutation = useMutation({
    mutationFn: () => eventService.updateEvent(eventId, { status: "cancelled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setShowOptions(false);
    }
  });

  const deleteEventMutation = useMutation({
    mutationFn: () => eventService.deleteEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      navigation.goBack();
    }
  });

  if (isLoading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (isError || !event) return <View style={styles.center}><CXText>Failed to load event.</CXText></View>;

  let dateDisplay = event.date;
  let timeDisplay = event.time;
  if (event.startsAt) {
    const d = new Date(event.startsAt);
    dateDisplay = d.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    timeDisplay = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  const handleRegisterToggle = () => {
    if (!isRegistered && isFull) {
      Alert.alert("Event Full", "Sorry, this event has reached its capacity.");
      return;
    }
    if (!isRegistered && isDeadlinePassed) {
      Alert.alert("Registration Closed", "The registration deadline has passed.");
      return;
    }
    registerMutation.mutate();
  };

  const confirmDelete = () => {
    Alert.alert("Delete Event", "Are you sure you want to permanently delete this event?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteEventMutation.mutate() }
    ]);
  };
  
  const confirmCancel = () => {
    Alert.alert("Cancel Event", "Are you sure you want to cancel this event? Attendees will be notified.", [
      { text: "Back", style: "cancel" },
      { text: "Cancel Event", style: "destructive", onPress: () => cancelEventMutation.mutate() }
    ]);
  };

  return (
    <View style={styles.container}>
      <CXHeader 
        title="" 
        onBack={() => navigation.goBack()} 
        right={
          <View style={styles.headerActions}>
            <Pressable onPress={() => toggleSaveMutation.mutate(!isSaved)} style={styles.iconBtn}>
              <Ionicons name="bookmark" color={isSaved ? theme.colors.primary : theme.colors.text} fill={isSaved ? theme.colors.primary : "transparent"} size={24} / >
            </Pressable>
            {isOwner && (
              <Pressable onPress={() => setShowOptions(!showOptions)} style={styles.iconBtn}>
                <Ionicons name="ellipsis-vertical" color={theme.colors.text} size={24} / >
              </Pressable>
            )}
          </View>
        }
      />
      
      {showOptions && isOwner && (
        <View style={styles.optionsMenu}>
          <Pressable style={styles.optionItem} onPress={() => { setShowOptions(false); navigation.navigate("EditEvent", { event }); }}>
            <Ionicons name="pencil" color={theme.colors.text} size={18} / >
            <CXText style={styles.optionText}>Edit Details</CXText>
          </Pressable>
          <Pressable style={styles.optionItem} onPress={() => { setShowOptions(false); navigation.navigate("EventRegistrations", { eventId }); }}>
            <Ionicons name="people" color={theme.colors.text} size={18} / >
            <CXText style={styles.optionText}>View Registrations</CXText>
          </Pressable>
          {!isCancelled && (
            <Pressable style={styles.optionItem} onPress={confirmCancel}>
              <Ionicons name="close-circle" color={theme.colors.danger} size={18} / >
              <CXText style={[styles.optionText, {color: theme.colors.danger}]}>Cancel Event</CXText>
            </Pressable>
          )}
          <Pressable style={styles.optionItem} onPress={confirmDelete}>
            <Ionicons name="trash" color={theme.colors.danger} size={18} / >
            <CXText style={[styles.optionText, {color: theme.colors.danger}]}>Delete Event</CXText>
          </Pressable>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {event.image ? (
          <Image source={{ uri: event.image as string }} style={styles.heroImage} />
        ) : (
          <View style={styles.placeholderHero}>
            <Ionicons name="calendar" color={theme.colors.primary} size={64} opacity={0.5} / >
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.badges}>
            <View style={styles.categoryBadge}>
              <CXText variant="caption" style={styles.categoryText}>{event.category}</CXText>
            </View>
            {isOwner && (
              <View style={[styles.categoryBadge, {backgroundColor: theme.colors.primary + '20'}]}>
                <CXText variant="caption" style={{color: theme.colors.primary}}>You're the Organizer</CXText>
              </View>
            )}
            {isCancelled && (
              <View style={[styles.categoryBadge, {backgroundColor: theme.colors.danger}]}>
                <CXText variant="caption" style={{color: "#fff", fontWeight: "bold"}}>CANCELLED</CXText>
              </View>
            )}
          </View>
          
          <CXText variant="h2" style={styles.title}>{event.title}</CXText>
          
          <View style={styles.metaSection}>
            <View style={styles.metaRow}>
              <View style={styles.iconBox}><Ionicons name="calendar" color={theme.colors.primary} size={20} / ></View>
              <View>
                <CXText style={styles.metaTitle}>{dateDisplay}</CXText>
                <CXText variant="caption" style={styles.metaSub}>{timeDisplay}</CXText>
              </View>
            </View>
            
            <View style={styles.metaRow}>
              <View style={styles.iconBox}><Ionicons name="location" color={theme.colors.primary} size={20} / ></View>
              <View>
                <CXText style={styles.metaTitle}>{event.location}</CXText>
                <CXText variant="caption" style={styles.metaSub}>View on map</CXText>
              </View>
            </View>
            
            <View style={styles.metaRow}>
              <View style={styles.iconBox}><Ionicons name="people" color={theme.colors.primary} size={20} / ></View>
              <View>
                <CXText style={styles.metaTitle}>
                  {event.interested} {event.capacity ? `/ ${event.capacity}` : ''} Registered
                </CXText>
                {event.capacity && event.interested >= event.capacity && (
                  <CXText variant="caption" style={{color: theme.colors.danger}}>Event is full</CXText>
                )}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <CXText variant="h3" style={styles.sectionTitle}>About</CXText>
            <CXText style={styles.description}>{event.description}</CXText>
          </View>

          <View style={styles.section}>
            <CXText variant="h3" style={styles.sectionTitle}>Organizer</CXText>
            <View style={styles.organizerRow}>
              <Image source={{ uri: event.organizer?.avatarUrl || "https://ui-avatars.com/api/?name=O" }} style={styles.avatar} />
              <View>
                <CXText style={styles.orgName}>{event.organizer?.name}</CXText>
                <CXText variant="caption" style={styles.orgSub}>@{event.organizer?.username}</CXText>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        {!isOwner && (
          <CXButton
            label={isRegistered ? "Cancel Registration" : "Register Now"}
            onPress={handleRegisterToggle}
            variant={isRegistered ? "outline" : "primary"}
            disabled={!!((!isRegistered && isFull) || isCancelled || registerMutation.isPending || (!isRegistered && isDeadlinePassed))}
            style={styles.actionBtn}
            loading={registerMutation.isPending}
          />
        )}
        {isOwner && (
          <CXButton
            label="Manage Registrations"
            onPress={() => navigation.navigate("EventRegistrations", { eventId })}
            variant="primary"
            style={styles.actionBtn}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerActions: { flexDirection: "row", alignItems: "center" },
  iconBtn: { padding: 8, marginLeft: 8 },
  optionsMenu: {
    position: "absolute",
    top: 50,
    right: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    minWidth: 180,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: "500"
  },
  scrollContent: { paddingBottom: 120 },
  heroImage: { width: "100%", height: 240, resizeMode: "cover" },
  placeholderHero: {
    width: "100%", height: 240, backgroundColor: theme.colors.surfaceHover,
    justifyContent: "center", alignItems: "center"
  },
  content: { padding: 20 },
  badges: { flexDirection: "row", gap: 8, marginBottom: 12 },
  categoryBadge: {
    backgroundColor: theme.colors.surfaceHover,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  categoryText: { fontWeight: "600" },
  title: { marginBottom: 24 },
  metaSection: { gap: 16, marginBottom: 32 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  iconBox: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: theme.colors.surface,
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: theme.colors.border
  },
  metaTitle: { fontSize: 16, fontWeight: "600" },
  metaSub: { color: theme.colors.textSecondary },
  section: { marginBottom: 32 },
  sectionTitle: { marginBottom: 12 },
  description: { color: theme.colors.textSecondary, lineHeight: 24 },
  organizerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  orgName: { fontSize: 16, fontWeight: "600" },
  orgSub: { color: theme.colors.textSecondary },
  actionBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: theme.colors.surface,
    padding: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 10,
  },
  actionBtn: { width: "100%" }
});

--- EventRegistrationsScreen.tsx ---
import React from "react";
import { View, FlatList, StyleSheet, ActivityIndicator, Image } from "react-native";
import { CXHeader, CXText } from "@/components/ui";
import { useQuery } from "@tanstack/react-query";
import { eventService } from "@/services/eventService";
const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };

export function EventRegistrationsScreen({ navigation, route }: any) {
  const { eventId } = route.params;

  const { data: registrations, isLoading, isError } = useQuery({
    queryKey: ["eventRegistrations", eventId],
    queryFn: () => eventService.getRegistrations(eventId),
  });

  if (isLoading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (isError) return <View style={styles.center}><CXText>Failed to load registrations.</CXText></View>;

  return (
    <View style={styles.container}>
      <CXHeader title="Registrations" onBack={() => navigation.goBack()} />
      <FlatList
        data={registrations || []}
        keyExtractor={(item: any) => item.user?.id || Math.random().toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <CXText style={{color: theme.colors.textSecondary}}>No registrations yet.</CXText>
          </View>
        }
        renderItem={({ item }: any) => {
          const user = item.user;
          if (!user) return null;
          return (
            <View style={styles.row}>
              <Image source={{ uri: user.avatarUrl || "https://ui-avatars.com/api/?name=U" }} style={styles.avatar} />
              <View style={styles.userInfo}>
                <CXText style={styles.name}>{user.name}</CXText>
                <CXText variant="caption" style={styles.meta}>@{user.username} {user.department ? `• ${user.department}` : ''}</CXText>
              </View>
              <View style={styles.statusBadge}>
                <CXText style={styles.statusText}>Registered</CXText>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16 },
  empty: { padding: 32, alignItems: "center" },
  row: {
    flexDirection: "row", alignItems: "center",
    padding: 16, backgroundColor: theme.colors.surface,
    borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: theme.colors.border
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  userInfo: { flex: 1, marginLeft: 12 },
  name: { fontWeight: "600", fontSize: 16 },
  meta: { color: theme.colors.textSecondary },
  statusBadge: {
    backgroundColor: theme.colors.success + '20',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6
  },
  statusText: { color: theme.colors.success, fontSize: 12, fontWeight: "600" }
});

--- EventsScreen.tsx ---
import React, { useState, useMemo } from "react";
import { View, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from "react-native";
import { CXScrollScreen, CXText, CXButton, CXHeader } from "@/components/ui";
import { useQuery } from "@tanstack/react-query";
import { eventService } from "@/services/eventService";
import { EventCard } from "./components/EventCard";
import { EventDateFilters } from "./components/EventDateFilters";
import { EventSearchBar } from "./components/EventSearchBar";
const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };
import { EventItem } from "@/types/domain";

export function EventsScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDateFilter, setActiveDateFilter] = useState("all");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["events", "active"],
    queryFn: () => eventService.listEvents(),
  });

  const events = data?.items || [];

  const filteredEvents = useMemo(() => {
    let result = events;
    
    // Apply search
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.title.toLowerCase().includes(q) || 
        e.location.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q))
      );
    }
    
    // Apply date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (activeDateFilter === "today") {
      result = result.filter(e => {
        if (!e.startsAt) return false;
        const d = new Date(e.startsAt);
        d.setHours(0,0,0,0);
        return d.getTime() === today.getTime();
      });
    } else if (activeDateFilter === "tomorrow") {
      result = result.filter(e => {
        if (!e.startsAt) return false;
        const d = new Date(e.startsAt);
        d.setHours(0,0,0,0);
        return d.getTime() === tomorrow.getTime();
      });
    }
    // ... we can add more like "this week", "weekend"
    
    // Sort logic: ongoing first, then nearest future date
    result = [...result].sort((a, b) => {
      const dateA = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const dateB = b.startsAt ? new Date(b.startsAt).getTime() : 0;
      return dateA - dateB;
    });

    return result;
  }, [events, searchQuery, activeDateFilter]);

  const handleEventPress = (event: EventItem) => {
    navigation.navigate("EventDetails", { eventId: event.id });
  };

  return (
    <View style={styles.container}>
      <CXHeader 
        title="Events" 
        subtitle="Find what's happening on campus" 
        right={
          <CXButton 
            label="Create" 
            variant="ghost"
            
            onPress={() => navigation.navigate("CreateEvent")} 
          />
        }
      />
      
      <View style={styles.searchContainer}>
        <EventSearchBar value={searchQuery} onChangeText={setSearchQuery} />
      </View>
      
      <View style={styles.filterContainer}>
        <EventDateFilters activeFilter={activeDateFilter} onFilterChange={setActiveDateFilter} />
      </View>
      
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <CXText>Error loading events.</CXText>
          <CXButton label="Retry" onPress={() => refetch()} variant="outline" style={{marginTop: 16}} />
        </View>
      ) : filteredEvents.length === 0 ? (
        <View style={styles.centerContainer}>
          <CXText style={styles.emptyText}>No events found.</CXText>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => handleEventPress(item)} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />
          }
        />
      )}
    </View>
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

--- MyEventsScreen.tsx ---
import React from "react";
import { View, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { CXHeader, CXText } from "@/components/ui";
import { useQuery } from "@tanstack/react-query";
import { eventService } from "@/services/eventService";
import { EventCard } from "./components/EventCard";
import { useAppStore } from "@/store/appStore";
const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };

export function MyEventsScreen({ navigation }: any) {
  const { user } = useAppStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["events", "active"],
    queryFn: () => eventService.listEvents(),
  });

  // Filter events where current user is organizer
  const myEvents = data?.items?.filter(
    e => {
      const orgId = e.organizer?.id || (e.organizer as any)?._id;
      const userId = user?.id || (user as any)?._id;
      return orgId && userId && orgId === userId;
    }
  ) || [];

  if (isLoading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (isError) return <View style={styles.center}><CXText>Error loading events.</CXText></View>;

  return (
    <View style={styles.container}>
      <CXHeader title="My Events" onBack={() => navigation.goBack()} />
      <FlatList
        data={myEvents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <CXText style={{color: theme.colors.textSecondary}}>You haven't created any events yet.</CXText>
          </View>
        }
        renderItem={({ item }) => (
          <EventCard event={item} onPress={() => navigation.navigate("EventDetails", { eventId: item.id })} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16 },
  empty: { padding: 32, alignItems: "center" }
});

--- components/EventCard.tsx ---
import React from "react";
import { View, Pressable, Image, StyleSheet } from "react-native";
import { CXText } from "@/components/ui";
import { EventItem } from "@/types/domain";
const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };
import { Ionicons } from "@expo/vector-icons";

interface EventCardProps {
  event: EventItem;
  onPress: () => void;
}

export function EventCard({ event, onPress }: EventCardProps) {
  // Try to parse startsAt if available, otherwise fallback to date/time strings
  let dateDisplay = event.date;
  let timeDisplay = event.time;
  
  if (event.startsAt) {
    const d = new Date(event.startsAt);
    dateDisplay = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    timeDisplay = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  const isCancelled = event.status === "cancelled";

  return (
    <Pressable 
      onPress={onPress} 
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        isCancelled && styles.cancelled
      ]}
    >
      <View style={styles.imageContainer}>
        {event.image ? (
          <Image source={{ uri: event.image as string }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="calendar" color={theme.colors.primary} size={32} / >
          </View>
        )}
        <View style={styles.dateBadge}>
          <CXText style={styles.dateText}>{dateDisplay.split(" ")[0]}</CXText>
          <CXText style={styles.monthText}>{dateDisplay.split(" ")[1]}</CXText>
        </View>
        {isCancelled && (
          <View style={styles.cancelledBadge}>
            <CXText style={styles.cancelledText}>CANCELLED</CXText>
          </View>
        )}
      </View>
      
      <View style={styles.content}>
        <CXText variant="h3" style={styles.title} numberOfLines={2}>
          {event.title}
        </CXText>
        
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar" color={theme.colors.textSecondary} size={14} / >
            <CXText variant="caption" style={styles.infoText}>{timeDisplay}</CXText>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="location" color={theme.colors.textSecondary} size={14} / >
            <CXText variant="caption" style={styles.infoText} numberOfLines={1}>
              {event.location}
            </CXText>
          </View>
        </View>
        
        <View style={styles.footer}>
          <View style={styles.categoryBadge}>
            <CXText variant="caption" style={styles.categoryText}>{event.category}</CXText>
          </View>
          <View style={styles.interestedGroup}>
            <Ionicons name="people" color={theme.colors.primary} size={14} / >
            <CXText variant="caption" style={styles.interestedText}>
              {event.interested} {event.interested === 1 ? 'going' : 'going'}
            </CXText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  cancelled: {
    opacity: 0.6,
  },
  imageContainer: {
    width: "100%",
    height: 140,
    backgroundColor: theme.colors.background,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceHover,
  },
  dateBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateText: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.primary,
    lineHeight: 20,
  },
  monthText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  cancelledBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: theme.colors.danger,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelledText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 8,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    flex: 1,
  },
  infoText: {
    marginLeft: 4,
    color: theme.colors.textSecondary,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },
  categoryBadge: {
    backgroundColor: theme.colors.surfaceHover,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    color: theme.colors.text,
    fontWeight: "500",
  },
  interestedGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  interestedText: {
    marginLeft: 4,
    color: theme.colors.primary,
    fontWeight: "600",
  },
});

--- components/EventDateFilters.tsx ---
import React from "react";
import { ScrollView, Pressable, StyleSheet } from "react-native";
import { CXText } from "@/components/ui";
const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };

interface EventDateFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const FILTERS = [
  { id: "all", label: "All Events" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this_week", label: "This Week" },
  { id: "weekend", label: "Weekend" },
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
            style={[styles.pill, isActive && styles.pillActive]}
          >
            <CXText style={[styles.text, isActive && styles.textActive]}>
              {f.label}
            </CXText>
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  text: {
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  textActive: {
    color: "#fff",
    fontWeight: "600",
  }
});

--- components/EventSearchBar.tsx ---
import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };

interface EventSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

export function EventSearchBar({ value, onChangeText }: EventSearchBarProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="search" color={theme.colors.textSecondary} size={20} style={styles.icon} / >
      <TextInput
        style={styles.input}
        placeholder="Search events..."
        placeholderTextColor={theme.colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    height: 44,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    color: theme.colors.text,
  }
});
