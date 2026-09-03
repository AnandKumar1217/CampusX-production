import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState, useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View, Alert, Share, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";

import { CXEventCard, CXListingCard } from "@/components/cards";
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
} from "@/components/ui";

import { api, getApiErrorMessage } from "@/services/api";
import { mapWeatherCode, useAppStore } from "@/store/appStore";
import { colors, gradients, radius, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";
import { searchLocation, getDistance, type Coordinates } from "@/utils/location";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;

export function EventsScreen({ navigation }: StackProps<"Events">) {
  const events = useAppStore((state) => state.events);
  const user = useAppStore((state) => state.user);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
    })();
  }, []);
  
  const categories = ["All", "Workshops", "Tech", "Cultural", "Sports", "Music"];

  const filtered = useMemo(
    () => {
      const parseDate = (dateStr: string, timeStr: string) => {
        let y = 0, m = 0, d = 0;
        if (dateStr.includes("/")) {
          const parts = dateStr.split("/");
          d = Number(parts[0]);
          m = Number(parts[1]);
          y = Number(parts[2]);
        } else {
          // Format like "24 May 2025" or "02 Jun"
          const parts = dateStr.split(" ");
          d = Number(parts[0]);
          const monthStr = parts[1]?.substring(0, 3).toLowerCase() || "";
          const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
          m = months.indexOf(monthStr) + 1;
          y = parts[2] ? Number(parts[2]) : new Date().getFullYear();
        }
        
        // Parse time (e.g., "10:00 AM" or "2:30 PM")
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

      const parsed = events.map(event => ({
        ...event,
        _parsedDate: parseDate(event.date, event.time)
      }));

      const now = new Date();
      const currentY = now.getFullYear();
      const currentM = now.getMonth() + 1;
      const currentD = now.getDate();
      const currentT = now.getHours() * 60 + now.getMinutes();

      const filteredEvents = parsed.filter((event) => {
        const matchesQuery = event.title.toLowerCase().includes(query.toLowerCase());
        const matchesCategory = category === "All" || event.category === category;
        
        const isPast =
          event._parsedDate.y < currentY ||
          (event._parsedDate.y === currentY && event._parsedDate.m < currentM) ||
          (event._parsedDate.y === currentY && event._parsedDate.m === currentM && event._parsedDate.d < currentD) ||
          (event._parsedDate.y === currentY && event._parsedDate.m === currentM && event._parsedDate.d === currentD && event._parsedDate.t < currentT);
          
        return matchesQuery && matchesCategory && !isPast;
      });

      return filteredEvents.sort((a, b) => {
        if (a._parsedDate.y !== b._parsedDate.y) return a._parsedDate.y - b._parsedDate.y;
        if (a._parsedDate.m !== b._parsedDate.m) return a._parsedDate.m - b._parsedDate.m;
        if (a._parsedDate.d !== b._parsedDate.d) return a._parsedDate.d - b._parsedDate.d;
        return a._parsedDate.t - b._parsedDate.t;
      });
    },
    [query, category, events],
  );


  return (
    <CXScreen>
      <CXHeader
        title="Events"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="notifications-outline"
            label="Event notifications"
            backgroundColor={colors.transparent}
            onPress={() => navigation.navigate("Notifications" as any)}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXSearchBar
          placeholder="Search events..."
          value={query}
          onChangeText={setQuery}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {categories.map((item) => (
            <CXChip 
              key={item} 
              label={item} 
              active={category === item} 
              onPress={() => setCategory(item)}
            />
          ))}
        </ScrollView>
        <CXSectionHeader title="Upcoming Events" />
        {filtered.length > 0 ? (
          <>
            <CXEventCard
              event={filtered[0]!}
              featured
              onPress={() =>
                navigation.navigate("EventDetails", {
                  eventId: filtered[0]!.id,
                })
              }
            />
            {filtered.slice(1).map((event) => (
              <CXEventCard
                key={event.id}
                event={event}
                onPress={() =>
                  navigation.navigate("EventDetails", { eventId: event.id })
                }
              />
            ))}
          </>
        ) : (
          <View style={{ padding: spacing.xl, alignItems: "center" }}>
            <CXText variant="bodyStrong" color={colors.textMuted}>No events found.</CXText>
          </View>
        )}

        <CXButton
          label="Create Event"
          iconLeft="add"
          onPress={() => navigation.navigate("EditEvent")}
        />
      </ScrollView>
    </CXScreen>
  );
}

