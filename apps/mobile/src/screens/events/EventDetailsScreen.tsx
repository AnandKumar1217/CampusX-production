import React, { useMemo, useState } from "react";
import { View, StyleSheet, Image, ScrollView, ActivityIndicator, Alert, Pressable , Share, Linking, Platform } from "react-native";
import { CXScrollScreen, CXText, CXButton, CXHeader, CXActionSheet, CXSnackbar, CXScreen } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventService } from "@/services/eventService";
import { useAppStore } from "@/store/appStore";
import { Ionicons } from "@expo/vector-icons";
import { getSocket } from "@/services/socket";
import * as ImagePicker from 'expo-image-picker';
import { api } from "@/services/api";

const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };

export function EventDetailsScreen({ navigation, route }: any) {
  const { eventId } = route.params;
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  const { data: event, isLoading, isError, refetch } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventService.getEvent(eventId),
  });

  React.useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    const onUpdated = (data: any) => {
      if (data.eventId === eventId) refetch();
    };
    const onRegAdded = (data: any) => {
      if (data.eventId === eventId) {
        setSnackbarMessage("New registration for your event!");
        setSnackbarVisible(true);
        refetch();
      }
    };

    socket.on("event:updated", onUpdated);
    socket.on("event:registration_added", onRegAdded);
    
    return () => {
      socket.off("event:updated", onUpdated);
      socket.off("event:registration_added", onRegAdded);
    };
  }, [eventId, refetch]);

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
      setActionSheetVisible(false);
    }
  });

  const deleteEventMutation = useMutation({
    mutationFn: () => eventService.deleteEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      navigation.goBack();
    }
  });

  const updateCoverMutation = useMutation({
    mutationFn: async (imageUri: string) => {
      // 1. Upload to backend
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'cover.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image";
      
      formData.append('file', {
        uri: imageUri,
        name: filename,
        type,
      } as any);

      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const imageUrl = uploadRes.data.data.url;
      const publicId = uploadRes.data.data.publicId;
      
      // 2. Update event with new URL
      return eventService.updateEvent(eventId, { imageUrl: imageUrl, imagePublicId: publicId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setSnackbarMessage("Cover image updated successfully");
      setSnackbarVisible(true);
    },
    onError: () => {
      setSnackbarMessage("Failed to update cover image");
      setSnackbarVisible(true);
    }
  });

  const handleEditCover = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      updateCoverMutation.mutate(result.assets[0].uri);
    }
  };

  if (isLoading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (isError || !event) return <View style={styles.center}><CXText>Failed to load event.</CXText></View>;

  let dateDisplay = event.date || "";
  let timeDisplay = event.time || "";
  if (event.startsAt) {
    const d = new Date(event.startsAt);
    dateDisplay = d.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    timeDisplay = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (event.endsAt) {
      const e = new Date(event.endsAt);
      timeDisplay += " - " + e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
  }

  const handleRegisterToggle = () => {
    if (isRegistered) return;
    if (isFull) {
      setSnackbarMessage("Event Full");
      setSnackbarVisible(true);
      return;
    }
    if (isDeadlinePassed) {
      setSnackbarMessage("Registration Closed");
      setSnackbarVisible(true);
      return;
    }
    registerMutation.mutate();
    setSnackbarMessage("Registered successfully");
    setSnackbarVisible(true);
  };

  const handleShare = async () => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_EVENT_BASE_URL || "https://campusx.example.com";
      const url = `${baseUrl}/events/${eventId}`;
      const loc = (event.location as any)?.name || event.location || "Location TBD";
      
      await Share.share({
        title: event.title,
        message: `${event.title}\n${dateDisplay} • ${timeDisplay}\n${loc}\n\n${url}`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const openMap = () => {
    if (!event.location) return;
    const locName = (event.location as any)?.name || event.location;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(locName)}`,
      android: `geo:0,0?q=${encodeURIComponent(locName)}`
    });
    if (url) Linking.openURL(url).catch(() => {});
  };

  const locationText = (event.location as any)?.name || event.location || "Location not specified";

  return (
    <CXScreen style={styles.container}>
      <CXHeader 
        title="" 
        onBack={() => navigation.goBack()} 
        right={
          <View style={styles.headerActions}>
            <Pressable onPress={handleShare} style={styles.iconBtn}>
              <Ionicons name="share-outline" color={theme.colors.text} size={24} />
            </Pressable>
            {!isOwner && (
              <Pressable onPress={() => { toggleSaveMutation.mutate(!isSaved); setSnackbarMessage(isSaved ? "Removed from Saved Items" : "Saved to Saved Items"); setSnackbarVisible(true); }} style={styles.iconBtn}>
                <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} color={isSaved ? theme.colors.primary : theme.colors.text} size={24} />
              </Pressable>
            )}
            {isOwner && (
              <Pressable onPress={() => setActionSheetVisible(true)} style={styles.iconBtn}>
                <Ionicons name="ellipsis-vertical" color={theme.colors.text} size={24} />
              </Pressable>
            )}
          </View>
        }
      />
      
      <CXActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        actions={[
          { label: "Edit Details", icon: "pencil", onPress: () => { setActionSheetVisible(false); navigation.navigate("EditEvent", { event }); } },
          { label: "View Registrations", icon: "people", onPress: () => { setActionSheetVisible(false); navigation.navigate("EventRegistrations", { eventId }); } },
          { label: "Share Event", icon: "share-social", onPress: () => { setActionSheetVisible(false); handleShare(); } },
          ...(isCancelled ? [] : [{
            label: "Cancel Event", icon: "close-circle" as any, destructive: true, onPress: () => { setActionSheetVisible(false); cancelEventMutation.mutate(); },
            confirmationTitle: "Cancel Event?",
            confirmationMessage: "Are you sure you want to cancel this event? Attendees will be notified.",
            confirmationButtonText: "Cancel Event"
          }]),
          {
            label: "Delete Event", icon: "trash", destructive: true, onPress: () => { setActionSheetVisible(false); deleteEventMutation.mutate(); },
            confirmationTitle: "Delete Event?",
            confirmationMessage: "Are you sure you want to permanently delete this event?",
            confirmationButtonText: "Delete"
          }
        ]}
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroContainer}>
          {event.image ? (
            <Image 
              source={{ uri: event.image as string }} 
              style={styles.heroImage} 
            />
          ) : (
            <View style={styles.placeholderHero}>
              <Ionicons name="image-outline" size={48} color={theme.colors.primary} style={{ opacity: 0.5 }} />
            </View>
          )}
          {isOwner && (
            <Pressable style={styles.editCoverBtn} onPress={handleEditCover}>
              <Ionicons name="camera" size={16} color="#000" />
              <CXText style={styles.editCoverText}>Edit Cover</CXText>
            </Pressable>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.badges}>
            <View style={styles.categoryBadge}>
              <CXText style={styles.categoryText}>{event.category || "General"}</CXText>
            </View>
            {isOwner && (
              <View style={styles.ownerBadge}>
                <CXText style={styles.ownerBadgeText}>You&apos;re the Organizer</CXText>
              </View>
            )}
            {isCancelled && (
              <View style={[styles.categoryBadge, {backgroundColor: theme.colors.danger}]}>
                <CXText style={[styles.categoryText, {color: "#fff"}]}>CANCELLED</CXText>
              </View>
            )}
          </View>
          
          <CXText variant="h2" style={styles.title}>{event.title}</CXText>
          
          <View style={styles.metaSection}>
            <View style={styles.metaRow}>
              <View style={styles.iconBox}><Ionicons name="calendar" color={theme.colors.primary} size={16} /></View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <CXText style={styles.metaTitle}>{dateDisplay}</CXText>
                <CXText style={styles.metaSub}>{timeDisplay}</CXText>
              </View>
            </View>
            
            {event.location ? (
              <Pressable style={styles.metaRow} onPress={openMap}>
                <View style={styles.iconBox}><Ionicons name="location" color={theme.colors.primary} size={16} /></View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <CXText style={styles.metaTitle}>{locationText}</CXText>
                </View>
                <Ionicons name="chevron-forward" color={theme.colors.textSecondary} size={18} />
              </Pressable>
            ) : (
              <View style={styles.metaRow}>
                <View style={styles.iconBox}><Ionicons name="location" color={theme.colors.primary} size={16} /></View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <CXText style={styles.metaTitle}>{locationText}</CXText>
                </View>
              </View>
            )}
            
            <View style={styles.metaRow}>
              <View style={styles.iconBox}><Ionicons name="people" color={theme.colors.primary} size={16} /></View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <CXText style={styles.metaTitle}>{event.interested || 0} registered</CXText>
              </View>
              {event.capacity ? (
                <CXText style={styles.metaSubRight}>{event.capacity} capacity</CXText>
              ) : null}
            </View>
          </View>
          
          {isOwner && (
            <View style={styles.ownerActions}>
              <Pressable 
                style={styles.editBtn} 
                onPress={() => navigation.navigate("EditEvent", { event })}
              >
                <Ionicons name="pencil-outline" size={16} color={theme.colors.primary} style={{marginRight: 6}} />
                <CXText style={styles.editBtnText}>Edit Event</CXText>
              </Pressable>
              
              <Pressable 
                style={styles.manageBtn} 
                onPress={() => setActionSheetVisible(true)}
              >
                <Ionicons name="options-outline" size={16} color="#fff" style={{marginRight: 6}} />
                <CXText style={styles.manageBtnText}>Manage Event</CXText>
              </Pressable>
            </View>
          )}

          {event.description ? (
            <View style={styles.section}>
              <CXText style={styles.sectionTitle}>About</CXText>
              <CXText style={styles.description}>{event.description}</CXText>
            </View>
          ) : null}

          <View style={styles.section}>
            <CXText style={styles.sectionTitle}>Organizer</CXText>
            <Pressable 
              style={styles.organizerRow}
              onPress={() => navigation.navigate("UserProfile", { userId: event.organizer?.id || (event.organizer as any)?._id })}
            >
              <Image source={{ uri: event.organizer?.avatarUrl || "https://ui-avatars.com/api/?name=O" }} style={styles.avatar} />
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <CXText style={styles.orgName}>{event.organizer?.name}</CXText>
                <CXText style={styles.orgSub}>@{event.organizer?.username}</CXText>
              </View>
              <View style={styles.profileBtn}>
                <CXText style={styles.profileBtnText}>View</CXText>
              </View>
            </Pressable>
          </View>

          {isOwner && event.attendees && event.attendees.filter((a: any) => a.status === "going").length > 0 && (
            <View style={styles.section}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <CXText style={styles.sectionTitle}>Recent Registrations ({event.interested})</CXText>
                <Pressable onPress={() => navigation.navigate("EventRegistrations", { eventId })}>
                  <CXText style={{ color: theme.colors.primary, fontWeight: "700", fontSize: 13 }}>View All</CXText>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {event.attendees.filter((a: any) => a.status === "going").slice(0, 5).map((a: any, i: number) => (
                  <Pressable 
                    key={i} 
                    onPress={() => navigation.navigate("UserProfile", { userId: a.user?._id })}
                    style={{ marginLeft: i === 0 ? 0 : -12 }}
                  >
                    <Image source={{ uri: a.user?.avatarUrl || 'https://ui-avatars.com/api/?name=' + a.user?.name }} style={styles.attendeeAvatar} />
                  </Pressable>
                ))}
                {event.interested > 5 && (
                  <View style={styles.attendeeMoreBadge}>
                    <CXText style={styles.attendeeMoreText}>+{event.interested - 5}</CXText>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {!isOwner && (
        <View style={styles.actionBar}>
          <CXButton
            label={isRegistered ? "Registered" : isCancelled ? "Event Cancelled" : isFull ? "Event Full" : isDeadlinePassed ? "Registration Closed" : "Register Now"}
            onPress={handleRegisterToggle}
            variant={isRegistered ? "outline" : "primary"}
            disabled={!!(isRegistered || isFull || isCancelled || registerMutation.isPending || isDeadlinePassed)}
            style={[styles.actionBtn, isRegistered && { backgroundColor: theme.colors.surfaceHover, borderColor: 'transparent' }]}
            loading={registerMutation.isPending}
          />
        </View>
      )}
      <CXSnackbar visible={snackbarVisible} message={snackbarMessage} onDismiss={() => setSnackbarVisible(false)} />
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerActions: { flexDirection: "row", alignItems: "center" },
  iconBtn: { padding: 8, marginLeft: 8 },
  scrollContent: { paddingBottom: 100 },
  heroContainer: { 
    width: "100%", 
    height: 180, 
    borderBottomLeftRadius: 20, 
    borderBottomRightRadius: 20, 
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceHover,
  },
  heroImage: { width: "100%", height: "100%", resizeMode: "cover" },
  placeholderHero: {
    width: "100%", height: 180, backgroundColor: '#f3e8ff',
    justifyContent: "center", alignItems: "center",
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  editCoverBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  editCoverText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  badges: { flexDirection: "row", gap: 6, marginBottom: 12 },
  categoryBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100,
  },
  categoryText: { fontWeight: "700", color: theme.colors.primary, fontSize: 10 },
  ownerBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100,
  },
  ownerBadgeText: { fontWeight: "700", color: theme.colors.success, fontSize: 10 },
  title: { marginBottom: 16, fontSize: 22, fontWeight: "800", lineHeight: 28, color: theme.colors.text, letterSpacing: -0.5 },
  metaSection: { gap: 12, marginBottom: 24 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(124, 58, 237, 0.06)',
    justifyContent: "center", alignItems: "center"
  },
  metaTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text, marginBottom: 2 },
  metaSub: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '500' },
  metaSubRight: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '500' },
  mapBtn: { backgroundColor: theme.colors.surfaceHover, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, alignSelf: 'center' },
  actionLinkText: { color: theme.colors.text, fontSize: 11, fontWeight: '600' },
  ownerActions: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  editBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: theme.colors.surfaceHover, height: 40, borderRadius: 100,
  },
  editBtnText: { color: theme.colors.text, fontWeight: '600', fontSize: 13 },
  manageBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: theme.colors.primary, height: 40, borderRadius: 100,
  },
  manageBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 8, fontSize: 15, fontWeight: "700", color: theme.colors.text, letterSpacing: -0.2 },
  description: { color: theme.colors.textSecondary, lineHeight: 20, fontSize: 13, fontWeight: '400' },
  organizerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  orgName: { fontSize: 14, fontWeight: "600", color: theme.colors.text, marginBottom: 2 },
  orgSub: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '500' },
  profileBtn: { backgroundColor: theme.colors.surfaceHover, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  profileBtnText: { fontSize: 11, fontWeight: '600', color: theme.colors.text },
  attendeeAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: theme.colors.primary },
  attendeeMoreBadge: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.surfaceHover,
    justifyContent: "center", alignItems: "center", marginLeft: -12, borderWidth: 2, borderColor: theme.colors.primary
  },
  attendeeMoreText: { fontSize: 12, fontWeight: "700", color: theme.colors.textSecondary },
  actionBar: {
    position: "absolute", bottom: 12, left: 16, right: 16,
    backgroundColor: '#fff',
    padding: 4,
    borderRadius: 100,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6,
  },
  actionBtn: { width: "100%", height: 44, borderRadius: 100 }
});
