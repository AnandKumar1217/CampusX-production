import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useEffect , useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, View, Alert, Linking } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { CXTripCard, CXUserRow } from "@/components/cards";
import {
  CXAvatar,
  CXButton,
  CXCard,
  CXChip,
  CXHeader,
  CXIconButton,
  CXInput,
  CXListRow,
  CXRow,
  CXScreen,
  CXScrollScreen,
  CXSearchBar,
  CXSectionHeader,
  CXText,
  CXActionSheet,
  CXAlert,
} from "@/components/ui";

import { api, getApiErrorMessage } from "@/services/api";
import { getSocket } from "@/services/socket";
import { colors, radius, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";
import type { Trip, TripMember } from "@/types/domain";
import { useAppStore } from "@/store/appStore";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, Name>;
const entityId = (value: any): string | undefined =>
  typeof value === "string" ? value : value?.id || value?._id?.toString();

export function TripsScreen({ navigation }: StackProps<"Trips">) {
  const queryClient = useQueryClient();
  const user = useAppStore(state => state.user);
  const [search, setSearch] = useState("");
  
  const { data: trips = [], isLoading, refetch } = useQuery({
    queryKey: ["trips", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const res = await api.get<{ data: Trip[] }>("/trips");
      return res.data.data;
    }
  });

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
    };
    const socket = getSocket();
    if (socket) {
      socket.on("trip:invite", handleUpdate);
      socket.on("trip:updated", handleUpdate);
      socket.on("trip:cancelled", handleUpdate);
      socket.on("trip:rsvp", handleUpdate);
      socket.on("trip:memberRemoved", handleUpdate);
    }
    return () => {
      if (socket) {
        socket.off("trip:invite", handleUpdate);
        socket.off("trip:updated", handleUpdate);
        socket.off("trip:cancelled", handleUpdate);
        socket.off("trip:rsvp", handleUpdate);
        socket.off("trip:memberRemoved", handleUpdate);
      }
    };
  }, [queryClient]);

  useFocusEffect(useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["trips", user?.id] });
  }, [queryClient, user?.id]));

  const now = new Date();
  const upcomingTrips = trips.filter((t: Trip) => {
    if (t.status === "cancelled" || t.status === "completed") return false;
    const tripEnd = new Date(t.endDate || t.startDate);
    tripEnd.setHours(23, 59, 59, 999);
    return tripEnd >= now;
  });
  
  const pastTrips = trips.filter((t: Trip) => {
    if (t.status === "cancelled" || t.status === "completed") return true;
    const tripEnd = new Date(t.endDate || t.startDate);
    tripEnd.setHours(23, 59, 59, 999);
    return tripEnd < now;
  });
  const [filter, setFilter] = useState<"Upcoming"|"Past"|"Drafts">("Upcoming");

  const displayTrips = (filter === "Upcoming" ? upcomingTrips : pastTrips).filter(trip =>
    `${trip.title} ${trip.destination}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const deleteMutation = useMutation({
    mutationFn: (tripId: string) => api.delete(`/trips/${tripId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (err) => Alert.alert("Error", getApiErrorMessage(err))
  });

  const [actionSheetTrip, setActionSheetTrip] = useState<Trip | null>(null);

  const handleLongPress = (trip: Trip) => {
    if (filter === "Past" && entityId(trip.createdBy) === user?.id) {
      setActionSheetTrip(trip);
    }
  };

  return (
    <CXScreen edges={["top", "right", "left", "bottom"]}>
      <CXHeader
        title="Trips"
        subtitle="Plan together. Travel forever."
        onBack={navigation.goBack}
        right={
          <CXRow>
            <CXIconButton icon="notifications-outline" label="Trip alerts" backgroundColor={colors.transparent} onPress={() => navigation.navigate("Notifications")} />
          </CXRow>
        }
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXSearchBar placeholder="Search trips or destinations..." value={search} onChangeText={setSearch} />
        <CXRow style={styles.filters}>
          <CXChip label="Upcoming" active={filter === "Upcoming"} onPress={() => setFilter("Upcoming")} />
          <CXChip label="Past" active={filter === "Past"} onPress={() => setFilter("Past")} />
        </CXRow>
        

        
        <CXSectionHeader title={filter + " Trips"} />
        {displayTrips.map((trip: Trip) => (
          <CXTripCard
            key={trip._id}
            trip={trip}
            onPress={() => navigation.navigate("TripDetails", { tripId: trip._id })}
            onLongPress={() => handleLongPress(trip)}
          />
        ))}
        {displayTrips.length === 0 && !isLoading && (
          <CXText color={colors.textMuted} align="center">No {filter.toLowerCase()} trips found.</CXText>
        )}
      </ScrollView>
      <View style={styles.bottomFooter}>
        <CXButton
          label="Create Trip"
          iconLeft="add"
          onPress={() => navigation.navigate("CreateTrip")}
        />
      </View>
      <CXActionSheet
        visible={!!actionSheetTrip}
        onClose={() => setActionSheetTrip(null)}
        title="Trip actions"
        actions={[
          {
            label: "Delete trip",
            icon: "trash-outline",
            destructive: true,
            onPress: () => {
              if (actionSheetTrip) {
                deleteMutation.mutate(actionSheetTrip._id);
                setActionSheetTrip(null);
              }
            },
          },
        ]}
      />
    </CXScreen>
  );
}