export function EventDetailsScreen({
  navigation,
  route,
}: StackProps<"EventDetails">) {
  const user = useAppStore((state) => state.user);
  const events = useAppStore((state) => state.events);
  const updateEvent = useAppStore((state) => state.updateEvent);
  const event =
    events.find((item) => item.id === route.params.eventId) ?? events[0]!;
  
  const isSaved = useAppStore((state) => state.savedEvents.includes(event.id));
  const toggleSavedEvent = useAppStore((state) => state.toggleSavedEvent);
  const [isFollowing, setIsFollowing] = useState(false);
  
  const respond = async (next: "none" | "maybe" | "going") => {
    const previous = event.attendance;
    updateEvent(event.id, { attendance: next });
    
    if (next === "going" && previous !== "going") {
      Alert.alert(
        "Registered!",
        `You have successfully registered for this event.\n\n${event.organizer?.name ?? "The organizer"} has been notified.`
      );
    }
    
    try {
      await api.post(`/events/${event.id}/attendance`, { status: next });
    } catch {
      // Ignored: Mock API doesn't exist yet, keep optimistic UI state.
    }
  };
  return (
    <CXScreen edges={[]}>
      <ScrollView
        contentContainerStyle={styles.detailPage}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <Image
            source={event.image}
            contentFit="cover"
            style={styles.eventHero}
          />
          <View style={styles.heroOverlay}>
            <CXIconButton
              icon="chevron-back"
              label="Go back"
              color={colors.white}
              backgroundColor="rgba(0,0,0,.35)"
              onPress={navigation.goBack}
            />
            <View style={styles.flex} />
            <CXIconButton
              icon={isSaved ? "bookmark" : "bookmark-outline"}
              label="Save event"
              color={colors.white}
              backgroundColor="rgba(0,0,0,.35)"
              onPress={() => {
                toggleSavedEvent(event.id);
                if (!isSaved) Alert.alert("Saved", "Event added to your saved events.");
              }}
            />
            <CXIconButton
              icon="share-social-outline"
              label="Share event"
              color={colors.white}
              backgroundColor="rgba(0,0,0,.35)"
              onPress={() => Share.share({ message: `Check out this event: ${event.title}!` })}
            />
          </View>
        </View>
        <View style={styles.detailContent}>
          <CXRow>
            <CXChip label={event.category} active />
            <CXText variant="caption" color={colors.textMuted}>
              Featured event
            </CXText>
          </CXRow>
          <CXText variant="h2">{event.title}</CXText>
          <CXRow style={styles.eventMeta}>
            <Meta icon="calendar-outline" label={event.date} />
            <Meta icon="time-outline" label={event.time} />
            <Meta icon="location-outline" label={event.location} />
          </CXRow>
          <CXCard style={[styles.organizer, { padding: spacing.md }]}>
            <CXAvatar 
              source={event.organizer?.avatar ?? user?.avatarUrl ?? ""} 
              name={event.organizer?.name ?? "Unknown Organizer"} 
              size={56} 
            />
            <View style={styles.flex}>
              <CXText variant="body" color={colors.textMuted}>
                Organized by
              </CXText>
              <CXText variant="h3">{event.organizer?.name ?? "CampusX Coding Club"}</CXText>
            </View>
            <CXButton
              label={isFollowing ? "Following" : "Follow"}
              size="md"
              variant={isFollowing ? "primary" : "outline"}
              fullWidth={false}
              onPress={() => setIsFollowing(!isFollowing)}
            />
          </CXCard>
          
          {event.description ? (
            <>
              <CXSectionHeader title="About the Event" />
              <CXText color={colors.textMuted}>{event.description}</CXText>
            </>
          ) : null}

        </View>
      </ScrollView>
      <View style={styles.sticky}>
        <CXButton
          label={event.attendance === "going" ? "Registered" : "Register Now"}
          iconRight={event.attendance === "going" ? "checkmark" : "arrow-forward"}
          disabled={event.attendance === "going"}
          onPress={() => void respond("going")}
        />
      </View>
    </CXScreen>
  );
}

function Meta({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <CXText variant="caption" align="center">
        {label}
      </CXText>
    </View>
  );
}

