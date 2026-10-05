import { useOpenChat } from "@/hooks/useOpenChat";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Switch, View, Alert, Share, Platform, ActivityIndicator, TouchableOpacity, Dimensions, Modal, BackHandler } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { CXEventCard, CXListingCard } from "@/components/cards";
import { CXSnackbar } from "@/components/ui/CXSnackbar";
import {
  CXAvatar,
  CXBottomActionArea,
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
} from "@/components/ui";

import { api, getApiErrorMessage } from "@/services/api";
import { eventService } from "@/services/eventService";
import { marketplaceService, marketplaceKeys } from "@/services/marketplaceService";
import { useAppStore } from "@/store/appStore";
import { colors, gradients, radius, spacing } from "@/theme";
import type { RootStackParamList } from "@/types/navigation";
import { searchLocation, getDistance, type Coordinates } from "@/utils/location";
import { fetchWeatherForLocation, searchCities, mapWeatherCode } from "@/services/weatherService";

type StackProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Name
>;

function OldEventsScreen({ navigation }: StackProps<"Events">) {
  const userStore = useAppStore((state: any) => state.user);
  const { data: events = [] } = useQuery({ queryKey: ["events", userStore?.id], queryFn: async () => (await eventService.listEvents()).items });
  const user = useAppStore((state: any) => state.user);
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
            let [hours = 0, minutes = 0] = time.split(":").map(Number);
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
          {categories.map((item: any) => (
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
            {filtered.slice(1).map((event: any) => (
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

function OldEventDetailsScreen({
  navigation,
  route,
}: StackProps<"EventDetails">) {
  const user = useAppStore((state: any) => state.user);
  const { data: events = [] } = useQuery({ queryKey: ["events", user?.id], queryFn: async () => (await eventService.listEvents()).items });
  const updateEvent = useAppStore((state) => state.updateEvent);
  const event =
    events.find((item: any) => item.id === route.params.eventId) ?? events[0];

  const queryClient = useQueryClient();
  const { data: savedEvents = [] } = useQuery({
    queryKey: ["savedEvents"],
    queryFn: async () => await eventService.getSavedEvents()
  });

  const isSaved = event
    ? savedEvents.some((savedEvent: any) => savedEvent.id === event.id)
    : false;

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!event) return;
      const eventServiceAPI = eventService;
      await eventService.setSaved(event.id, !isSaved);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedEvents"] });
    }
  });

  const [isFollowing, setIsFollowing] = useState(false);

  if (!event) {
    return (
      <CXScreen>
        <CXHeader title="Event Details" onBack={navigation.goBack} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CXText>Loading...</CXText>
        </View>
      </CXScreen>
    );
  }
  
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
        style={{ flex: 1 }}
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
                toggleMutation.mutate();
                if (!isSaved) Alert.alert("Saved", "Event added to your saved events.");
              }}
              disabled={toggleMutation.isPending}
            />
            <CXIconButton
              icon="share-social-outline"
              label="Share event"
              color={colors.white}
              backgroundColor="rgba(0,0,0,.35)"
              onPress={() => Share.share({ message: `Check out this event: ${event.title}! campusx://event/${event.id}` })}
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
      <CXBottomActionArea>
        <CXButton
          style={{ flex: 1 }}
          label={event.attendance === "going" ? "Registered" : "Register Now"}
          iconRight={event.attendance === "going" ? "checkmark" : "arrow-forward"}
          disabled={event.attendance === "going"}
          onPress={() => void respond("going")}
        />
      </CXBottomActionArea>
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

function OldEditEventScreen({
  navigation,
  route,
}: StackProps<"EditEvent">) {
  const user = useAppStore((state: any) => state.user);
  const { data: events = [] } = useQuery({ queryKey: ["events", user?.id], queryFn: async () => (await eventService.listEvents()).items });
  const addEvent = useAppStore((state) => state.addEvent);
  const existing = events.find((item: any) => item.id === route.params?.eventId);
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
  const parseExistingDate = () => {
    if (!existing || !existing.date || !existing.time) return new Date();
    const partsDate = existing.date.split('/');
    const partsTime = existing.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (partsDate.length === 3 && partsTime) {
      let hrs = parseInt(partsTime[1]!, 10);
      if (partsTime[3]!.toUpperCase() === 'PM' && hrs < 12) hrs += 12;
      if (partsTime[3]!.toUpperCase() === 'AM' && hrs === 12) hrs = 0;
      return new Date(parseInt(partsDate[2]!, 10), parseInt(partsDate[1]!, 10) - 1, parseInt(partsDate[0]!, 10), hrs, parseInt(partsTime[2]!, 10));
    }
    return new Date();
  };
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dateObj, setDateObj] = useState(parseExistingDate());

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === "set" && selectedDate) {
      setDateObj(selectedDate);
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const year = selectedDate.getFullYear();
      setForm((v) => ({ ...v, date: `${day}/${month}/${year}` }));
    }
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (event.type === "set" && selectedDate) {
      setDateObj(selectedDate);
      let hours = selectedDate.getHours();
      const minutes = String(selectedDate.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      setForm((v) => ({ ...v, time: `${String(hours).padStart(2, "0")}:${minutes} ${ampm}` }));
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0]!.uri);
    }
  };

  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: eventService.createEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string, payload: any }) => eventService.updateEvent(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const save = async (draft = false) => {
    if (!draft && !form.title.trim()) {
      setError("Event name is required");
      return;
    }
    setSaving(true);
    try {
      let finalAvatarUrl = existing?.image;
      if (imageUri && imageUri !== existing?.image) {
        const formData = new FormData();
        const filename = imageUri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image";
        formData.append('file', { uri: imageUri, name: filename, type } as any);
        const uploadRes = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        finalAvatarUrl = uploadRes.data.data.url;
      }
      
      const partsDate = form.date.split('/');
      const partsTime = form.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
      let dateObj = new Date();
      if (partsDate.length === 3 && partsTime) {
        let hrs = parseInt(partsTime[1]!, 10);
        if (partsTime[3]!.toUpperCase() === 'PM' && hrs < 12) hrs += 12;
        if (partsTime[3]!.toUpperCase() === 'AM' && hrs === 12) hrs = 0;
        dateObj = new Date(parseInt(partsDate[2]!, 10), parseInt(partsDate[1]!, 10) - 1, parseInt(partsDate[0]!, 10), hrs, parseInt(partsTime[2]!, 10));
      }

      const payload = {
        title: form.title,
        date: form.date,
        time: form.time,
        startsAt: dateObj.toISOString(),
        location: { name: form.location, coordinates: form.coordinates ? [form.coordinates.lng, form.coordinates.lat] : undefined },
        category: form.category,
        imageUrl: finalAvatarUrl,
        description: form.description,
        public: form.public,
        draft: draft
      };

      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
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
        <View style={styles.flex}>
          <CXInput
            label="Date"
            placeholder="DD/MM/YYYY"
            value={form.date}
            editable={false}
            onPress={() => {
              if (Platform.OS === 'android') {
                DateTimePickerAndroid.open({
                  value: dateObj,
                  mode: "date",
                  display: "default",
                  minimumDate: new Date(),
                  onChange: onDateChange,
                });
              } else {
                setShowDatePicker(true);
              }
            }}
          />
        </View>
        <View style={styles.flex}>
          <CXInput
            label="Time"
            placeholder="10:00 AM"
            value={form.time}
            editable={false}
            onPress={() => {
              if (Platform.OS === 'android') {
                DateTimePickerAndroid.open({
                  value: dateObj,
                  mode: "time",
                  display: "default",
                  onChange: onTimeChange,
                });
              } else {
                setShowTimePicker(true);
              }
            }}
          />
        </View>
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
            {locResults.map((res: any, i: number) => {
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
        {["Tech", "Cultural", "Sports", "Music"].map((item: any) => (
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

    </CXScrollScreen>
  );
}

export function MarketplaceScreen({ navigation }: StackProps<"Marketplace">) {
  const userStore = useAppStore((state: any) => state.user);
  const { data: allListings = [], isLoading } = useQuery({ 
    queryKey: marketplaceKeys.feed(), 
    queryFn: async () => (await marketplaceService.listListings()).items 
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const filteredListings = useMemo(() => {
    return allListings.filter((listing) => {
      if (listing.status !== "available") return false; // Only show active listings in marketplace
      
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
              icon="notifications-outline"
              label="Marketplace alerts"
              backgroundColor={colors.transparent}
              onPress={() => navigation.navigate("Notifications")}
            />
          </CXRow>
        }
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.page, { paddingBottom: 40 }]}>
        <CXSearchBar 
          placeholder="Search for books, tools, electronics..." 
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            if (category !== "All") setCategory("All");
          }}
          onClear={() => setQuery("")}
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
        {isLoading ? (
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 20, gap: 16 }}>
            <ActivityIndicator size="large" color="#6C63FF"  />
            <CXText variant="bodyStrong" color="#666" style={{ textAlign: "center", marginBottom: 16 }}>
              Discovering local marketplace items...
            </CXText>
            {[1, 2, 3].map(i => (
              <View key={i} style={{ flexDirection: "row", backgroundColor: "#F9F9F9", borderRadius: 16, padding: 12, gap: 12 }}>
                <View style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: "#EEEEEE" }} />
                <View style={{ flex: 1, justifyContent: "center", gap: 8 }}>
                  <View style={{ width: "80%", height: 16, backgroundColor: "#EEEEEE", borderRadius: 8 }} />
                  <View style={{ width: "40%", height: 16, backgroundColor: "#EEEEEE", borderRadius: 8 }} />
                  <View style={{ width: "20%", height: 14, backgroundColor: "#EEEEEE", borderRadius: 8 }} />
                </View>
              </View>
            ))}
          </View>
        ) : query ? (
          <View style={{ gap: spacing.md, paddingBottom: spacing.xxl }}>
            <CXSectionHeader title="Search Suggestions" action={`${filteredListings.length} found`} />
            {filteredListings.length > 0 ? (
              filteredListings.map((listing: any) => (
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
                {`No listings found for "${query}"`}
              </CXText>
            )}
          </View>
        ) : (
          <>
            <CXSectionHeader title="Featured Listings" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredListings}
            >
              {filteredListings.slice(0, 3).map((listing: any) => (
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
            
            <CXSectionHeader title="Recent Listings" />
            {filteredListings.slice(0, 10).map((listing: any) => (
              <CXListingCard
                key={listing.id}
                listing={listing}
                compact
                onPress={() =>
                  navigation.navigate("ListingDetails", { listingId: listing.id })
                }
              />
            ))}
          </>
        )}
      </ScrollView>
      <CXBottomActionArea style={{ backgroundColor: "rgba(255,255,255,0.9)" }}>
        <CXButton
          style={{ flex: 1 }}
          label="Sell Item"
          iconLeft="add"
          onPress={() => navigation.navigate("CreateListing")}
        />
        <CXButton
          style={{ flex: 1 }}
          label="Manage"
          variant="outline"
          onPress={() => navigation.navigate("ManageListings")}
        />
      </CXBottomActionArea>
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
  const { openChat } = useOpenChat();
  const userStore = useAppStore((state: any) => state.user);
  const friends = useAppStore((state: any) => state.friends);
  const { data: allListings = [] } = useQuery({ queryKey: marketplaceKeys.feed(), queryFn: async () => (await marketplaceService.listListings()).items });
  const scrollRef = React.useRef<ScrollView>(null);
  
  const handleBack = React.useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace("MainTabs" as any, { screen: "Marketplace" });
    }
    return true;
  }, [navigation]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => subscription.remove();
  }, [handleBack]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [route.params.listingId]);
  
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  
  const queryClient = useQueryClient();
  const { data: savedListingsData } = useQuery({
    queryKey: marketplaceKeys.saved(),
    queryFn: async () => await marketplaceService.getSavedListings()
  });

  const { data: reqRes } = useQuery({ 
    queryKey: ["friend-requests"], 
    queryFn: async () => await api.get<{data: {sent: any[], received: any[]}}>("/friends/requests") 
  });
  
  const { data: fetchedListing } = useQuery({
    queryKey: marketplaceKeys.detail(route.params.listingId),
    queryFn: async () => await marketplaceService.getListing(route.params.listingId)
  });

  const listing =
    fetchedListing ?? allListings.find((item: any) => item.id === route.params.listingId) ?? allListings[0];

  const isSaved = listing
    ? (savedListingsData || []).some((savedListing: any) => savedListing.id === listing.id)
    : false;

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!listing) return;
      const ms = marketplaceService;
      if (isSaved) {
        await ms.unsaveListing(listing.id);
      } else {
        await ms.saveListing(listing.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.saved() });
      setSnackbarMessage(isSaved ? "Removed from saved items" : "Added to saved items");
      setSnackbarVisible(true);
    }
  });

  const toggleSavedListing = () => {
    toggleMutation.mutate();
  };

  const isSold = listing?.status === "sold";
  const sellerListingCount = allListings.filter(
    (candidate) => candidate.seller?.id === listing?.seller?.id && candidate.status !== "draft"
  ).length;

  const relationshipState = useMemo(() => {
    if (!listing) return "NONE";
    if (userStore?.id === listing.seller?.id) return "SELF";
    if (friends.some((f: any) => f.id === listing.seller?.id)) return "FRIENDS";
    const isSent = reqRes?.data?.data?.sent?.some((r: any) => r.recipient._id === listing.seller?.id || r.recipient.id === listing.seller?.id);
    if (isSent) return "OUTGOING_PENDING";
    const isReceived = reqRes?.data?.data?.received?.some((r: any) => r.requester._id === listing.seller?.id || r.requester.id === listing.seller?.id);
    if (isReceived) return "INCOMING_PENDING";
    return "NONE";
  }, [userStore?.id, listing, friends, reqRes]);

  const [isMessaging, setIsMessaging] = useState(false);
  const handleAction = async () => {
    if (!listing) return;
    if (relationshipState === "NONE") {
      setIsMessaging(true);
      try {
        await api.post("/friends/requests", { recipientId: listing.seller?.id });
        queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      } finally {
        setIsMessaging(false);
      }
    } else if (relationshipState === "INCOMING_PENDING") {
      setIsMessaging(true);
      try {
        await api.post(`/friends/requests/${listing.seller?.id}/accept`);
        queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
        // Optionally update friends in useAppStore or let socket handle it
      } finally {
        setIsMessaging(false);
      }
    } else if (relationshipState === "FRIENDS") {
      setIsMessaging(true);
      try {
        await openChat(listing.seller?.id, listing.seller?.name ?? "Guest User");
      } finally {
        setIsMessaging(false);
      }
    }
  };

  const similarItems = useMemo(() => {
    if (!listing) return [];
    
    // 1. Try matching category
    let matches = allListings.filter(
      (item: any) => item.id !== listing.id && item.status === "active" && item.category === listing.category
    );
    
    // 2. Fallback to title keywords if not enough category matches
    if (matches.length < 3) {
      const words = listing.title.toLowerCase().split(" ").filter(w => w.length > 3);
      const titleMatches = allListings.filter((item: any) => {
        if (item.id === listing.id || item.status !== "active") return false;
        if (matches.some((m: any) => m.id === item.id)) return false;
        return words.some((w: any) => item.title.toLowerCase().includes(w));
      });
      matches = [...matches, ...titleMatches];
    }
    
    // 3. Ultimate fallback to just any other recent items
    if (matches.length < 3) {
      const others = allListings.filter(item => 
        item.id !== listing.id && item.status === "active" && !matches.some((m: any) => m.id === item.id)
      );
      matches = [...matches, ...others];
    }
    
    return matches.slice(0, 3);
  }, [allListings, listing]);

  if (!listing) {
    return (
      <CXScreen>
        <CXHeader title="Listing Details" onBack={handleBack} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CXText>Loading...</CXText>
        </View>
      </CXScreen>
    );
  }

  return (
    <CXScreen edges={[]}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.detailPage}>
        <View style={styles.listingHero}>
          {listing.images && listing.images.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={StyleSheet.absoluteFill}
            >
              {listing.images.map((img: string, idx: number) => (
                <Image
                  key={idx}
                  source={{ uri: img }}
                  contentFit="cover"
                  style={{ width: Dimensions.get('window').width, height: 360 }}
                />
              ))}
            </ScrollView>
          ) : null}
          {listing.images && listing.images.length > 1 && (
            <View style={{ position: 'absolute', bottom: 16, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 6, zIndex: 10 }}>
              {listing.images.map((_: any, idx: number) => (
                <View key={idx} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.7)' }} />
              ))}
            </View>
          )}
          <View style={styles.heroOverlay}>
            <CXIconButton
              icon="chevron-back"
              label="Go back"
              backgroundColor="rgba(255,255,255,.9)"
              onPress={handleBack}
            />
            <View style={styles.flex} />
            <CXIconButton
              icon="share-social-outline"
              label="Share listing"
              backgroundColor="rgba(255,255,255,.9)"
              onPress={() => Share.share({ message: `Check out this listing: ${listing.title}! campusx://listing/${listing.id}` })}
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
            <CXText color={colors.textMuted}>  Negotiable</CXText>
          </CXRow>
          <CXText variant="caption" color={colors.textMuted}>
            {listing.location ? listing.location : "CMRIT Main Campus"}  {listing.createdAt ? timeAgo(listing.createdAt) : "Just now"}
          </CXText>
          <CXSectionHeader title="Seller" />
          <CXCard style={styles.organizer}>
            <Pressable onPress={() => navigation.navigate("UserProfile", { userId: listing.seller?.id })}>
              <CXAvatar
                source={listing.seller?.avatar}
                name={listing.seller?.name ?? "Guest User"}
              />
            </Pressable>
            <View style={styles.flex}>
              <Pressable onPress={() => navigation.navigate("UserProfile", { userId: listing.seller?.id })}>
                <CXText variant="bodyStrong">{listing.seller?.name ?? "Guest User"}</CXText>
                <CXText variant="caption" color={colors.textMuted}>
                  Verified seller  {sellerListingCount} listing{sellerListingCount !== 1 ? 's' : ''}
                </CXText>
              </Pressable>
            </View>
            {relationshipState !== "SELF" && (
              <CXButton
                label={
                  relationshipState === "NONE" ? "Add Friend" :
                  relationshipState === "OUTGOING_PENDING" ? "Requested" :
                  relationshipState === "INCOMING_PENDING" ? "Accept" :
                  "Message"
                }
                size="sm"
                variant="outline"
                fullWidth={false}
                disabled={relationshipState === "OUTGOING_PENDING" || isMessaging}
                onPress={handleAction}
              />
            )}
          </CXCard>
          <CXSectionHeader title="Description" />
          <CXText color={colors.textMuted}>
            {listing.description ??
              "Good condition and carefully maintained. Contact the seller for more information and pickup details."}
          </CXText>
          <CXRow style={styles.detailFacts}>
            {[
              ["Condition", listing.condition || "New"],
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
            similarItems.map((item: any) => (
              <CXListingCard
                key={item.id}
                listing={item}
                compact
                onPress={() =>
                  navigation.replace("ListingDetails", { listingId: item.id })
                }
              />
            ))
          ) : (
            <CXText color={colors.textMuted}>No similar items found.</CXText>
          )}
        </View>
      </ScrollView>
      {isSold || relationshipState !== "SELF" ? (
        <CXBottomActionArea>
          {isSold ? (
            <CXButton 
              style={{ flex: 1 }}
              label="Sold Out" 
              disabled={true}
            />
          ) : (
            <CXButton
              style={{ flex: 1 }}
              label={
                relationshipState === "NONE" ? "Add Friend" :
                relationshipState === "OUTGOING_PENDING" ? "Requested" :
                relationshipState === "INCOMING_PENDING" ? "Accept" :
                "Message Seller"
              }
              iconLeft={relationshipState === "FRIENDS" ? "chatbubble-outline" : relationshipState === "OUTGOING_PENDING" ? "time-outline" : "person-add-outline"}
              variant="primary"
              disabled={relationshipState === "OUTGOING_PENDING" || isMessaging}
              onPress={handleAction}
            />
          )}
        </CXBottomActionArea>
      ) : null}
      <CXSnackbar visible={snackbarVisible} message={snackbarMessage} onDismiss={() => setSnackbarVisible(false)} />
    </CXScreen>
  );
}

