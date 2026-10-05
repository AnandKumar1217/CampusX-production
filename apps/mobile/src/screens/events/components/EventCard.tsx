import React from "react";
import { View, Pressable, Image, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { CXText } from "@/components/ui";
import { EventItem } from "@/types/domain";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };

interface EventCardProps {
  event: EventItem;
  isFeatured?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export function EventCard({ event, isFeatured = false, onPress, onLongPress }: EventCardProps) {
  let dateDisplay = event.date || "";
  let timeDisplay = event.time || "";
  
  if (event.startsAt) {
    const d = new Date(event.startsAt);
    dateDisplay = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    timeDisplay = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    
    // Add end time if available like in the image "10:00 AM - 12:00 PM"
    if (event.endsAt) {
      const e = new Date(event.endsAt);
      timeDisplay += " - " + e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
  }

  const dateParts = dateDisplay.split(" ");
  const day = dateParts[0] || "";
  const month = dateParts[1] || "";

  const isCancelled = event.status === "cancelled";
  // Just a fake "LIVE NOW" check for the first item or items currently happening
  const now = new Date();
  const startTime = event.startsAt ? new Date(event.startsAt) : null;
  const endTime = event.endsAt ? new Date(event.endsAt) : (startTime ? new Date(startTime.getTime() + 2 * 60 * 60 * 1000) : null);
  const isLive = startTime && endTime && startTime <= now && endTime > now;

  return (
    <Pressable 
      onPress={onPress} 
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        !isFeatured && styles.cardSmall,
        pressed && styles.pressed,
        isCancelled && styles.cancelled
      ]}
    >
      <View style={[styles.imageContainer, !isFeatured && styles.imageContainerSmall]}>
        {event.image ? (
          <Image 
            source={{ uri: event.image as string }} 
            style={styles.image} 
          />
        ) : (
          <View style={[styles.image, { backgroundColor: theme.colors.surfaceHover, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="calendar-outline" size={32} color={theme.colors.textSecondary} style={{ opacity: 0.5 }} />
          </View>
        )}

        {isFeatured && (
          <View style={styles.dateBadgeContainer}>
            <CXText style={styles.monthText}>{month}</CXText>
            <CXText style={styles.dateText}>{day}</CXText>
          </View>
        )}

        {isLive && !isCancelled && (
          <View style={[styles.liveBadge, !isFeatured && styles.liveBadgeSmall]}>
            <CXText style={styles.liveText}>LIVE NOW</CXText>
          </View>
        )}
        
        {isCancelled && (
          <View style={[styles.liveBadge, !isFeatured && styles.liveBadgeSmall, { backgroundColor: theme.colors.danger }]}>
            <CXText style={styles.liveText}>CANCELLED</CXText>
          </View>
        )}
      </View>
      
      <View style={[styles.content, !isFeatured && styles.contentSmall]}>
        <View style={styles.titleRow}>
          <CXText variant="h3" style={[styles.title, !isFeatured && styles.titleSmall]} numberOfLines={1}>
            {event.title}
          </CXText>
        </View>
        
        <View style={[styles.infoRow, !isFeatured && styles.infoRowSmall]}>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" color={theme.colors.textSecondary} size={14} style={{marginRight: 4}} />
            <CXText variant="caption" style={styles.infoText}>{isFeatured ? timeDisplay : `${day} ${month} • ${timeDisplay}`}</CXText>
          </View>
          {isFeatured && (
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" color={theme.colors.textSecondary} size={14} style={{marginRight: 4}} />
              <CXText variant="caption" style={styles.infoText} numberOfLines={1}>
                {typeof event.location === 'object' ? (event.location as any).name : event.location || "Location not specified"}
              </CXText>
            </View>
          )}
        </View>
        
        <View style={styles.footer}>
          <View style={[styles.categoryBadge, !isFeatured && styles.categoryBadgeSmall]}>
            <CXText variant="caption" style={[styles.categoryText, !isFeatured && { fontSize: 8 }]}>{event.category || "General"}</CXText>
          </View>
          
          <View style={styles.interestedGroup}>
            <Ionicons name="people" color={theme.colors.primary} size={isFeatured ? 14 : 12} style={{ marginRight: 4 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CXText style={[styles.interestedCount, !isFeatured && { fontSize: 10 }]}>{event.interested || 0}</CXText>
              <CXText style={[styles.interestedText, !isFeatured && { fontSize: 10 }]}> going</CXText>
            </View>
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
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    overflow: "hidden",
  },
  cardSmall: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 12,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  cancelled: {
    opacity: 0.7,
  },
  imageContainer: {
    width: "100%",
    height: 100,
    backgroundColor: theme.colors.surfaceHover,
    position: "relative",
  },
  imageContainerSmall: {
    width: 90,
    height: 90,
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
  },
  dateBadgeContainer: {
    position: "absolute",
    top: 6,
    right: 6,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    paddingVertical: 4,
    paddingHorizontal: 5,
    alignItems: "center",
  },
  dateText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    color: '#000',
  },
  monthText: {
    fontSize: 7,
    lineHeight: 8,
    color: theme.colors.primary,
    textTransform: "uppercase",
    fontWeight: "800",
    marginBottom: 0,
    letterSpacing: 0.5,
  },
  liveBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: '#f43f5e', // rose-500
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  liveBadgeSmall: {
    top: 4,
    left: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  liveText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  content: {
    padding: 10,
  },
  contentSmall: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontWeight: "800",
    fontSize: 14,
    color: '#000',
    flex: 1,
    marginRight: 8,
  },
  titleSmall: {
    fontSize: 14,
    marginBottom: 0,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  infoRowSmall: {
    marginBottom: 4,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  infoText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '500',
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryText: {
    color: theme.colors.primary,
    fontWeight: "800",
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  interestedGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  interestedText: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: '600',
  },
  interestedCount: {
    fontWeight: '800', 
    color: theme.colors.text, 
    fontSize: 10,
  }
});