export function EditEventScreen({
  navigation,
  route,
}: StackProps<"EditEvent">) {
  const events = useAppStore((state) => state.events);
  const addEvent = useAppStore((state) => state.addEvent);
  const existing = events.find((item) => item.id === route.params?.eventId);
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    date: existing?.date ?? "",
    time: existing?.time ?? "",
    location: existing?.location ?? "",
    coordinates: existing?.coordinates,
    category: existing?.category ?? "Tech",
    description: existing?.description ?? "",
    public: existing?.public ?? true,
  });
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [locQuery, setLocQuery] = useState(existing?.location ?? "");
  const [locResults, setLocResults] = useState<any[]>([]);
  const [searchingLoc, setSearchingLoc] = useState(false);
  const [showLocResults, setShowLocResults] = useState(false);

  useEffect(() => {
    if (locQuery.length < 3 || form.location === locQuery) {
      setLocResults([]);
      setShowLocResults(false);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchingLoc(true);
      const res = await searchLocation(locQuery);
      setLocResults(res);
      setShowLocResults(true);
      setSearchingLoc(false);
    }, 600);
    return () => clearTimeout(timeout);
  }, [locQuery]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dateObj, setDateObj] = useState(new Date());

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const year = selectedDate.getFullYear();
      setForm((v) => ({ ...v, date: `${day}/${month}/${year}` }));
    }
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      let hours = selectedDate.getHours();
      const minutes = String(selectedDate.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      setForm((v) => ({ ...v, time: `${String(hours).padStart(2, "0")}:${minutes} ${ampm}` }));
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0]!.uri);
    }
  };

  const save = async (draft = false) => {
    if (!draft && !form.title.trim()) {
      setError("Event name is required");
      return;
    }
    setSaving(true);
    try {
      if (!existing) {
        // Save the event to local state immediately
        addEvent({
          id: `event-${Date.now()}`,
          title: form.title,
          date: form.date,
          time: form.time,
          location: form.location,
          coordinates: form.coordinates,
          category: form.category,
          image: imageUri as any,
          interested: 1,
          organizer: user,
          description: form.description,
          public: form.public,
        });
      }
      navigation.goBack();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };
  return (
    <CXScrollScreen>
      <CXHeader
        title={existing ? "Edit Event" : "Create Event"}
        onBack={navigation.goBack}
        right={<CXChip label="Draft" />}
      />
      <Pressable style={styles.upload} onPress={pickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={{ width: "100%", height: 160, borderRadius: radius.md }} contentFit="cover" />
        ) : (
          <>
            <Ionicons
              name="cloud-upload-outline"
              size={32}
              color={colors.primary}
            />
            <CXText variant="bodyStrong">Upload Image</CXText>
            <CXText variant="caption" color={colors.textMuted}>
              PNG or JPG · max 8 MB
            </CXText>
          </>
        )}
      </Pressable>
      <CXInput
        label="Event Name"
        placeholder="Enter event title"
        value={form.title}
        onChangeText={(title) => setForm((value) => ({ ...value, title }))}
      />
      <CXRow style={styles.twoCols}>
        <Pressable onPress={() => setShowDatePicker(true)} style={styles.flex}>
          <View pointerEvents="none">
            <CXInput
              label="Date"
              placeholder="DD/MM/YYYY"
              value={form.date}
              editable={false}
            />
          </View>
        </Pressable>
        <Pressable onPress={() => setShowTimePicker(true)} style={styles.flex}>
          <View pointerEvents="none">
            <CXInput
              label="Time"
              placeholder="10:00 AM"
              value={form.time}
              editable={false}
            />
          </View>
        </Pressable>
      </CXRow>
      
      {showDatePicker && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={onDateChange}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={dateObj}
          mode="time"
          display="default"
          onChange={onTimeChange}
        />
      )}
      <View style={{ zIndex: 10 }}>
        <CXInput
          label="Venue"
          placeholder="Search location (e.g. CMRIT)"
          value={locQuery}
          onChangeText={(text) => {
            setLocQuery(text);
            if (form.location !== text) {
              setForm((value) => ({ ...value, location: text, coordinates: undefined }));
            }
          }}
        />
        {showLocResults && locResults.length > 0 && (
          <View style={styles.locResultsContainer}>
            {locResults.map((res, i) => {
              const nameParts = res.name.split(",");
              const mainName = nameParts[0];
              const subName = nameParts.slice(1).join(",").trim();
              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.locResultItem,
                    pressed && { backgroundColor: colors.surfaceLavender },
                  ]}
                  onPress={() => {
                    setLocQuery(mainName);
                    setForm((value) => ({
                      ...value,
                      location: mainName,
                      coordinates: { lat: res.lat, lng: res.lng },
                    }));
                    setShowLocResults(false);
                  }}
                >
                  <View style={styles.locIconContainer}>
                    <Ionicons name="location" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <CXText variant="bodyStrong" numberOfLines={1}>{mainName}</CXText>
                    {subName ? (
                      <CXText variant="caption" color={colors.textMuted} numberOfLines={1}>
                        {subName}
                      </CXText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {searchingLoc && <CXText variant="caption" color={colors.textMuted}>Searching...</CXText>}
      </View>
      <CXSectionHeader title="Category" />
      <CXRow style={styles.filters}>
        {["Tech", "Cultural", "Sports", "Music"].map((item) => (
          <CXChip
            key={item}
            label={item}
            active={form.category === item}
            onPress={() => setForm((value) => ({ ...value, category: item }))}
          />
        ))}
      </CXRow>
      <CXInput
        label="Description"
        placeholder="Describe the event..."
        multiline
        value={form.description}
        onChangeText={(description) =>
          setForm((value) => ({ ...value, description }))
        }
        style={styles.textarea}
      />
      <CXRow style={styles.switchRow}>
        <View style={styles.flex}>
          <CXText variant="bodyStrong">Public Event</CXText>
          <CXText variant="caption" color={colors.textMuted}>
            Anyone on campus can discover this event
          </CXText>
        </View>
        <Switch
          value={form.public}
          onValueChange={(publicEvent) =>
            setForm((value) => ({ ...value, public: publicEvent }))
          }
        />
      </CXRow>
      {error ? <CXText color={colors.danger}>{error}</CXText> : null}
      <CXButton
        label={existing ? "Update Event" : "Publish Event"}
        loading={saving}
        onPress={() => void save()}
      />
      <CXButton
        label="Save Draft"
        variant="outline"
        onPress={() => void save(true)}
      />
    </CXScrollScreen>
  );
}

export function MarketplaceScreen({ navigation }: StackProps<"Marketplace">) {
  const allListings = useAppStore((state) => state.listings);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const filteredListings = useMemo(() => {
    return allListings.filter((listing) => {
      if (listing.status !== "active") return false; // Only show active listings in marketplace
      
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || 
        listing.title.toLowerCase().includes(q) ||
        listing.category.toLowerCase().includes(q) ||
        (listing.description && listing.description.toLowerCase().includes(q));
        
      const matchesCategory = category === "All" || listing.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [allListings, query, category]);

  return (
    <CXScreen>
      <CXHeader
        title="Marketplace"
        onBack={navigation.goBack}
        right={
          <CXRow>
            <CXIconButton
              icon="cart-outline"
              label="Saved items"
              backgroundColor={colors.transparent}
              onPress={() => navigation.navigate("Saved")}
            />
            <CXIconButton
              icon="notifications-outline"
              label="Marketplace alerts"
              backgroundColor={colors.transparent}
              onPress={() => navigation.navigate("Notifications")}
            />
          </CXRow>
        }
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXSearchBar 
          placeholder="Search for books, tools, electronics..." 
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            if (category !== "All") setCategory("All");
          }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {(
            [
              ["All", "grid-outline"],
              ["Books", "book-outline"],
              ["Electronics", "phone-portrait-outline"],
              ["Furniture", "bed-outline"],
              ["Stationery", "pencil-outline"],
            ] as const
          ).map(([label, icon]) => (
            <CXChip
              key={label}
              label={label}
              icon={icon}
              active={category === label}
              onPress={() => setCategory(label)}
            />
          ))}
        </ScrollView>
        {query ? (
          <View style={{ gap: spacing.md, paddingBottom: spacing.xxl }}>
            <CXSectionHeader title="Search Suggestions" action={`${filteredListings.length} found`} />
            {filteredListings.length > 0 ? (
              filteredListings.map((listing) => (
                <CXListingCard
                  key={listing.id}
                  listing={listing}
                  compact
                  onPress={() =>
                    navigation.navigate("ListingDetails", { listingId: listing.id })
                  }
                />
              ))
            ) : (
              <CXText color={colors.textMuted} align="center" style={{ marginTop: spacing.xl }}>
                No listings found for "{query}"
              </CXText>
            )}
          </View>
        ) : (
          <>
            <CXSectionHeader title="Featured Listings" action="See all" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredListings}
            >
              {filteredListings.slice(0, 3).map((listing) => (
                <View key={listing.id} style={styles.featuredListing}>
                  <CXListingCard
                    listing={listing}
                    onPress={() =>
                      navigation.navigate("ListingDetails", {
                        listingId: listing.id,
                      })
                    }
                  />
                </View>
              ))}
              {filteredListings.length === 0 && (
                <CXText color={colors.textMuted} style={{ padding: spacing.md }}>No listings found.</CXText>
              )}
            </ScrollView>
            
            <CXSectionHeader title="Recent Listings" action="See all" />
            {filteredListings.slice(0, 10).map((listing) => (
              <CXListingCard
                key={listing.id}
                listing={listing}
                compact
                onPress={() =>
                  navigation.navigate("ListingDetails", { listingId: listing.id })
                }
              />
            ))}
            
            <CXButton
              label="Sell an Item"
              iconLeft="add"
              onPress={() => navigation.navigate("CreateListing")}
            />
            <CXButton
              label="Manage Listings"
              variant="outline"
              onPress={() => navigation.navigate("ManageListings")}
            />
          </>
        )}
      </ScrollView>
    </CXScreen>
  );
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return "Just now";
}

export function ListingDetailsScreen({
  navigation,
  route,
}: StackProps<"ListingDetails">) {
  const allListings = useAppStore((state) => state.listings);
  const savedListings = useAppStore((state) => state.savedListings);
  const toggleSavedListing = useAppStore((state) => state.toggleSavedListing);
  
  const listing =
    allListings.find((item) => item.id === route.params.listingId) ?? allListings[0]!;
    
  const isSaved = savedListings.includes(listing.id);
  const isSold = listing.status === "sold";
  const incrementListingViews = useAppStore((state) => state.incrementListingViews);
  const sellerListingCount = allListings.filter(
    (l) => l.seller?.id === listing.seller?.id && l.status !== "draft"
  ).length;

  useEffect(() => {
    if (listing?.id) {
      incrementListingViews(listing.id);
    }
  }, [listing?.id, incrementListingViews]);

  const similarItems = useMemo(() => {
    if (!listing) return [];
    
    // 1. Try matching category
    let matches = allListings.filter(
      (item) => item.id !== listing.id && item.status === "active" && item.category === listing.category
    );
    
    // 2. Fallback to title keywords if not enough category matches
    if (matches.length < 3) {
      const words = listing.title.toLowerCase().split(" ").filter(w => w.length > 3);
      const titleMatches = allListings.filter(item => {
        if (item.id === listing.id || item.status !== "active") return false;
        if (matches.some(m => m.id === item.id)) return false;
        return words.some(w => item.title.toLowerCase().includes(w));
      });
      matches = [...matches, ...titleMatches];
    }
    
    // 3. Ultimate fallback to just any other recent items
    if (matches.length < 3) {
      const others = allListings.filter(item => 
        item.id !== listing.id && item.status === "active" && !matches.some(m => m.id === item.id)
      );
      matches = [...matches, ...others];
    }
    
    return matches.slice(0, 3);
  }, [allListings, listing]);

  return (
    <CXScreen edges={[]}>
      <ScrollView contentContainerStyle={styles.detailPage}>
        <View style={styles.listingHero}>
          <Image
            source={listing.image}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroOverlay}>
            <CXIconButton
              icon="chevron-back"
              label="Go back"
              backgroundColor="rgba(255,255,255,.9)"
              onPress={navigation.goBack}
            />
            <View style={styles.flex} />
            <CXIconButton
              icon={isSaved ? "bookmark" : "bookmark-outline"}
              label={isSaved ? "Saved" : "Save listing"}
              backgroundColor="rgba(255,255,255,.9)"
              onPress={() => toggleSavedListing(listing.id)}
            />
            <CXIconButton
              icon="share-social-outline"
              label="Share listing"
              backgroundColor="rgba(255,255,255,.9)"
            />
          </View>
        </View>
        <View style={styles.detailContent}>
          <CXRow>
            <CXChip label={listing.category} active />
            {isSold && <CXChip label="Sold" active />}
          </CXRow>
          <CXText variant="h2">{listing.title}</CXText>
          <CXRow>
            <CXText variant="h2" color={colors.primary}>
              ₹{listing.price.toLocaleString("en-IN")}
            </CXText>
            <CXText color={colors.textMuted}> · Negotiable</CXText>
          </CXRow>
          <CXText variant="caption" color={colors.textMuted}>
            CMRIT Main Campus · {listing.createdAt ? timeAgo(listing.createdAt) : "Just now"}
          </CXText>
          <CXCard style={styles.organizer}>
            <CXAvatar
              source={listing.seller?.avatar}
              name={listing.seller?.name ?? "Guest User"}
            />
            <View style={styles.flex}>
              <CXText variant="bodyStrong">{listing.seller?.name ?? "Guest User"}</CXText>
              <CXText variant="caption" color={colors.textMuted}>
                Verified seller · {sellerListingCount} listing{sellerListingCount !== 1 ? 's' : ''}
              </CXText>
            </View>
            <CXButton
              label="Message"
              size="sm"
              variant="outline"
              fullWidth={false}
              onPress={() =>
                navigation.navigate("Conversation", {
                  conversationId: `conversation-${listing.seller?.id ?? "guest"}`,
                  name: listing.seller?.name ?? "Guest User",
                })
              }
            />
          </CXCard>
          <CXSectionHeader title="Description" />
          <CXText color={colors.textMuted}>
            {listing.description ??
              "Good condition and carefully maintained. Contact the seller for more information and pickup details."}
          </CXText>
          <CXRow style={styles.detailFacts}>
            {[
              ["Condition", "Like New"],
              ["Posted", listing.createdAt ? timeAgo(listing.createdAt) : "Just now"],
              ["Category", listing.category],
              ["Views", (listing.views ?? 0).toString()],
            ].map(([label, value]) => (
              <CXCard key={label} style={styles.fact}>
                <CXText variant="caption" color={colors.textMuted}>
                  {label}
                </CXText>
                <CXText variant="smallStrong">{value}</CXText>
              </CXCard>
            ))}
          </CXRow>
          <CXSectionHeader title="Similar Items" />
          {similarItems.length > 0 ? (
            similarItems.map((item) => (
              <CXListingCard
                key={item.id}
                listing={item}
                compact
                onPress={() =>
                  navigation.push("ListingDetails", { listingId: item.id })
                }
              />
            ))
          ) : (
            <CXText color={colors.textMuted}>No similar items found.</CXText>
          )}
        </View>
      </ScrollView>
      <CXRow style={styles.sticky}>
        <CXButton
          style={{ flex: 1 }}
          label="Message Seller"
          iconLeft="chatbubble-outline"
          variant="outline"
          disabled={isSold}
          onPress={() =>
            navigation.navigate("Conversation", {
              conversationId: `conversation-${listing.seller?.id ?? "guest"}`,
              name: listing.seller?.name ?? "Guest User",
            })
          }
        />
        <CXButton 
          style={{ flex: 1 }}
          label={isSold ? "Sold Out" : "Buy / Contact"} 
          iconLeft={isSold ? undefined : "call-outline"}
          disabled={isSold}
        />
      </CXRow>
    </CXScreen>
  );
}

export function CreateListingScreen({
  navigation,
  route,
}: StackProps<"CreateListing">) {
  const { editId } = route.params ?? {};
  const allListings = useAppStore((state) => state.listings);
  const existingListing = useMemo(() => allListings.find(l => l.id === editId), [editId, allListings]);

  const [form, setForm] = useState({
    title: existingListing?.title ?? "",
    category: existingListing?.category ?? "Books",
    price: existingListing?.price?.toString() ?? "",
    description: existingListing?.description ?? "",
    location: "CMRIT Main Campus",
    images: (existingListing?.images as string[]) ?? (existingListing?.image ? [existingListing.image as string] : []),
  });
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const addListing = useAppStore((state) => state.addListing);
  const updateListing = useAppStore((state) => state.updateListing);
  const user = useAppStore((state) => state.user);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - form.images.length,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newImages = result.assets.map((a) => a.uri);
      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...newImages].slice(0, 5),
      }));
    }
  };

  const save = async (draft = false) => {
    if (!draft && (!form.title.trim() || !Number(form.price) || form.images.length === 0)) {
      setError("Please fill required fields and add an image");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        updateListing(editId, {
          title: form.title || "Untitled Listing",
          price: Number(form.price) || 0,
          category: form.category,
          description: form.description,
          image: form.images.length > 0 ? form.images[0] : undefined,
          images: form.images,
          status: draft ? "draft" : "active",
        });
      } else {
        addListing({
          id: `listing-${Date.now()}`,
          title: form.title || "Untitled Listing",
          price: Number(form.price) || 0,
          category: form.category,
          description: form.description,
          image: form.images.length > 0 ? form.images[0] : undefined,
          images: form.images,
          seller: user ?? { id: "guest", name: "Guest User", username: "guest", college: "Unknown", department: "Unknown", year: "1" },
          status: draft ? "draft" : "active",
          createdAt: new Date().toISOString(),
          views: 0,
        });
      }
      navigation.goBack();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setSaving(false);
    }
  };
  return (
    <CXScrollScreen>
      <CXHeader
        title={editId ? "Edit Listing" : "Create Listing"}
        onBack={() => {
          if (step > 1) setStep(step - 1);
          else navigation.goBack();
        }}
        right={<CXChip label={`${step}/3`} />}
      />

      {step === 1 && (
        <View style={{ gap: 16 }}>
          <CXSectionHeader title="Add Photos" action={`${form.images.length}/5`} />
          <CXText variant="body" color="#666">
            Upload at least 1 image to proceed. High-quality images attract more buyers.
          </CXText>
          <CXRow style={{ flexWrap: "wrap", gap: 8 }}>
            {form.images.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: '#EEE' }} contentFit="cover" />
            ))}
            {form.images.length < 5 && (
              <Pressable 
                style={{ width: 100, height: 100, borderRadius: 8, borderWidth: 1, borderStyle: "dashed", borderColor: "#6C63FF", alignItems: "center", justifyContent: "center" }}
                onPress={pickImages}
              >
                <Ionicons name="add" size={32} color="#6C63FF" />
              </Pressable>
            )}
          </CXRow>
          {error ? <CXText color="#F44336">{error}</CXText> : null}
          <CXButton
            label="Next Step"
            disabled={form.images.length === 0}
            onPress={() => { setError(null); setStep(2); }}
          />
        </View>
      )}

      {step === 2 && (
        <View style={{ gap: 16 }}>
          <CXInput
            label="Item Title"
            placeholder="e.g. Scientific Calculator"
            value={form.title}
            onChangeText={(title) => setForm((value) => ({ ...value, title }))}
          />
          <CXSectionHeader title="Category" />
          <CXRow style={styles.filters}>
            {["Books", "Electronics", "Furniture", "Stationery"].map((item) => (
              <CXChip
                key={item}
                label={item}
                active={form.category === item}
                onPress={() => setForm((value) => ({ ...value, category: item }))}
              />
            ))}
          </CXRow>
          <CXInput
            label="Price (₹)"
            placeholder="0"
            keyboardType="numeric"
            value={form.price}
            onChangeText={(price) => setForm((value) => ({ ...value, price }))}
          />
          {error ? <CXText color="#F44336">{error}</CXText> : null}
          <CXButton
            label="Next Step"
            onPress={() => {
              if (!form.title.trim() || !Number(form.price)) {
                setError("Enter a title and valid price");
                return;
              }
              setError(null);
              setStep(3);
            }}
          />
        </View>
      )}

      {step === 3 && (
        <View style={{ gap: 16 }}>
          <CXInput
            label="Description"
            placeholder="Describe condition, features, and pickup..."
            multiline
            style={styles.textarea}
            value={form.description}
            onChangeText={(description) =>
              setForm((value) => ({ ...value, description }))
            }
          />
          <CXInput
            label="Location"
            icon="location-outline"
            value={form.location}
            onChangeText={(location) =>
              setForm((value) => ({ ...value, location }))
            }
          />
          {error ? <CXText color="#F44336">{error}</CXText> : null}
          <CXButton
            label="Publish Listing"
            loading={saving}
            onPress={() => void save()}
          />
          <CXButton
            label="Save Draft"
            variant="outline"
            onPress={() => void save(true)}
          />
        </View>
      )}
    </CXScrollScreen>
  );
}

