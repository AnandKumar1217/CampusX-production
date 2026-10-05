import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/theme";
import type { EventItem, Listing, Trip } from "@/types/domain";

import { CXAvatar, CXCard, CXRow, CXText } from "../ui";

export function CXEventCard({
  event,
  onPress,
  featured,
  saved = false,
  onToggleSave,
}: {
  event: EventItem;
  onPress?: () => void;
  featured?: boolean;
  saved?: boolean;
  onToggleSave?: () => void;
}) {

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => pressed && styles.pressed}
    >
      <CXCard style={[styles.eventCard, featured && styles.featured]}>
        {event.image ? (
          <Image
            source={event.image}
            contentFit="cover"
            style={featured ? styles.featuredImage : styles.eventImage}
          />
        ) : null}
        <View style={[styles.flex, featured && { padding: spacing.sm }]}>
          <CXText variant={featured ? "title" : "bodyStrong"} numberOfLines={2}>
            {event.title}
          </CXText>
          <CXText variant="caption" color={colors.primary}>
            {event.date} · {event.time}
          </CXText>
          <CXRow style={{ gap: spacing.xs }}>
            <CXText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
              <Ionicons name="location-outline" size={11} /> {event.location}
            </CXText>
            {event.distance !== undefined && (
              <CXText variant="caption" color={colors.primary}>
                {event.distance.toFixed(1)} km
              </CXText>
            )}
          </CXRow>
        </View>
        {!featured ? (
          <Pressable 
            onPress={(e) => {
              e.stopPropagation();
              onToggleSave?.();
            }}
            style={({ pressed }) => pressed && { opacity: 0.5 }}
          >
            <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={18} color={colors.primary} />
          </Pressable>
        ) : null}
      </CXCard>
    </Pressable>
  );
}

export function CXListingCard({
  listing,
  onPress,
  compact,
}: {
  listing: Listing;
  onPress?: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        compact ? styles.listingCompact : styles.listing,
        pressed && styles.pressed,
      ]}
    >
      {listing.images?.[0] ? (
        <Image
          source={{ uri: listing.images[0] }}
          contentFit="cover"
          style={compact ? styles.listingCompactImage : styles.listingImage}
        />
      ) : null}
      <View style={styles.listingBody}>
        <CXText variant="bodyStrong" numberOfLines={2}>
          {listing.title}
        </CXText>
        <CXText variant="title" color={colors.primary}>
          ₹{listing.price.toLocaleString("en-IN")}
        </CXText>
        <CXText variant="caption" color={colors.textMuted} numberOfLines={1}>
          {listing.category} · {listing.seller.name}
        </CXText>
      </View>
    </Pressable>
  );
}

export function CXTripCard({
  trip,
  onPress,
  onLongPress,
  featured,
}: {
  trip: Trip;
  onPress?: () => void;
  onLongPress?: () => void;
  featured?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      style={({ pressed }) => pressed && styles.pressed}
    >
      <CXCard style={[styles.tripCard, featured && styles.tripFeatured]}>
        {trip.imageUrl || trip.image ? (
          <Image
            source={trip.imageUrl || trip.image}
            contentFit="cover"
            style={featured ? styles.tripHero : styles.tripImage}
          />
        ) : null}
        <View style={styles.tripBody}>
          <CXText variant={featured ? "title" : "bodyStrong"}>
            {trip.title}
          </CXText>
          <CXText variant="caption" color={colors.textMuted}>
            {new Date(trip.startDate).toLocaleDateString()} · {trip.destination}
          </CXText>
          <CXRow style={styles.tripMeta}>
            <CXRow style={styles.avatarStack}>
              {trip.createdBy?.name ? (
                <>
                  <CXAvatar source={trip.createdBy.avatarUrl || trip.createdBy.avatar} name={trip.createdBy.name} size={26} />
                  <CXText variant="caption" numberOfLines={1}>{trip.createdBy.name}</CXText>
                </>
              ) : null}
            </CXRow>
            <CXText variant="smallStrong" color={colors.primary}>
              {trip.myStatus === "invited" ? "Invited" : `₹${(trip.budgetPerPerson || 0).toLocaleString("en-IN")}`}
            </CXText>
          </CXRow>
        </View>
      </CXCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.78 },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  featured: {
    flexDirection: "column",
    alignItems: "stretch",
    padding: 0,
    overflow: "hidden",
  },
  eventImage: { width: 82, height: 66, borderRadius: radius.sm },
  featuredImage: { width: "100%", aspectRatio: 2.45 },
  listing: {
    flex: 1,
    minWidth: 160,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  listingCompact: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: "hidden",
  },
  listingImage: {
    width: "100%",
    aspectRatio: 1.35,
    backgroundColor: colors.surfaceLavender,
  },
  listingCompactImage: {
    width: 90,
    height: 86,
    backgroundColor: colors.surfaceLavender,
  },
  listingBody: { flex: 1, padding: spacing.sm, gap: spacing.xxs },
  tripCard: { flexDirection: "row", padding: 0, overflow: "hidden" },
  tripFeatured: { flexDirection: "column" },
  tripImage: { width: 116, minHeight: 116 },
  tripHero: { width: "100%", aspectRatio: 2.2 },
  tripBody: { flex: 1, padding: spacing.sm, gap: spacing.xs },
  tripMeta: { justifyContent: "space-between" },
  avatarStack: { minWidth: 80 },
});