export function TripDetailsScreen({ navigation, route }: StackProps<"TripDetails">) {
  const queryClient = useQueryClient();
  const user = useAppStore(state => state.user);
  
  const { data, isLoading } = useQuery({
    queryKey: ["trip", user?.id, route.params.tripId],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const res = await api.get<{ data: { trip: Trip, members: TripMember[], itinerary: any[], votes: any[], expenses: any[] } }>(
        `/trips/${route.params.tripId}`
      );
      return res.data.data;
    }
  });

  useEffect(() => {
    const handleUpdate = (payload: any) => {
      if (payload.tripId === route.params.tripId) {
        queryClient.invalidateQueries({ queryKey: ["trip", user?.id, route.params.tripId] });
        queryClient.invalidateQueries({ queryKey: ["trips", user?.id] });
      }
    };
    const socket = getSocket();
    if (socket) {
      socket.emit("join:trip", { tripId: route.params.tripId });
      socket.on("trip:updated", handleUpdate);
      socket.on("trip:rsvp", handleUpdate);
      socket.on("trip:memberRemoved", handleUpdate);
      socket.on("trip:cancelled", handleUpdate);
      socket.on("trip:update", handleUpdate);
    }
    
    return () => {
      if (socket) {
        socket.off("trip:updated", handleUpdate);
        socket.off("trip:rsvp", handleUpdate);
        socket.off("trip:memberRemoved", handleUpdate);
        socket.off("trip:cancelled", handleUpdate);
        socket.off("trip:update", handleUpdate);
        socket.emit("leave:trip", { tripId: route.params.tripId });
      }
    };
  }, [queryClient, route.params.tripId, user?.id]);

  useFocusEffect(useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["trip", user?.id, route.params.tripId] });
  }, [queryClient, route.params.tripId, user?.id]));

  const rsvpMutation = useMutation({
    mutationFn: (status: "accepted" | "declined") => api.post(`/trips/${route.params.tripId}/rsvp`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", user?.id, route.params.tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
    onError: (err) => Alert.alert("Error", getApiErrorMessage(err))
  });

  const leaveMutation = useMutation({
    mutationFn: () => api.delete(`/trips/${route.params.tripId}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      navigation.goBack();
    },
    onError: (err) => Alert.alert("Error", getApiErrorMessage(err))
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/trips/${route.params.tripId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip", user?.id, route.params.tripId] });
      Alert.alert("Success", "Trip cancelled");
    },
    onError: (err) => Alert.alert("Error", getApiErrorMessage(err))
  });

  if (!data) return (
    <CXScreen>
      <CXHeader title="Trip Details" onBack={navigation.goBack} />
      <CXText align="center" color={colors.textMuted} style={{ margin: spacing.lg }}>
        {isLoading ? "Loading trip..." : "Trip unavailable."}
      </CXText>
    </CXScreen>
  );
  const { trip, members } = data;
  
  const myMember = members.find(m => entityId(m.user) === user?.id);
  const isOrganizer = entityId(trip.createdBy) === user?.id || (myMember?.role === "organizer" && myMember?.status === "accepted");
  
  const acceptedMembers = members.filter(m => m.status === "accepted");
  const pendingMembers = members.filter(m => m.status === "invited");

  return (
    <CXScreen edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.detailPage} bounces={false}>
        <View style={styles.tripHero}>
          {trip.imageUrl ? (
            <Image source={{ uri: trip.imageUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.backgroundLavender }}>
              <Ionicons name="airplane-outline" size={80} color={colors.primary} style={{ opacity: 0.5 }} />
            </View>
          )}
          <LinearGradient colors={["rgba(0,0,0,0.6)", "transparent"]} style={styles.heroOverlay} />
          <View style={styles.heroActions}>
            <CXIconButton icon="chevron-back" label="Go back" backgroundColor="rgba(255,255,255,0.9)" onPress={navigation.goBack} />
            <View style={styles.flex} />
            <CXIconButton icon="share-social-outline" label="Share trip" backgroundColor="rgba(255,255,255,0.9)" />
          </View>
        </View>
        
        <View style={styles.detailCard}>
          <CXRow style={{ alignItems: "flex-start", marginBottom: spacing.xs }}>
            <CXText variant="h1" style={styles.flex}>{trip.title}</CXText>
            <CXChip label={trip.status.toUpperCase()} active={trip.status === "upcoming"} />
          </CXRow>
          
          <CXRow style={{ gap: spacing.xs, marginBottom: spacing.md }}>
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            <CXText variant="smallStrong" color={colors.textMuted}>
              {new Date(trip.startDate).toLocaleDateString()} {trip.endDate ? `– ${new Date(trip.endDate).toLocaleDateString()}` : ""}
            </CXText>
            <CXText variant="small" color={colors.borderSoft}>|</CXText>
            <Pressable 
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
              onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.destination)}`)}
            >
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <CXText variant="smallStrong" color={colors.primary} style={{ textDecorationLine: 'underline' }}>{trip.destination}</CXText>
            </Pressable>
          </CXRow>

          {myMember?.status === "invited" && trip.status !== "cancelled" && (
            <CXCard style={{ backgroundColor: colors.primary, marginBottom: spacing.lg }}>
              <CXText variant="bodyStrong" color={colors.white} style={{ marginBottom: spacing.sm }}>
                You are invited to join this trip!
              </CXText>
              <CXRow>
                <CXButton label="Accept" variant="secondary" size="sm" style={styles.flex} onPress={() => rsvpMutation.mutate("accepted")} loading={rsvpMutation.isPending} />
                <View style={{ width: spacing.sm }} />
                <CXButton label="Decline" variant="outline" size="sm" style={styles.flex} onPress={() => rsvpMutation.mutate("declined")} loading={rsvpMutation.isPending} />
              </CXRow>
            </CXCard>
          )}

          <CXRow style={styles.statsGrid}>
            {[
              ["₹" + (trip.budgetPerPerson || 0), "Budget", "wallet-outline"],
              [trip.tripType || "Standard", "Type", "bus-outline"],
              [acceptedMembers.length.toString(), "Going", "people-outline"],
            ].map(([value, label, icon], i) => (
              <View key={label} style={[styles.statBox, i > 0 && styles.statBoxBorder]}>
                <Ionicons name={icon as any} size={22} color={colors.primary} />
                <CXText variant="bodyStrong" style={{ marginTop: spacing.xs }}>{value}</CXText>
                <CXText variant="caption" color={colors.textMuted}>{label}</CXText>
              </View>
            ))}
          </CXRow>

          {trip.description ? (
            <View style={styles.section}>
              <CXText variant="h3" style={{ marginBottom: spacing.xs }}>About this trip</CXText>
              <CXText variant="body" color={colors.ink} style={{ lineHeight: 22 }}>{trip.description}</CXText>
            </View>
          ) : null}

          <View style={styles.section}>
            <CXText variant="h3" style={{ marginBottom: spacing.sm }}>Organizer</CXText>
            <CXCard style={styles.organizerCard}>
              <CXAvatar source={trip.createdBy.avatarUrl || trip.createdBy.avatar} name={trip.createdBy.name} size={44} />
              <View style={styles.flex}>
                <CXText variant="bodyStrong">{trip.createdBy.name}</CXText>
                <CXText variant="caption" color={colors.textMuted}>Trip Creator</CXText>
              </View>
            </CXCard>
          </View>

          <View style={styles.section}>
            <CXRow style={{ justifyContent: "space-between", marginBottom: spacing.sm }}>
              <CXText variant="h3">Members ({acceptedMembers.length})</CXText>
            </CXRow>
            <Pressable onPress={() => navigation.navigate("InviteToTrip", { tripId: trip._id })}>
              <CXRow style={styles.tripMembersRow}>
                {acceptedMembers.slice(0, 6).map((m, index) => (
                  <View key={entityId(m.user)} style={{ marginLeft: index ? -12 : 0 }}>
                    <CXAvatar source={m.user.avatarUrl || m.user.avatar} name={m.user.name} size={38} />
                  </View>
                ))}
                {acceptedMembers.length > 6 && (
                  <View style={[styles.moreMembersBadge, { marginLeft: -12 }]}>
                    <CXText variant="caption" color={colors.primary}>+{acceptedMembers.length - 6}</CXText>
                  </View>
                )}
                {acceptedMembers.length === 0 && (
                  <CXText variant="body" color={colors.textMuted}>No members yet.</CXText>
                )}
              </CXRow>
            </Pressable>
          </View>
          
          <View style={styles.section}>
            <CXText variant="h3" style={{ marginBottom: spacing.sm }}>Planning</CXText>
            <CXListRow
              icon="people-outline"
              title="Manage Invitations"
              subtitle={`${pendingMembers.length} pending requests`}
              onPress={() => navigation.navigate("InviteToTrip", { tripId: trip._id })}
            />
          </View>

        </View>
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      <View style={styles.bottomFooter}>
        {isOrganizer && trip.status !== "cancelled" ? (
          <CXRow style={{ gap: spacing.sm }}>
            <CXButton label="Edit" variant="secondary" style={styles.flex} onPress={() => navigation.navigate("EditTrip", { tripId: trip._id })} />
            <CXButton label="Cancel" variant="outline" style={styles.flex} onPress={() => cancelMutation.mutate()} loading={cancelMutation.isPending} />
          </CXRow>
        ) : !isOrganizer && myMember?.status === "accepted" ? (
           <CXButton label="Leave Trip" variant="outline" onPress={() => leaveMutation.mutate()} loading={leaveMutation.isPending} />
        ) : (
          <CXText variant="caption" color={colors.textMuted} align="center">You are viewing this trip.</CXText>
        )}
      </View>
    </CXScreen>
  );
}