export function ManageListingsScreen({
  navigation,
}: StackProps<"ManageListings">) {
  const allListings = useAppStore((state) => state.listings);
  const updateListing = useAppStore((state) => state.updateListing);
  const deleteListing = useAppStore((state) => state.deleteListing);
  const user = useAppStore((state) => state.user);
  const [filter, setFilter] = useState<"active" | "sold" | "draft">("active");

  const currentUserId = user?.id ?? "guest";
  const myListings = allListings.filter((l) => l.seller?.id === currentUserId);
  const displayedListings = myListings.filter((l) => l.status === filter);
  
  const totalViews = myListings.reduce((sum, l) => sum + (l.views || 0), 0);
  const soldListingsCount = myListings.filter(l => l.status === "sold").length;

  const remove = (id: string) => {
    deleteListing(id);
  };
  
  const markSold = (id: string) => {
    updateListing(id, { status: "sold" });
  };
  return (
    <CXScreen>
      <CXHeader
        title="Manage Listings"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="add"
            label="New listing"
            onPress={() => navigation.navigate("CreateListing")}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.page}>
        <CXRow style={styles.filters}>
          <CXChip label="Active" active={filter === "active"} onPress={() => setFilter("active")} />
          <CXChip label="Sold" active={filter === "sold"} onPress={() => setFilter("sold")} />
          <CXChip label="Drafts" active={filter === "draft"} onPress={() => setFilter("draft")} />
        </CXRow>
        <CXCard>
          <CXText variant="bodyStrong">Your Marketplace Overview</CXText>
          <CXRow style={styles.overview}>
            {[
              [myListings.filter(l => l.status === "active").length.toString(), "Active Listings"],
              [totalViews.toString(), "Total Views"],
              [soldListingsCount.toString(), "Sold Items"],
            ].map(([value, label]) => (
              <View key={label} style={styles.stat}>
                <CXText variant="h3" color={colors.primary}>
                  {value}
                </CXText>
                <CXText
                  variant="caption"
                  color={colors.textMuted}
                  align="center"
                >
                  {label}
                </CXText>
              </View>
            ))}
          </CXRow>
        </CXCard>
        <CXSectionHeader title="Your Listings" action="See all" />
        {displayedListings.map((listing) => (
          <CXCard key={listing.id} style={styles.manageRow}>
            <Image
              source={listing.image}
              contentFit="cover"
              style={styles.manageImage}
            />
            <View style={styles.flex}>
              <CXText variant="bodyStrong">{listing.title}</CXText>
              <CXText variant="title" color={colors.primary}>
                ₹{listing.price.toLocaleString("en-IN")}
              </CXText>
              <CXRow style={styles.manageActions}>
                <Pressable onPress={() => navigation.navigate("CreateListing", { editId: listing.id })}>
                  <CXText variant="caption" color={colors.primary}>
                    Edit
                  </CXText>
                </Pressable>
                <Pressable onPress={() => markSold(listing.id)}>
                  <CXText variant="caption" color={colors.success}>
                    Mark Sold
                  </CXText>
                </Pressable>
                <Pressable onPress={() => void remove(listing.id)}>
                  <CXText variant="caption" color={colors.danger}>
                    Delete
                  </CXText>
                </Pressable>
              </CXRow>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textFaint}
            />
          </CXCard>
        ))}
      </ScrollView>
    </CXScreen>
  );
}

const getWeatherDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export function WeatherScreen({ navigation }: StackProps<"Weather">) {
  const weather = useAppStore((state) => state.weather);
  const fetchWeather = useAppStore((state) => state.fetchWeather);
  const fetchWeatherForCity = useAppStore((state) => state.fetchWeatherForCity);
  const fetchWeatherForCoords = useAppStore((state) => state.fetchWeatherForCoords);
  const locationCoords = useAppStore((state) => state.locationCoords);
  const savedDestinations = useAppStore((state) => state.savedDestinations);
  const toggleSavedDestination = useAppStore((state) => state.toggleSavedDestination);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    if (searchQuery.length > 2) {
      const delay = setTimeout(() => {
        fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=5&language=en&format=json`)
          .then((res) => res.json())
          .then(async (data) => {
            const results = data.results || [];
            if (results.length === 0) {
              setSuggestions([]);
              return;
            }

            if (locationCoords) {
              results.forEach((r: any) => {
                r.distance = getWeatherDistance(locationCoords.lat, locationCoords.lon, r.latitude, r.longitude);
              });
              results.sort((a: any, b: any) => a.distance - b.distance);
            }

            const lats = results.map((r: any) => r.latitude).join(",");
            const lons = results.map((r: any) => r.longitude).join(",");
            try {
              const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,weather_code&timezone=auto`);
              const wData = await wRes.json();
              const wList = Array.isArray(wData) ? wData : [wData];
              results.forEach((r: any, idx: number) => {
                if (wList[idx]?.current) {
                  r.temp = Math.round(wList[idx].current.temperature_2m);
                  r.weatherCode = wList[idx].current.weather_code;
                }
              });
            } catch (e) {
              console.log("Batch weather fetch failed", e);
            }
            setSuggestions(results);
          })
          .catch(() => setSuggestions([]));
      }, 500);
      return () => clearTimeout(delay);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery, locationCoords]);

  useEffect(() => {
    if (!weather) {
      void fetchWeather();
    }
  }, [weather, fetchWeather]);

  const temp = weather?.temp ?? "--";
  const condition = weather?.condition ?? "Loading...";
  const humidity = weather?.humidity ?? "--";
  const wind = weather?.wind ?? "--";
  const loading = !weather;

  return (
    <CXScrollScreen>
      <CXHeader
        title="Weather"
        subtitle={weather?.city ?? "Locating..."}
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon="notifications-outline"
            label="Weather alerts"
            backgroundColor={colors.transparent}
          />
        }
      />
      <View style={{ zIndex: 10 }}>
        <CXSearchBar 
          placeholder="Search city, campus, or destination..." 
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => {
            setSearchQuery("");
            setSuggestions([]);
          }}
          onSubmitEditing={() => {
            if (searchQuery.trim()) {
              void fetchWeatherForCity(searchQuery.trim());
              setSuggestions([]);
            }
          }}
        />
        {suggestions.length > 0 && (
          <View style={[styles.dropdownList, { maxHeight: 220, marginBottom: 12 }]}>
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
              {suggestions.map((item, idx) => (
                <Pressable 
                  key={item.id} 
                  style={[
                    styles.dropdownItem, 
                    idx !== suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }
                  ]}
                  onPress={() => {
                    const city = `${item.name}, ${item.country}`;
                    setSearchQuery("");
                    setSuggestions([]);
                    void fetchWeatherForCoords(item.latitude, item.longitude, city);
                  }}
                >
                  <CXRow style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <CXText variant="bodyStrong">{item.name}</CXText>
                      <CXText variant="caption" color={colors.textMuted} numberOfLines={1}>
                        {item.admin1 ? `${item.admin1}, ` : ""}{item.country}
                        {item.distance !== undefined ? ` · ${Math.round(item.distance)}km` : ""}
                      </CXText>
                    </View>
                    {item.temp !== undefined && item.weatherCode !== undefined && (
                      <CXRow style={{ alignItems: "center", gap: 6, flexShrink: 0, paddingLeft: 8 }}>
                        <Ionicons name={mapWeatherCode(item.weatherCode).iconOutline as any} size={20} color={colors.primary} />
                        <CXText variant="bodyStrong">{item.temp}°C</CXText>
                      </CXRow>
                    )}
                  </CXRow>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
      <LinearGradient colors={gradients.weather} style={styles.weatherHero}>
        <CXRow>
          <View style={styles.flex}>
            <CXText variant="hero" color={colors.white}>
              {loading ? "--" : `${temp}°C`}
            </CXText>
            <CXText variant="title" color={colors.white}>
              {condition}
            </CXText>
            <CXText variant="caption" color="#EDE9FF">
              Feels like 25° · High 31° / Low 19°
            </CXText>
          </View>
          <Ionicons 
            name={(weather?.icon as any) ?? "sunny"} 
            size={80} 
            color={weather?.icon.includes("sunny") ? "#FFE780" : "#FFFFFF"} 
          />
        </CXRow>
        <CXRow style={styles.hourly}>
          {(weather?.hourly ?? []).map((item) => (
            <View key={item.time} style={styles.hour}>
              <Ionicons name={item.icon as any} size={18} color={colors.white} />
              <CXText variant="caption" color={colors.white} align="center">
                {item.time}
              </CXText>
              <CXText variant="caption" color={colors.white} align="center">
                {item.temp}
              </CXText>
            </View>
          ))}
        </CXRow>
      </LinearGradient>
      <View style={{ marginVertical: spacing.sm }}>
        <CXRow style={styles.weatherFacts}>
          {[
            ["Humidity", humidity, "water-outline"],
            ["Wind", wind, "speedometer-outline"],
            ["UV Index", weather?.uvIndex ?? "6", "sunny-outline"],
            ["Sunrise", weather?.sunrise ?? "05:58 AM", "partly-sunny-outline"],
          ].map(([label, value, icon]) => (
            <CXCard key={label} style={styles.weatherFact}>
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={20}
                color={colors.primary}
              />
              <CXText variant="bodyStrong">{value}</CXText>
              <CXText variant="caption" color={colors.textMuted}>
                {label}
              </CXText>
            </CXCard>
          ))}
        </CXRow>
      </View>
      <CXSectionHeader
        title="7-Day Forecast"
        action="See all"
        onAction={() => navigation.navigate("WeatherDetails")}
      />
      {(weather?.daily?.slice(0, 4) ?? []).map((item) => (
        <CXCard key={item.day} style={styles.forecast}>
          <CXText variant="bodyStrong" style={styles.flex}>
            {item.day}
          </CXText>
          <Ionicons
            name={item.icon as any}
            size={20}
            color={colors.primary}
          />
          <CXText color={colors.textMuted} style={styles.flex}></CXText>
          <CXText variant="bodyStrong">{item.temp}</CXText>
        </CXCard>
      ))}
      <CXSectionHeader title="Saved Destinations" />
      <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        {savedDestinations.map((dest) => (
          <CXListRow
            key={dest.city}
            icon="location-outline"
            title={dest.city}
            subtitle="Saved destination"
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <CXText variant="title" color={colors.primary}>
                  {dest.temp}
                </CXText>
                <Pressable onPress={() => toggleSavedDestination(dest.city, dest.temp)}>
                  <Ionicons name="heart" size={24} color={colors.primary} />
                </Pressable>
              </View>
            }
          />
        ))}
      </View>
    </CXScrollScreen>
  );
}

export function WeatherDetailsScreen({
  navigation,
}: StackProps<"WeatherDetails">) {
  const { weather, savedDestinations, toggleSavedDestination } = useAppStore();
  const isSaved = weather?.city ? savedDestinations.some(d => d.city === weather.city) : false;
  return (
    <CXScrollScreen contentContainerStyle={{ gap: spacing.md }}>
      <CXHeader
        title={weather?.city ?? "Loading..."}
        subtitle="Live Weather"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon={isSaved ? "heart" : "heart-outline"}
            label={isSaved ? "Saved" : `Save ${weather?.city ?? "City"}`}
            backgroundColor={colors.transparent}
            onPress={() => weather?.city && toggleSavedDestination(weather.city, `${weather.temp}°C`)}
          />
        }
      />
      <LinearGradient
        colors={["#F5A84F", "#7257F5"]}
        style={styles.destinationWeather}
      >
        <Ionicons name={(weather?.icon as any) ?? "sunny"} size={58} color="#FFE780" />
        <View style={styles.flex}>
          <CXText variant="hero" color={colors.white}>
            {weather?.temp ?? "--"}°C
          </CXText>
          <CXText variant="bodyStrong" color={colors.white}>
            {weather?.condition ?? "--"}
          </CXText>
        </View>
      </LinearGradient>
      <CXSectionHeader title="7-Day Forecast" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dailyRow}>
        {(weather?.daily ?? []).map((item) => (
          <CXCard key={item.day} style={styles.daily}>
            <Ionicons
              name={item.icon as any}
              size={22}
              color={colors.primary}
            />
            <CXText variant="caption" align="center">
              {item.day} {item.temp}
            </CXText>
          </CXCard>
        ))}
      </ScrollView>
      <CXSectionHeader title="Hourly Forecast" />
      {(weather?.hourly ?? []).map(
        (item) => (
          <CXListRow
            key={item.time}
            icon={item.icon as any}
            title={`${item.time}  ${item.temp}`}
            subtitle={weather?.condition ?? "Clear skies"}
          />
        ),
      )}
      <CXRow style={styles.weatherFacts}>
        {[
          ["Humidity", weather?.humidity ?? "61%"],
          ["Sunrise", weather?.sunrise ?? "6:00 AM"],
          ["Wind", weather?.wind ?? "14 km/h"],
          ["UV Index", weather?.uvIndex ?? "7"],
        ].map(([label, value]) => (
          <CXCard key={label} style={styles.weatherFact}>
            <CXText variant="title" color={colors.primary}>
              {value}
            </CXText>
            <CXText variant="caption" color={colors.textMuted}>
              {label}
            </CXText>
          </CXCard>
        ))}
      </CXRow>
      <CXCard style={styles.travelTip}>
        <Ionicons name={(weather?.travelTip?.icon as any) ?? "map-outline"} size={28} color={colors.primary} />
        <View style={styles.flex}>
          <CXText variant="bodyStrong">{weather?.travelTip?.title ?? "Travel tip"}</CXText>
          <CXText variant="small" color={colors.textMuted}>
            {weather?.travelTip?.desc ?? "Enjoy your day!"}
          </CXText>
        </View>
      </CXCard>
      <CXButton
        label={`Plan Your Trip to ${weather?.city ?? "City"}`}
        iconLeft="airplane-outline"
        onPress={() => navigation.navigate("CreateTrip")}
      />
    </CXScrollScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  dropdownList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  filters: { gap: spacing.xs },
  detailPage: { paddingBottom: 100 },
  heroWrap: { height: 290 },
  eventHero: { width: "100%", height: "100%" },
  heroOverlay: {
    position: "absolute",
    top: 46,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  detailContent: { padding: spacing.screen, gap: spacing.md },
  eventMeta: { gap: spacing.sm },
  meta: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundLavender,
  },
  organizer: { 
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm, 
    backgroundColor: colors.backgroundLavender 
  },
  highlights: { gap: spacing.xs },
  highlight: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
  },
  schedule: { minHeight: 50, gap: spacing.sm },
  scheduleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  rsvp: { gap: spacing.xs },
  sticky: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  upload: {
    minHeight: 144,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.backgroundLavender,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  twoCols: { gap: spacing.sm },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  switchRow: { minHeight: 68, gap: spacing.sm },
  locResultsContainer: {
    position: "absolute",
    top: 70, // Below the input field
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 100,
  },
  locResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: spacing.sm,
  },
  locIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredListings: { gap: spacing.sm },
  featuredListing: { width: 190 },
  listingHero: { height: 360, backgroundColor: colors.surfaceLavender },
  detailFacts: { flexWrap: "wrap", gap: spacing.sm },
  fact: { width: "47.8%", gap: spacing.xxs },
  photos: { gap: spacing.xs },
  photo: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  overview: { marginTop: spacing.md },
  stat: { flex: 1, alignItems: "center" },
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  manageImage: {
    width: 82,
    height: 82,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLavender,
  },
  manageActions: { gap: spacing.md, marginTop: spacing.xs },
  weatherHero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  hourly: { justifyContent: "space-between" },
  hour: { width: "19%", alignItems: "center", gap: 4 },
  weatherFacts: { flexWrap: "wrap", gap: spacing.sm },
  weatherFact: { width: "47.8%", alignItems: "center", gap: spacing.xs },
  forecast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  destinationWeather: {
    minHeight: 180,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  dailyRow: { gap: spacing.xs, paddingRight: spacing.screen },
  daily: {
    minWidth: 70,
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.xs,
  },
  travelTip: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.backgroundLavender,
  },
});
