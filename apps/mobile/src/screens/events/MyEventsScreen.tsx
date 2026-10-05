import React, { useState } from "react";
import { View, FlatList, ActivityIndicator, StyleSheet, Modal, Pressable } from "react-native";
import { CXScreen, CXHeader, CXText, CXButton } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventService } from "@/services/eventService";
import { EventCard } from "./components/EventCard";
import { useAppStore } from "@/store/appStore";
import { Ionicons } from "@expo/vector-icons";
import { EventItem } from "@/types/domain";

const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };

export function MyEventsScreen({ navigation }: any) {
  const { user } = useAppStore();
  const queryClient = useQueryClient();
  const [eventToDelete, setEventToDelete] = useState<EventItem | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["events", "active"],
    queryFn: () => eventService.listEvents(),
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => eventService.deleteEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", "active"] });
      setEventToDelete(null);
    }
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
    <CXScreen style={styles.container}>
      <CXHeader title="My Events" onBack={() => navigation.goBack()} />
      <FlatList
        data={myEvents}
        keyExtractor={(item) => item.id ? item.id.toString() : (item as any)._id ? (item as any)._id.toString() : item.title}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <CXText style={{color: theme.colors.textSecondary}}>You haven&apos;t created any events yet.</CXText>
          </View>
        }
        renderItem={({ item }) => (
          <EventCard 
             event={item} 
             onPress={() => navigation.navigate("EventDetails", { eventId: item.id })} 
             onLongPress={() => setEventToDelete(item)}
          />
        )}
      />

      <Modal
        visible={!!eventToDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setEventToDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setEventToDelete(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="trash-outline" size={32} color={theme.colors.danger} />
            </View>
            <CXText variant="h3" style={styles.modalTitle}>Delete Event</CXText>
            <CXText style={styles.modalMessage} align="center">
              Are you sure you want to delete <CXText variant="bodyStrong">&quot;{eventToDelete?.title}&quot;</CXText>? This action cannot be undone.
            </CXText>
            <View style={styles.modalActions}>
              <CXButton 
                label="Cancel" 
                variant="outline" 
                onPress={() => setEventToDelete(null)}
                style={styles.modalButton}
                fullWidth={false}
              />
              <CXButton 
                label={deleteMutation.isPending ? "Deleting..." : "Delete"} 
                variant="primary" 
                onPress={() => eventToDelete?.id && deleteMutation.mutate(eventToDelete.id)}
                style={[styles.modalButton, { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger }]}
                disabled={deleteMutation.isPending}
                fullWidth={false}
              />
            </View>
          </View>
        </View>
      </Modal>
    </CXScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16 },
  empty: { padding: 32, alignItems: "center" },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)"
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: "85%",
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16
  },
  modalTitle: {
    marginBottom: 8,
    color: theme.colors.text
  },
  modalMessage: {
    color: theme.colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    justifyContent: "center"
  },
  modalButton: {
    minWidth: 120
  }
});