export function CreateTripScreen({ navigation }: StackProps<"CreateTrip">) {
  const queryClient = useQueryClient();
  const user = useAppStore(state => state.user);
  
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: "",
    destination: "",
    startDate: new Date(),
    endDate: new Date(),
    tripType: "Overnight",
    meetingPoint: "",
    budget: "",
    description: ""
  });
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  const { data: friends = [] } = useQuery({
    queryKey: ["friends", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const res = await api.get<any>("/friends");
      return res.data.data;
    }
  });
  
  const [alertState, setAlertState] = useState({ visible: false, title: "", message: "", type: "error" as any });

  const createMutation = useMutation({
    mutationFn: async () => {
      const tripRes = await api.post<any>("/trips", {
        ...form,
        budget: Number(form.budget) || 0
      });
      const newTrip = tripRes.data.data;
      if (selectedFriends.length > 0) {
        await api.post(`/trips/${newTrip._id}/invites`, { userIds: selectedFriends });
      }
      return newTrip;
    },
    onSuccess: (trip) => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      navigation.replace("TripDetails", { tripId: trip._id });
    },
    onError: (err) => setAlertState({ visible: true, title: "Error", message: getApiErrorMessage(err), type: "error" })
  });

  const nextStep = () => {
    if (step === 1 && (!form.title.trim() || !form.destination.trim())) {
      setAlertState({ visible: true, title: "Trip details required", message: "Enter a trip name and destination.", type: "error" });
      return;
    }
    if (step === 1 && form.endDate < form.startDate) {
      setAlertState({ visible: true, title: "Invalid dates", message: "End date must be on or after the start date.", type: "error" });
      return;
    }
    setStep(s => s + 1);
  };
  const prevStep = () => setStep(s => s - 1);
  const submit = () => createMutation.mutate();

  return (
    <CXScreen>
      <CXHeader title="Create Trip" subtitle={`Step ${step} of 3`} onBack={navigation.goBack} />
      
      <CXScrollScreen padded>
        <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
          {step === 1 && (
            <>
              <CXText variant="h2">Trip Details</CXText>
              <CXInput label="Trip Name" placeholder="e.g. Goa Vacation" value={form.title} onChangeText={t => setForm({...form, title: t})} />
              <CXInput label="Destination" placeholder="Where to?" value={form.destination} onChangeText={t => setForm({...form, destination: t})} />
              
              <CXText variant="smallStrong">Start Date</CXText>
              <CXButton 
                label={form.startDate.toDateString()} 
                variant="outline"
                onPress={() => {
                  DateTimePickerAndroid.open({
                    value: form.startDate,
                    mode: "date",
                    onChange: (_, date) => date && setForm({...form, startDate: date})
                  });
                }}
              />

              <CXText variant="smallStrong">End Date</CXText>
              <CXButton 
                label={form.endDate.toDateString()} 
                variant="outline"
                onPress={() => {
                  DateTimePickerAndroid.open({
                    value: form.endDate,
                    mode: "date",
                    onChange: (_, date) => date && setForm({...form, endDate: date})
                  });
                }}
              />
              
              <CXInput label="Description (Optional)" placeholder="Trip vibe..." value={form.description} onChangeText={t => setForm({...form, description: t})} />
            </>
          )}
          
          {step === 2 && (
            <>
              <CXText variant="h2">Planning & Logistics</CXText>
              <CXInput label="Meeting Point" placeholder="e.g. Airport Gate 2" value={form.meetingPoint} onChangeText={t => setForm({...form, meetingPoint: t})} />
              <CXInput label="Budget Per Person" placeholder="₹" keyboardType="numeric" value={form.budget} onChangeText={t => setForm({...form, budget: t})} />
              <CXText variant="smallStrong">Trip Type</CXText>
              <CXRow style={{ gap: spacing.xs }}>
                {(["Day Trip", "Overnight", "Multi-day"] as const).map(type => (
                  <CXChip key={type} label={type} active={form.tripType === type} onPress={() => setForm({ ...form, tripType: type })} />
                ))}
              </CXRow>
            </>
          )}
          
          {step === 3 && (
            <>
              <CXText variant="h2">Invite Friends</CXText>
              <CXText variant="body" color={colors.textMuted}>Select friends to invite to this trip.</CXText>
              
              {friends.map((friend: any) => {
                const friendId = entityId(friend);
                if (!friendId) return null;
                const isSelected = selectedFriends.includes(friendId);
                return (
                  <Pressable 
                    key={friendId}
                    style={[styles.friendSelectRow, isSelected ? styles.friendSelectRowActive : {}]}
                    onPress={() => {
                      setSelectedFriends(prev => 
                        isSelected ? prev.filter(id => id !== friendId) : [...prev, friendId]
                      );
                    }}
                  >
                    <CXAvatar source={friend.avatarUrl} name={friend.name} />
                    <CXText style={styles.flex}>{friend.name}</CXText>
                    {isSelected && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
                    {!isSelected && <Ionicons name="ellipse-outline" size={24} color={colors.border} />}
                  </Pressable>
                );
              })}
            </>
          )}
        </View>
      </CXScrollScreen>
      
      <View style={styles.bottomFooter}>
        <CXRow>
          {step > 1 && <CXButton label="Back" variant="outline" style={styles.flex} onPress={prevStep} />}
          {step > 1 && <View style={{ width: spacing.sm }} />}
          {step < 3 ? (
             <CXButton label="Next" style={styles.flex} onPress={nextStep} />
          ) : (
             <CXButton label="Create Trip" style={styles.flex} onPress={submit} loading={createMutation.isPending} />
          )}
        </CXRow>
      </View>
      <CXAlert 
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onClose={() => setAlertState(s => ({ ...s, visible: false }))}
      />
    </CXScreen>
  );
}