export function CreateListingScreen({
  navigation,
  route,
}: StackProps<"CreateListing">) {
  const { editId } = route.params ?? {};
  const userStore = useAppStore((state: any) => state.user);
  const { data: allListings = [] } = useQuery({ queryKey: marketplaceKeys.feed(), queryFn: async () => (await marketplaceService.listListings()).items });
  const existingListing = useMemo(() => allListings.find(l => l.id === editId), [editId, allListings]);

  const parseLocation = (loc: any) => {
    if (!loc) return { name: "", address: "", latitude: null, longitude: null };
    if (typeof loc === 'string') return { name: loc, address: loc, latitude: null, longitude: null };
    return { name: loc.name || "", address: loc.address || "", latitude: loc.latitude ?? null, longitude: loc.longitude ?? null };
  };

  const [form, setForm] = useState({
    title: existingListing?.title ?? "",
    category: existingListing?.category ?? "Books",
    condition: existingListing?.condition ?? "New",
    price: existingListing?.price?.toString() ?? "",
    description: existingListing?.description ?? "",
    location: parseLocation(existingListing?.location),
    images: (existingListing?.images as string[]) ?? [],
    imagePublicIds: ((existingListing as any)?.imagePublicIds as string[]) ?? [],
  });
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const queryClient = useQueryClient();
  const user = useAppStore((state: any) => state.user);

  useEffect(() => {
    if (existingListing) {
      setForm({
        title: existingListing.title ?? "",
        category: existingListing.category ?? "Books",
        condition: existingListing.condition ?? "New",
        price: existingListing.price?.toString() ?? "",
        description: existingListing.description ?? "",
        location: parseLocation(existingListing.location),
        images: (existingListing.images as string[]) ?? [],
        imagePublicIds: ((existingListing as any).imagePublicIds as string[]) ?? [],
      });
    } else if (!editId) {
      setForm({
        title: "",
        category: "Books",
        condition: "New",
        price: "",
        description: "",
        location: { name: "", address: "", latitude: null, longitude: null },
        images: [],
        imagePublicIds: [],
      });
    }
  }, [existingListing, editId]);

  useEffect(() => {
    if (!editId && !form.location) {
      getCurrentLocation();
    }
  }, [editId]);

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

  const getCurrentLocation = async () => {
    setFetchingLocation(true);
    setError(null);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Permission to access location was denied");
        setFetchingLocation(false);
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      let geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      if (geocode && geocode.length > 0) {
        const place = geocode[0];
        const addressParts = [place?.name, place?.street, place?.city, place?.region].filter(Boolean);
        const address = Array.from(new Set(addressParts)).join(", ");
        setForm(value => ({ ...value, location: {
          name: place?.name || place?.street || address,
          address: address,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }}));
      } else {
        const str = `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`;
        setForm(value => ({ ...value, location: { name: str, address: str, latitude: location.coords.latitude, longitude: location.coords.longitude } }));
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch location");
    } finally {
      setFetchingLocation(false);
    }
  };

  const save = async (draft = false) => {
    if (!draft && (!form.title.trim() || !Number(form.price) || form.images.length === 0)) {
      setError("Please fill required fields and add an image");
      return;
    }
    setSaving(true);
    try {
      const ms = marketplaceService;
      
      const finalImages = [];
      const finalPublicIds = [];
      for (const uri of form.images) {
        if (!uri.startsWith("http")) {
          const filename = uri.split('/').pop() || 'item.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : "image";
          const formData = new FormData();
          formData.append('file', { uri, name: filename, type } as any);
          const uploadRes = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          finalImages.push(uploadRes.data.data.url);
          finalPublicIds.push(uploadRes.data.data.publicId);
        } else {
          finalImages.push(uri);
          const origIdx = existingListing?.images?.indexOf(uri) ?? -1;
          if (origIdx !== -1 && form.imagePublicIds[origIdx]) {
            finalPublicIds.push(form.imagePublicIds[origIdx]);
          }
        }
      }

      if (editId) {
        const updated = await ms.updateListing(editId, {
          title: form.title || "Untitled Listing",
          price: Number(form.price) || 0,
          category: form.category,
          condition: form.condition,
          description: form.description,
          location: form.location,
          image: finalImages.length > 0 ? finalImages[0] : undefined,
          images: finalImages,
          imagePublicIds: finalPublicIds,
          status: draft ? "draft" : "available",
        });
        
        // Optimistically update caches so public feed and details update instantly
        queryClient.setQueryData(["listing", editId], updated);
        const updateList = (old: any) => {
          if (!old) return old;
          if (Array.isArray(old)) return old.map((item: any) => item.id === editId ? { ...item, ...updated } : item);
          if (old.items && Array.isArray(old.items)) return { ...old, items: old.items.map((item: any) => item.id === editId ? { ...item, ...updated } : item) };
          return old;
        };
        queryClient.setQueriesData({ queryKey: marketplaceKeys.feed() }, updateList);
        queryClient.setQueriesData({ queryKey: marketplaceKeys.myListings() }, updateList);
        
        queryClient.invalidateQueries({ queryKey: marketplaceKeys.detail(editId) });
        setSnackbarMessage("Listing updated successfully");
        setSnackbarVisible(true);
      } else {
        await ms.createListing({
          title: form.title || "Untitled Listing",
          price: Number(form.price) || 0,
          category: form.category,
          condition: form.condition,
          description: form.description,
          location: form.location,
          image: finalImages.length > 0 ? finalImages[0] : undefined,
          images: finalImages,
          imagePublicIds: finalPublicIds,
          draft: draft,
        });
        setSnackbarMessage(draft ? "Draft saved successfully" : "Listing created successfully");
        setSnackbarVisible(true);
      }
      await queryClient.invalidateQueries({ queryKey: marketplaceKeys.feed() });
      await queryClient.invalidateQueries({ queryKey: marketplaceKeys.myListings() });
      setTimeout(() => navigation.goBack(), 1500);
    } catch (caught: any) {
      setError(caught?.message || "Couldn't save listing. Try again.");
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
              <View key={idx} style={{ position: 'relative', width: 100, height: 100 }}>
                <Image source={{ uri }} style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: '#EEE' }} contentFit="cover" />
                <Pressable
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    borderRadius: 12,
                    padding: 4,
                  }}
                  onPress={() => {
                    setForm(prev => {
                      const newImages = [...prev.images];
                      newImages.splice(idx, 1);
                      const newPublicIds = [...prev.imagePublicIds];
                      newPublicIds.splice(idx, 1);
                      return { ...prev, images: newImages, imagePublicIds: newPublicIds };
                    });
                  }}
                >
                  <Ionicons name="close" size={16} color="white" />
                </Pressable>
              </View>
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
            {["Books", "Electronics", "Furniture", "Stationery"].map((item: any) => (
              <CXChip
                key={item}
                label={item}
                active={form.category === item}
                onPress={() => setForm((value) => ({ ...value, category: item }))}
              />
            ))}
          </CXRow>
          <CXSectionHeader title="Condition" />
          <CXRow style={styles.filters}>
            {["New", "Like New", "Good", "Fair", "Poor"].map((item: any) => (
              <CXChip
                key={item}
                label={item}
                active={form.condition === item}
                onPress={() => setForm((value) => ({ ...value, condition: item }))}
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
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <CXInput
                label="Location"
                icon="location-outline"
                value={fetchingLocation ? "Loading location..." : form.location.name}
                editable={!fetchingLocation}
                onChangeText={(text) =>
                  setForm((value) => ({ 
                    ...value, 
                    location: {
                      name: text,
                      address: text,
                      latitude: null,
                      longitude: null,
                    }
                  }))
                }
              />
            </View>
            <Pressable
              onPress={() => void getCurrentLocation()}
              disabled={fetchingLocation}
              style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#E0E0E0", alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="locate" size={24} color={fetchingLocation ? "#999" : "#6C63FF"} />
            </Pressable>
          </View>
          {error ? <CXText color="#F44336">{error}</CXText> : null}
          <CXButton
            label="Publish Listing"
            loading={saving}
            onPress={() => void save()}
          />

        </View>
      )}
      <CXSnackbar visible={snackbarVisible} message={snackbarMessage} onDismiss={() => setSnackbarVisible(false)} />
    </CXScrollScreen>
  );
}