export function EditTripScreen({ navigation, route }: StackProps<"EditTrip">) {
  const queryClient = useQueryClient();
  const userId = useAppStore(state => state.user?.id);
  const tripId = route.params.tripId;
  const { data, isLoading } = useQuery({
    queryKey: ["trip", userId, tripId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await api.get<{ data: { trip: Trip } }>(`/trips/${tripId}`);
      return response.data.data;
    },
  });
  const [form, setForm] = useState({
    title: "",
    destination: "",
    description: "",
    meetingPoint: "",
    departureTime: "",
    tripType: "Overnight" as NonNullable<Trip["tripType"]>,
    budget: "",
    startDate: new Date(),
    endDate: new Date(),
  });

  useEffect(() => {
    if (!data?.trip) return;
    const trip = data.trip;
    setForm({
      title: trip.title,
      destination: trip.destination,
      description: trip.description || "",
      meetingPoint: trip.meetingPoint || "",
      departureTime: trip.departureTime || "",
      tripType: trip.tripType || "Overnight",
      budget: trip.budgetPerPerson?.toString() || "",
      startDate: new Date(trip.startDate),
      endDate: new Date(trip.endDate || trip.startDate),
    });
  }, [data?.trip]);
  
  const [alertState, setAlertState] = useState({ visible: false, title: "", message: "", type: "error" as any });

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/trips/${tripId}`, {
      title: form.title.trim(),
      destination: form.destination.trim(),
      description: form.description.trim(),
      meetingPoint: form.meetingPoint.trim(),
      departureTime: form.departureTime.trim(),
      tripType: form.tripType,
      budgetPerPerson: Number(form.budget) || 0,
      startDate: form.startDate.toISOString(),
      endDate: form.endDate.toISOString(),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["trip", userId, tripId] });
      void queryClient.invalidateQueries({ queryKey: ["trips", userId] });
      navigation.goBack();
    },
    onError: error => setAlertState({ visible: true, title: "Could not save trip", message: getApiErrorMessage(error), type: "error" }),
  });
  const save = () => {
    if (!form.title.trim() || !form.destination.trim()) {
      setAlertState({ visible: true, title: "Trip details required", message: "Enter a trip name and destination.", type: "error" });
      return;
    }
    if (form.endDate < form.startDate) {
      setAlertState({ visible: true, title: "Invalid dates", message: "End date must be on or after the start date.", type: "error" });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <CXScreen>
      <CXHeader title="Edit Trip" onBack={navigation.goBack} />
      {isLoading || !data ? (
        <CXText align="center" color={colors.textMuted} style={{ margin: spacing.lg }}>
          {isLoading ? "Loading trip..." : "Trip unavailable."}
        </CXText>
      ) : (
        <CXScrollScreen padded>
          <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
            <CXInput label="Trip Name" value={form.title} onChangeText={title => setForm({ ...form, title })} />
            <CXInput label="Destination" value={form.destination} onChangeText={destination => setForm({ ...form, destination })} />
            <CXInput label="Description" value={form.description} onChangeText={description => setForm({ ...form, description })} />
            <CXButton label={`Start: ${form.startDate.toDateString()}`} variant="outline" onPress={() => DateTimePickerAndroid.open({
              value: form.startDate,
              mode: "date",
              onChange: (_, date) => date && setForm(previous => ({ ...previous, startDate: date })),
            })} />
            <CXButton label={`End: ${form.endDate.toDateString()}`} variant="outline" onPress={() => DateTimePickerAndroid.open({
              value: form.endDate,
              mode: "date",
              onChange: (_, date) => date && setForm(previous => ({ ...previous, endDate: date })),
            })} />
            <CXInput label="Meeting Point" value={form.meetingPoint} onChangeText={meetingPoint => setForm({ ...form, meetingPoint })} />
            <CXInput label="Departure Time" value={form.departureTime} onChangeText={departureTime => setForm({ ...form, departureTime })} />
            <CXInput label="Budget Per Person" keyboardType="numeric" value={form.budget} onChangeText={budget => setForm({ ...form, budget })} />
            <CXText variant="smallStrong">Trip Type</CXText>
            <CXRow style={{ gap: spacing.xs }}>
              {(["Day Trip", "Overnight", "Multi-day"] as const).map(type => (
                <CXChip key={type} label={type} active={form.tripType === type} onPress={() => setForm({ ...form, tripType: type })} />
              ))}
            </CXRow>
            <CXButton label="Save Changes" onPress={save} loading={saveMutation.isPending} />
          </View>
        </CXScrollScreen>
      )}
      <CXAlert 
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onClose={() => setAlertState(s => ({ ...s, visible: false }))}
      />
    </CXScreen>
  );
}

export function InviteToTripScreen({ navigation, route }: StackProps<"InviteToTrip">) {
  const queryClient = useQueryClient();
  const user = useAppStore(state => state.user);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  
  const { data: tripData } = useQuery({
    queryKey: ["trip", route.params.tripId],
    queryFn: async () => {
      const res = await api.get<any>(`/trips/${route.params.tripId}`);
      return res.data.data;
    }
  });
  
  const { data: friends = [] } = useQuery({
    queryKey: ["friends", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const res = await api.get<any>("/friends");
      return res.data.data;
    }
  });

  const inviteMutation = useMutation({
    mutationFn: (userIds: string[]) => api.post(`/trips/${route.params.tripId}/invites`, { userIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", route.params.tripId] });
      navigation.goBack();
      Alert.alert("Success", "Invites sent!");
    },
    onError: (err) => Alert.alert("Error", getApiErrorMessage(err))
  });
  
  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/trips/${route.params.tripId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", route.params.tripId] });
    },
    onError: (err) => Alert.alert("Error", getApiErrorMessage(err))
  });

  if (!tripData) return null;
  const existingMemberIds = tripData.members.map((m: any) => entityId(m.user));
  const isOrganizer = entityId(tripData.trip.createdBy) === user?.id;

  return (
    <CXScreen>
      <CXHeader title="Manage Members" subtitle="Invite friends or manage participants" onBack={navigation.goBack} />
      <CXScrollScreen padded>
        <CXSectionHeader title="Current Members" />
        {tripData.members.map((m: any) => (
          <CXUserRow
            key={entityId(m.user)}
            user={m.user}
            subtitle={`${m.role} • ${m.status}`}
            onRemove={isOrganizer && entityId(m.user) !== user?.id ? () => removeMutation.mutate(entityId(m.user)!) : undefined}
            onPress={() => navigation.navigate("UserProfile" as any, { userId: entityId(m.user) })}
            action=""
          />
        ))}
        
        {isOrganizer && (
          <>
            <CXSectionHeader title="Invite Friends" />
            {friends.map((friend: any) => {
              const friendId = entityId(friend);
              if (!friendId || existingMemberIds.includes(friendId)) return null;
              const isSelected = selectedFriends.includes(friendId);
              return (
                <Pressable 
                  key={friendId}
                  style={[styles.friendSelectRow, isSelected ? styles.friendSelectRowActive : {}]}
                  onPress={() => {
                    setSelectedFriends(prev => 
                      isSelected ? prev.filter(id => id !== friendId) : [...prev, friendId]
                    );
                  }}
                >
                  <CXAvatar source={friend.avatarUrl} name={friend.name} />
                  <CXText style={styles.flex}>{friend.name}</CXText>
                  {isSelected && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
                  {!isSelected && <Ionicons name="ellipse-outline" size={24} color={colors.border} />}
                </Pressable>
              );
            })}
          </>
        )}
      </CXScrollScreen>
      
      {isOrganizer && selectedFriends.length > 0 && (
        <View style={styles.bottomFooter}>
          <CXButton 
            label={`Invite ${selectedFriends.length} friends`} 
            onPress={() => inviteMutation.mutate(selectedFriends)}
            loading={inviteMutation.isPending}
          />
        </View>
      )}
    </CXScreen>
  );
}

export function TripItineraryScreen({ navigation }: StackProps<"TripItinerary">) {
  return (
    <CXScreen>
      <CXHeader title="Trip Itinerary" subtitle="Coming soon" onBack={navigation.goBack} />
      <View style={{ padding: spacing.md }}><CXText>Itinerary feature is a work in progress.</CXText></View>
    </CXScreen>
  );
}
export function TripVotingScreen({ navigation }: StackProps<"TripVoting">) {
  return (
    <CXScreen>
      <CXHeader title="Trip Voting" subtitle="Coming soon" onBack={navigation.goBack} />
      <View style={{ padding: spacing.md }}><CXText>Voting feature is a work in progress.</CXText></View>
    </CXScreen>
  );
}
export function TripExpensesScreen({ navigation }: StackProps<"TripExpenses">) {
  return (
    <CXScreen>
      <CXHeader title="Trip Expenses" subtitle="Coming soon" onBack={navigation.goBack} />
      <View style={{ padding: spacing.md }}><CXText>Expenses feature is a work in progress.</CXText></View>
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  detailPage: { paddingBottom: 0 },
  bottomFooter: { padding: spacing.md, backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.borderSoft },
  tripHero: { height: 320, backgroundColor: colors.backgroundLavender, position: "relative" },
  heroOverlay: { position: "absolute", top: 0, left: 0, right: 0, height: 120 },
  heroActions: { position: "absolute", top: 50, left: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", zIndex: 10 },
  detailCard: { 
    marginTop: -48, 
    backgroundColor: colors.background, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: spacing.lg, 
    paddingBottom: spacing.xxxl,
    minHeight: 500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  section: { marginTop: spacing.xl },
  flex: { flex: 1 },
  filters: { gap: spacing.sm },
  statsGrid: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSoft, paddingVertical: spacing.md, marginTop: spacing.md },
  statBox: { flex: 1, alignItems: "center", paddingHorizontal: spacing.sm },
  statBoxBorder: { borderLeftWidth: 1, borderColor: colors.borderSoft },
  organizerCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, elevation: 0, borderWidth: 1, borderColor: colors.borderSoft },
  tripMembersRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs },
  moreMembersBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.background },
  friendSelectRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.transparent },
  friendSelectRowActive: { borderColor: colors.primary, backgroundColor: colors.primary + "10" }
});