export function ManageListingsScreen({
  navigation,
}: StackProps<"ManageListings">) {
  const queryClient = useQueryClient();
  const { data: myListings = [] } = useQuery({
    queryKey: marketplaceKeys.myListings(),
    queryFn: async () => await marketplaceService.getMyListings()
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string, payload: any }) => {
      await marketplaceService.updateListing(id, payload);
    },
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: marketplaceKeys.myListings() });
      const prev = queryClient.getQueryData(marketplaceKeys.myListings());
      queryClient.setQueryData(marketplaceKeys.myListings(), (old: any) => 
        old ? old.map((l: any) => l.id === id ? { ...l, ...payload } : l) : old
      );
      return { prev };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(marketplaceKeys.myListings(), context?.prev);
      setSnackbarMessage("Error updating listing");
      setSnackbarVisible(true);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.myListings() });
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.feed() });
      setSnackbarMessage(variables.payload.status === "sold" ? "Listing marked as sold" : "Listing updated");
      setSnackbarVisible(true);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await marketplaceService.deleteListing(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: marketplaceKeys.myListings() });
      const prev = queryClient.getQueryData(marketplaceKeys.myListings());
      queryClient.setQueryData(marketplaceKeys.myListings(), (old: any) => 
        old ? old.filter((l: any) => l.id !== id) : old
      );
      return { prev };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(marketplaceKeys.myListings(), context?.prev);
      setSnackbarMessage("Error deleting listing");
      setSnackbarVisible(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.myListings() });
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.feed() });
      setSnackbarMessage("Listing deleted successfully");
      setSnackbarVisible(true);
    }
  });

  const [filter, setFilter] = useState<"all" | "available" | "sold">("available");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [listingToDelete, setListingToDelete] = useState<any>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const displayedListings = myListings.filter((l: any) => {
    const matchesFilter = filter === "all" || l.status === filter;
    const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });
  
  const totalViews = myListings.reduce((sum: number, l: any) => sum + (l.views || 0), 0);
  const soldListingsCount = myListings.filter((l: any) => l.status === "sold").length;

  const remove = (id: string) => {
    deleteMutation.mutate(id);
  };
  
  const markSold = (id: string) => {
    updateMutation.mutate({ id, payload: { status: "sold" } });
  };
  return (
    <CXScreen>
      <CXHeader
        title="Manage Listings"
        onBack={navigation.goBack}
        right={
          <View style={{ marginRight: 8 }}>
            <CXIconButton
              icon="add"
              label="New listing"
              onPress={() => navigation.navigate("CreateListing")}
            />
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <CXSearchBar 
          placeholder="Search my listings..." 
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery("")}
        />
        <CXRow style={styles.filters}>
          <CXChip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
          <CXChip label="Active" active={filter === "available"} onPress={() => setFilter("available")} />
          <CXChip label="Sold" active={filter === "sold"} onPress={() => setFilter("sold")} />
        </CXRow>
        <CXCard>
          <CXText variant="bodyStrong">Your Marketplace Overview</CXText>
          <CXRow style={styles.overview}>
            {[
              [myListings.filter((l: any) => l.status === "available").length.toString(), "Active Listings"],
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
        <CXSectionHeader title="Your Listings" />
        {displayedListings.map((listing: any) => (
          <TouchableOpacity 
            key={listing.id} 
            onPress={() => { setSelectedListing(listing); setActionSheetVisible(true); }}
            onLongPress={() => {
              setListingToDelete(listing);
            }}
          >
            <CXCard style={styles.manageRow}>
              {listing.images?.[0] ? (
                <Image
                  source={{ uri: listing.images[0] }}
                  contentFit="cover"
                  style={styles.manageImage}
                />
              ) : (
                <View style={[styles.manageImage, { backgroundColor: '#F0F0F0' }]} />
              )}
              <View style={styles.flex}>
                <CXText variant="bodyStrong">{listing.title}</CXText>
                <CXText variant="title" color={colors.primary}>
                  ₹{listing.price.toLocaleString("en-IN")}
                </CXText>
              </View>
              <Ionicons
                name="ellipsis-vertical"
                size={18}
                color={colors.textFaint}
              />
            </CXCard>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <CXActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        title={selectedListing?.title}
        actions={[
          {
            label: "Edit",
            icon: "create-outline" as any,
            onPress: () => {
              setActionSheetVisible(false);
              navigation.navigate("CreateListing", { editId: selectedListing?.id });
            }
          },
          ...(selectedListing?.status !== "sold" ? [{
            label: "Mark Sold",
            icon: "checkmark-circle-outline" as any,
            onPress: () => {
              setActionSheetVisible(false);
              markSold(selectedListing?.id);
            }
          }] : []),
          {
            label: "Delete",
            icon: "trash-outline" as any,
            destructive: true,
            confirmationTitle: "Delete Listing?",
            confirmationMessage: "Are you sure you want to delete this listing? This cannot be undone.",
            confirmationButtonText: "Delete",
            onPress: () => {
              setActionSheetVisible(false);
              remove(selectedListing?.id);
            }
          }
        ]}
      />
      <Modal visible={!!listingToDelete} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24, width: '100%', alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFEBEB', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="trash-outline" size={32} color="#F44336" />
            </View>
            <CXText variant="h3" style={{ marginBottom: 8 }}>Delete Listing?</CXText>
            <CXText variant="body" color="#666" align="center" style={{ marginBottom: 24 }}>
              Are you sure you want to permanently delete &quot;{listingToDelete?.title}&quot;? This action cannot be undone.
            </CXText>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <View style={{ flex: 1 }}>
                <CXButton variant="outline" label="Cancel" onPress={() => setListingToDelete(null)} />
              </View>
              <View style={{ flex: 1 }}>
                <CXButton 
                  label="Delete" 
                  style={{ backgroundColor: '#F44336', borderColor: '#F44336' }} 
                  onPress={() => {
                    remove(listingToDelete?.id);
                    setListingToDelete(null);
                  }} 
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <CXSnackbar visible={snackbarVisible} message={snackbarMessage} onDismiss={() => setSnackbarVisible(false)} />
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
  const [cachedWeather, setCachedWeather] = useState<any>(null);
  
  // App store states
  const locationCoords = useAppStore((state) => state.locationCoords);
  const setLocationCoords = useAppStore((state) => state.setLocationCoords);
  const savedDestinations = useAppStore((state) => state.savedDestinations);
  const toggleSavedDestination = useAppStore((state) => state.toggleSavedDestination);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<{lat: number, lon: number, name: string, region?: string, country?: string} | null>(null);

  // Read cache on mount
  useEffect(() => {
    (async () => {
      try {
        const cache = await AsyncStorage.getItem("campusx.weather.cache");
        if (cache) {
          setCachedWeather(JSON.parse(cache));
        }
      } catch (e) {
        console.warn("Failed to read weather cache", e);
      }
    })();
  }, []);

  // Fetch device location non-blocking
  useEffect(() => {
    if (!locationCoords) {
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const pos = await Location.getLastKnownPositionAsync();
          if (pos) {
            setLocationCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          }
          const currentPos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLocationCoords({ lat: currentPos.coords.latitude, lon: currentPos.coords.longitude });
        } catch (e) {
          console.warn("Weather location fetch error:", e);
        }
      })();
    }
  }, [locationCoords, setLocationCoords]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch search suggestions
  const { data: suggestions = [] } = useQuery({
    queryKey: ["weatherSearch", debouncedQuery],
    queryFn: async ({ signal }) => {
      if (debouncedQuery.length < 2) return [];
      return searchCities(debouncedQuery, locationCoords?.lat, locationCoords?.lon, signal);
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60000,
  });

  // Determine which location to show weather for
  const activeLat = selectedCity?.lat ?? locationCoords?.lat;
  const activeLon = selectedCity?.lon ?? locationCoords?.lon;
  const activeCityName = selectedCity?.name ?? "Current Location";

  // Fetch weather data
  const { data: weather, isLoading: loading } = useQuery({
    queryKey: ["weather", activeLat, activeLon],
    queryFn: async () => {
      if (!activeLat || !activeLon) throw new Error("No coords");
      const data = await fetchWeatherForLocation(activeLat, activeLon, activeCityName, selectedCity?.region, selectedCity?.country);
      // Save to cache on success
      AsyncStorage.setItem("campusx.weather.cache", JSON.stringify(data)).catch(() => {});
      return data;
    },
    enabled: !!activeLat && !!activeLon,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const displayWeather = weather ?? cachedWeather;

  const temp = displayWeather?.temp ?? "--";
  const condition = displayWeather?.condition ?? (loading ? "Loading..." : "--");
  const humidity = displayWeather?.humidity ?? "--";
  const wind = displayWeather?.wind ?? "--";

  return (
    <CXScrollScreen>
      <CXHeader
        title={displayWeather?.city ?? (loading ? "Locating..." : "Weather")}
        subtitle={displayWeather?.region && displayWeather?.country ? `${displayWeather.region}, ${displayWeather.country}` : "Live Weather"}
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
            setSelectedCity(null);
          }}
          onSubmitEditing={() => {}}
        />
        {suggestions.length > 0 && searchQuery.length > 0 && (
          <View style={[styles.dropdownList, { maxHeight: 220, marginBottom: 12 }]}>
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
              {suggestions.map((item: any, idx: number) => (
                <Pressable 
                  key={item.id} 
                  style={[
                    styles.dropdownItem, 
                    idx !== suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }
                  ]}
                  onPress={() => {
                    setSearchQuery(""); // Clear query to hide dropdown
                    setSelectedCity({ lat: item.latitude, lon: item.longitude, name: item.name, region: item.region, country: item.country });
                  }}
                >
                  <CXRow style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <CXText variant="bodyStrong">{item.name}</CXText>
                      <CXText variant="caption" color={colors.textMuted} numberOfLines={1}>
                        {item.label}
                        {item.distanceKm !== undefined ? ` • ${Math.round(item.distanceKm)}km` : ""}
                      </CXText>
                    </View>
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
            name={(displayWeather?.icon as any) ?? "sunny"} 
            size={80} 
            color={displayWeather?.icon?.includes?.("sunny") ? "#FFE780" : "#FFFFFF"} 
          />
        </CXRow>
        <CXRow style={styles.hourly}>
          {(displayWeather?.hourly ?? []).map((item: any) => (
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
            ["UV Index", displayWeather?.uvIndex ?? "6", "sunny-outline"],
            ["Sunrise", displayWeather?.sunrise ?? "05:58 AM", "partly-sunny-outline"],
          ].map(([label, value, icon]) => (
            <CXCard key={label as string} style={styles.weatherFact}>
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={20}
                color={colors.primary}
              />
              <CXText variant="bodyStrong">{value as string}</CXText>
              <CXText variant="caption" color={colors.textMuted}>
                {label as string}
              </CXText>
            </CXCard>
          ))}
        </CXRow>
      </View>
      <CXSectionHeader
        title="7-Day Forecast"
        action="See all"
        onAction={() => navigation.navigate("WeatherDetails", { lat: activeLat, lon: activeLon, name: activeCityName } as any)}
      />
      {(displayWeather?.daily?.slice(0, 4) ?? []).map((item: any) => (
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
        {savedDestinations.map((dest: any) => (
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
  route,
  navigation,
}: StackProps<"WeatherDetails">) {
  const { weather, savedDestinations, toggleSavedDestination } = useAppStore();
  const { lat, lon, name } = route.params || {};

  const { data: cachedWeather } = useQuery({
    queryKey: ["weather", lat, lon],
    queryFn: async () => {
      if (!lat || !lon) throw new Error("No coords");
      return await fetchWeatherForLocation(lat, lon, name);
    },
    enabled: !!lat && !!lon,
    staleTime: 1000 * 60 * 5,
  });

  const displayWeather = cachedWeather ?? weather;
  const isSaved = displayWeather?.city ? savedDestinations.some(d => d.city === displayWeather.city) : false;

  return (
    <CXScrollScreen contentContainerStyle={{ gap: spacing.md }}>
      <CXHeader
        title={displayWeather?.city ?? "Loading..."}
        subtitle="Live Weather"
        onBack={navigation.goBack}
        right={
          <CXIconButton
            icon={isSaved ? "heart" : "heart-outline"}
            label={isSaved ? "Saved" : `Save ${displayWeather?.city ?? "City"}`}
            backgroundColor={colors.transparent}
            onPress={() => displayWeather?.city && toggleSavedDestination(displayWeather.city, `${displayWeather.temp}°C`)}
          />
        }
      />
      <LinearGradient
        colors={["#F5A84F", "#7257F5"]}
        style={styles.destinationWeather}
      >
        <Ionicons name={(displayWeather?.icon as any) ?? "sunny"} size={58} color="#FFE780" />
        <View style={styles.flex}>
          <CXText variant="hero" color={colors.white}>
            {displayWeather?.temp ?? "--"}°C
          </CXText>
          <CXText variant="bodyStrong" color={colors.white}>
            {displayWeather?.condition ?? "--"}
          </CXText>
        </View>
      </LinearGradient>
      <CXSectionHeader title="7-Day Forecast" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dailyRow}>
        {(displayWeather?.daily ?? []).map((item: any) => (
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
      {(displayWeather?.hourly ?? []).map(
        (item: any) => (
          <CXListRow
            key={item.time}
            icon={item.icon as any}
            title={`${item.time}  ${item.temp}`}
            subtitle={displayWeather?.condition ?? "Clear skies"}
          />
        ),
      )}
      <CXRow style={styles.weatherFacts}>
        {[
          ["Humidity", displayWeather?.humidity ?? "61%"],
          ["Wind", displayWeather?.wind ?? "12 km/h"],
          ["UV Index", displayWeather?.uvIndex ?? "6"],
          ["Sunrise", displayWeather?.sunrise ?? "05:58 AM"],
        ].map(([label, value]) => (
          <View key={label} style={styles.flex}>
            <CXText variant="caption" color={colors.textMuted}>
              {label}
            </CXText>
            <CXText variant="bodyStrong">{value}</CXText>
          </View>
        ))}
      </CXRow>
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
