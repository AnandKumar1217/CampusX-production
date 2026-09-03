import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { parseTimetableImage, type ChatMessage } from "@/services/ai";
import { connectSocket, disconnectSocket } from "@/services/socket";

import type { MainTabName } from "@/types/navigation";

const ONBOARDING_KEY = "campusx.onboarding.complete";
const ACCESS_TOKEN_KEY = "campusx.auth.access-token";
const REFRESH_TOKEN_KEY = "campusx.auth.refresh-token";
const USER_KEY = "campusx.auth.user";

type User = {
  id: string;
  name: string;
  username: string;
  email?: string;
  avatarUrl?: string | null;
  department?: string;
  academicYear?: string;
  college?: string;
  bio?: string;
};

export type HourlyForecast = {
  time: string;
  temp: string;
  icon: string;
};

export type DailyForecast = {
  day: string;
  temp: string;
  icon: string;
};

export type WeatherData = {
  temp: string;
  condition: string;
  icon: string;
  iconOutline: string;
  humidity: string;
  wind: string;
  city: string;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  uvIndex: string;
  sunrise: string;
  travelTip: {
    title: string;
    desc: string;
    icon: string;
  };
};

export type TimeSlot = {
  id: string;
  label: string;
  start: string;
  break?: boolean;
};

type AppState = {
  hydrated: boolean;
  onboardingComplete: boolean;
  accessToken: string | null;
  user: User | null;
  updateUser: (partial: Partial<User>) => void;
  sgpas: Record<number, number>;
  updateSgpa: (semester: number, sgpa: number) => void;
  activeTab: MainTabName;
  setActiveTab: (tab: MainTabName) => void;
  hydrate: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  finishOnboarding: () => Promise<void>;
  setSession: (accessToken: string, refreshToken: string, user: User) => Promise<void>;
  clearSession: () => Promise<void>;
  savedDestinations: { city: string; temp: string }[];
  toggleSavedDestination: (city: string, temp: string) => void;
  weather: WeatherData | null;
  fetchWeather: () => Promise<void>;
  fetchWeatherForCity: (city: string) => Promise<void>;
  fetchWeatherForCoords: (lat: number, lon: number, city: string) => Promise<void>;
  locationCoords: { lat: number; lon: number } | null;
  timetable: TimetableEntry[];
  addTimetableEntry: (entry: TimetableEntry) => void;
  updateTimetableEntry: (id: string, partial: Partial<TimetableEntry>) => void;
  deleteTimetableEntry: (id: string) => void;
  gridTimeSlots: TimeSlot[];
  addTimeSlot: (slot: TimeSlot) => void;
  updateTimeSlot: (id: string, partial: Partial<TimeSlot>) => void;
  deleteTimeSlot: (id: string) => void;
  scanTimetableImage: (uri: string) => Promise<void>;
  events: EventItem[];
  addEvent: (event: EventItem) => void;
  updateEvent: (id: string, partial: Partial<EventItem>) => void;
  listings: Listing[];
  addListing: (listing: Listing) => void;
  updateListing: (id: string, partial: Partial<Listing>) => void;
  deleteListing: (id: string) => void;
  savedListings: string[];
  toggleSavedListing: (id: string) => void;
  savedPosts: string[];
  toggleSavedPost: (id: string) => void;
  savedEvents: string[];
  toggleSavedEvent: (id: string) => void;
  incrementListingViews: (id: string) => void;
  studyGroups: StudyGroup[];
  addStudyGroup: (group: StudyGroup) => void;
  updateStudyGroup: (id: string, partial: Partial<StudyGroup>) => void;
  deleteStudyGroup: (id: string) => void;
  toggleGroupMembership: (id: string) => void;
  friends: User[];
  addFriend: (user: User) => void;
  removeFriend: (id: string) => void;
  aiConversations: { id: string; title: string; messages: ChatMessage[]; updatedAt: number }[];
  saveAIConversation: (id: string, title: string, messages: ChatMessage[]) => void;
  deleteAIConversation: (id: string) => void;
  clearAIConversations: () => void;
};

import { Platform } from "react-native";
import * as Location from "expo-location";
import type { TimetableEntry, EventItem, Listing, StudyGroup } from "@/types/domain";

export const generateTravelTip = (city: string, condition: string) => {
  const c = city.toLowerCase();
  const w = condition.toLowerCase();
  
  if (w.includes("rain") || w.includes("storm") || w.includes("drizzle") || w.includes("thunder")) {
    return {
      title: "Rainy weather expected",
      desc: "Carry an umbrella and plan indoor activities for today.",
      icon: "umbrella-outline"
    };
  }
  if (w.includes("snow")) {
    return {
      title: "Snow expected",
      desc: "Dress warmly in layers and watch out for slippery roads.",
      icon: "snow-outline"
    };
  }
  if (c.includes("goa") || c.includes("mumbai") || c.includes("beach") || c.includes("maldives")) {
    return {
      title: "Perfect beach weather",
      desc: "Great time for a beach visit! Carry sunscreen and stay hydrated.",
      icon: "water-outline"
    };
  }
  if (c.includes("manali") || c.includes("shimla") || c.includes("kashmir") || c.includes("mountain") || c.includes("coorg")) {
    return {
      title: "Mountain exploration",
      desc: "Perfect weather for hiking. Wear comfortable shoes and carry water.",
      icon: "trail-sign-outline"
    };
  }
  if (w.includes("sunny") || w.includes("clear")) {
    return {
      title: "Great time for sightseeing",
      desc: "Clear skies ahead! Don't forget your sunglasses and a hat.",
      icon: "glasses-outline"
    };
  }
  
  return {
    title: "Good for outdoor walks",
    desc: "Pleasant weather conditions. Perfect for exploring the city.",
    icon: "walk-outline"
  };
};

export const mapWeatherCode = (code: number) => {
  let cond = "Sunny";
  let icon = "sunny";
  let iconOutline = "sunny-outline";
  
  if (code === 1 || code === 2) {
    cond = "Partly Cloudy";
    icon = "partly-sunny";
    iconOutline = "partly-sunny-outline";
  } else if (code === 3 || code === 45 || code === 48) {
    cond = "Cloudy";
    icon = "cloud";
    iconOutline = "cloud-outline";
  } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    cond = "Rain";
    icon = "rainy";
    iconOutline = "rainy-outline";
  } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    cond = "Snow";
    icon = "snow";
    iconOutline = "snow-outline";
  } else if (code >= 95) {
    cond = "Thunderstorm";
    icon = "thunderstorm";
    iconOutline = "thunderstorm-outline";
  }
  return { cond, icon, iconOutline };
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  hydrated: false,
  onboardingComplete: false,
  accessToken: null,
  user: null,
  updateUser: (partial) => {
    set((state) => {
      if (!state.user) return state;
      const updated = { ...state.user, ...partial };
      AsyncStorage.setItem(USER_KEY, JSON.stringify(updated)).catch(console.error);
      return { user: updated };
    });
  },
  sgpas: {},
  updateSgpa: async (semester, sgpa) => {
    let newSgpas: Record<number, number> = {};
    set((state) => {
      newSgpas = { ...state.sgpas, [semester]: sgpa };
      return { sgpas: newSgpas };
    });
    await AsyncStorage.setItem("campusx.sgpas", JSON.stringify(newSgpas));
  },
  activeTab: "Home",
  setActiveTab: (activeTab) => set({ activeTab }),
  hydrate: async () => {
    try {
      const [onboarding, accessToken, userStr, sgpasStr] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_KEY),
        Platform.OS !== "web" 
          ? SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
          : AsyncStorage.getItem(ACCESS_TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
        AsyncStorage.getItem("campusx.sgpas"),
      ]);
      set({
        hydrated: true,
        onboardingComplete: onboarding === "true",
        accessToken,
        user: userStr ? JSON.parse(userStr) : null,
        sgpas: sgpasStr ? JSON.parse(sgpasStr) : {},
      });
      if (accessToken) {
        connectSocket(accessToken);
      }
    } catch (e) {
      console.log("Failed to load state", e);
    }
  },
  fetchCurrentUser: async () => {
    try {
      const { api } = require("../services/api");
      const res = await api.get("/users/me");
      if (res.data?.data) {
        set({ user: res.data.data });
        AsyncStorage.setItem(USER_KEY, JSON.stringify(res.data.data)).catch(console.error);
      }
    } catch (e) {
      console.log("Failed to fetch current user", e);
      throw e;
    }
  },
  savedDestinations: [
    { city: "Goa", temp: "29°C" },
    { city: "Coorg", temp: "20°C" },
    { city: "Mumbai", temp: "31°C" },
  ],
  toggleSavedDestination: (city, temp) => {
    set((state) => {
      const exists = state.savedDestinations.find((d) => d.city === city);
      if (exists) {
        return {
          savedDestinations: state.savedDestinations.filter((d) => d.city !== city),
        };
      } else {
        return {
          savedDestinations: [...state.savedDestinations, { city, temp }],
        };
      }
    });
  },
  timetable: [],
  addTimetableEntry: (entry) => set((state) => ({ timetable: [...state.timetable, entry] })),
  updateTimetableEntry: (id, partial) =>
    set((state) => ({
      timetable: state.timetable.map((t) => (t.id === id ? { ...t, ...partial } : t)),
    })),
  deleteTimetableEntry: (id) =>
    set((state) => ({
      timetable: state.timetable.filter((t) => t.id !== id),
    })),
  gridTimeSlots: [
    { id: "slot-0900", label: "09:00 - 10:00", start: "09:00" },
    { id: "slot-1015", label: "10:15 - 11:15", start: "10:15" },
    { id: "slot-1130", label: "11:30 - 12:30", start: "11:30" },
    { id: "slot-1230", label: "12:30 - 13:15", start: "12:30", break: true },
    { id: "slot-1315", label: "13:15 - 14:00", start: "13:15" },
    { id: "slot-1400", label: "14:00 - 15:00", start: "14:00" },
  ],
  events: [],
  addTimeSlot: (slot) => set((state) => {
    const newSlots = [...state.gridTimeSlots, slot].sort((a, b) => a.start.localeCompare(b.start));
    return { gridTimeSlots: newSlots };
  }),
  updateTimeSlot: (id, partial) => set((state) => {
    const newSlots = state.gridTimeSlots.map((t) => (t.id === id ? { ...t, ...partial } : t)).sort((a, b) => a.start.localeCompare(b.start));
    return { gridTimeSlots: newSlots };
  }),
  deleteTimeSlot: (id) => set((state) => ({
    gridTimeSlots: state.gridTimeSlots.filter((t) => t.id !== id),
  })),
  scanTimetableImage: async (base64Data) => {
    try {
      const { gridTimeSlots, timetable } = await parseTimetableImage(base64Data);
      set({ gridTimeSlots, timetable });
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  updateEvent: (id, partial) => set((state) => ({
    events: state.events.map((e) => e.id === id ? { ...e, ...partial } : e)
  })),
  listings: [],
  addListing: (listing) => set((state) => ({ listings: [listing, ...state.listings] })),
  updateListing: (id, partial) => set((state) => ({
    listings: state.listings.map((l) => (l.id === id ? { ...l, ...partial } : l)),
  })),
  deleteListing: (id) => set((state) => ({
    listings: state.listings.filter((l) => l.id !== id),
  })),
  incrementListingViews: (id) =>
    set((state) => ({
      listings: state.listings.map((l) =>
        l.id === id ? { ...l, views: (l.views || 0) + 1 } : l
      ),
    })),
  studyGroups: [],
  addStudyGroup: (group) =>
    set((state) => ({ studyGroups: [group, ...state.studyGroups] })),
  updateStudyGroup: (id, partial) =>
    set((state) => ({
      studyGroups: state.studyGroups.map((g) =>
        g.id === id ? { ...g, ...partial } : g
      ),
    })),
  deleteStudyGroup: (id) =>
    set((state) => ({
      studyGroups: state.studyGroups.filter((g) => g.id !== id),
    })),
  toggleGroupMembership: (id) =>
    set((state) => ({
      studyGroups: state.studyGroups.map((g) =>
        g.id === id ? { ...g, joined: !g.joined, members: g.joined ? g.members - 1 : g.members + 1 } : g
      ),
    })),
  friends: [],
  addFriend: (user) => set((state) => ({ friends: [...state.friends, { ...user, isFriend: true }] })),
    removeFriend: (id) =>
      set((state) => ({
        friends: state.friends.filter((u) => u.id !== id),
      })),
    saveAIConversation: (id, title, messages) =>
      set((state) => {
        const existingIndex = state.aiConversations.findIndex((c) => c.id === id);
        if (existingIndex >= 0) {
          const updated = [...state.aiConversations];
          updated[existingIndex] = { ...updated[existingIndex], title, messages, updatedAt: Date.now() };
          return { aiConversations: updated.sort((a, b) => b.updatedAt - a.updatedAt) };
        }
        return {
          aiConversations: [
            { id, title, messages, updatedAt: Date.now() },
            ...state.aiConversations,
          ],
        };
      }),
    deleteAIConversation: (id) =>
      set((state) => ({
        aiConversations: state.aiConversations.filter((c) => c.id !== id),
      })),
    clearAIConversations: () => set({ aiConversations: [] }),
  savedListings: [],
  toggleSavedListing: (id) => set((state) => {
    const isSaved = state.savedListings.includes(id);
    return { savedListings: isSaved ? state.savedListings.filter((savedId) => savedId !== id) : [...state.savedListings, id] };
  }),
  savedPosts: [],
  toggleSavedPost: (id) => set((state) => {
    const isSaved = state.savedPosts.includes(id);
    return { savedPosts: isSaved ? state.savedPosts.filter((savedId) => savedId !== id) : [...state.savedPosts, id] };
  }),
    savedEvents: [],
    aiConversations: [],
    toggleSavedEvent: (id) =>
 set((state) => {
    const isSaved = state.savedEvents.includes(id);
    return { savedEvents: isSaved ? state.savedEvents.filter((savedId) => savedId !== id) : [...state.savedEvents, id] };
  }),
  finishOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    set({ onboardingComplete: true });
  },
  setSession: async (accessToken, refreshToken, user) => {
    if (Platform.OS !== "web") {
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
      ]);
    } else {
      await Promise.all([
        AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken),
        AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
      ]);
    }
    set({ accessToken, user });
    if (accessToken) {
      connectSocket(accessToken);
    }
  },
  clearSession: async () => {
    if (Platform.OS !== "web") {
      await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      ]);
    } else {
      await Promise.all([
        AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
        AsyncStorage.removeItem(USER_KEY),
      ]);
    }
    disconnectSocket();
    set({ accessToken: null, user: null, activeTab: "Home" });
  },
  weather: null, locationCoords: null,
  fetchWeather: async () => {
    try {
      let lat = 12.9716;
      let lon = 77.5946;
      let city = "Bengaluru, India";

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = location.coords.latitude;
          lon = location.coords.longitude;
          
          const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (geocode && geocode.length > 0) {
            const loc = geocode[0]!;
            const place = loc.city || loc.subregion || loc.region;
            if (place) city = `${place}, ${loc.country || ""}`.trim().replace(/,\s*$/, "");
          }
        }
      } catch (locErr) {
        console.log("Location access failed, using default coords:", locErr);
      }

      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=sunrise,uv_index_max,temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`);
      const data = await res.json();
      
      const { cond, icon, iconOutline } = mapWeatherCode(data.current.weather_code);

      const nowTime = new Date().getTime();
      let closestIndex = 0;
      let minDiff = Infinity;
      data.hourly.time.forEach((tStr: string, idx: number) => {
        const diff = Math.abs(new Date(tStr).getTime() - nowTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = idx;
        }
      });

      const hourly: HourlyForecast[] = [];
      for (let i = 0; i < 5; i++) {
        const idx = closestIndex + i;
        if (idx >= data.hourly.time.length) break;
        
        const t = new Date(data.hourly.time[idx]);
        let hour = t.getHours();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        hour = hour ? hour : 12;
        const timeStr = i === 0 ? "Now" : `${hour} ${ampm}`;
        
        const hCode = mapWeatherCode(data.hourly.weather_code[idx]);
        hourly.push({
          time: timeStr,
          temp: `${Math.round(data.hourly.temperature_2m[idx])}°`,
          icon: hCode.iconOutline,
        });
      }

      const sunriseDate = new Date(data.daily.sunrise[0]);
      let sHour = sunriseDate.getHours();
      const sAmpm = sHour >= 12 ? 'PM' : 'AM';
      sHour = sHour % 12;
      sHour = sHour ? sHour : 12;
      const sMins = sunriseDate.getMinutes().toString().padStart(2, '0');
      const sunriseStr = `${sHour}:${sMins} ${sAmpm}`;
      const uvIndexStr = Math.round(data.daily.uv_index_max[0]).toString();

      const daily: DailyForecast[] = [];
      const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
        const d = new Date(data.daily.time[i]);
        const dayStr = i === 0 ? "Today" : (daysOfWeek[d.getDay()]!);
        const dCode = mapWeatherCode(data.daily.weather_code[i]);
        
        daily.push({
          day: dayStr,
          temp: `${Math.round(data.daily.temperature_2m_max[i])}°`,
          icon: dCode.iconOutline,
        });
      }

      set({
        locationCoords: { lat, lon },
        weather: {
          temp: Math.round(data.current.temperature_2m).toString(),
          condition: cond,
          icon,
          iconOutline,
          humidity: data.current.relative_humidity_2m.toString() + "%",
          wind: data.current.wind_speed_10m.toString() + " km/h",
          city,
          hourly,
          daily,
          uvIndex: uvIndexStr,
          sunrise: sunriseStr,
          travelTip: generateTravelTip(city, cond),
        }
      });
    } catch (err) {
      console.log("Failed to fetch weather:", err);
      set({
        weather: {
          temp: "24",
          condition: "Sunny (Offline)",
          icon: "sunny",
          iconOutline: "sunny-outline",
          humidity: "58%",
          wind: "12 km/h",
          city: "Bengaluru, India",
          uvIndex: "7",
          sunrise: "6:00 AM",
          travelTip: generateTravelTip("Bengaluru, India", "Sunny (Offline)"),
          daily: [],
          hourly: [
            { time: "Now", temp: "24°", icon: "sunny-outline" },
            { time: "11 AM", temp: "26°", icon: "sunny-outline" },
            { time: "12 PM", temp: "28°", icon: "sunny-outline" },
            { time: "1 PM", temp: "29°", icon: "sunny-outline" },
            { time: "2 PM", temp: "30°", icon: "sunny-outline" },
          ],
        }
      });
    }
  },
  fetchWeatherForCity: async (searchCity: string) => {
    try {
      const geocode = await Location.geocodeAsync(searchCity);
      if (!geocode || geocode.length === 0) return;
      
      const { latitude: lat, longitude: lon } = geocode[0]!;
      
      let displayCity = searchCity;
      const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (reverse && reverse.length > 0) {
        const loc = reverse[0]!;
        const place = loc.city || loc.subregion || loc.region;
        if (place) displayCity = `${place}, ${loc.country || ""}`.trim().replace(/,\s*$/, "");
      }

      await get().fetchWeatherForCoords(lat, lon, displayCity);
    } catch (err) {
      console.log("Failed to search city weather:", err);
    }
  },
  fetchWeatherForCoords: async (lat: number, lon: number, city: string) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=sunrise,uv_index_max,temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`);
      const data = await res.json();
      
      const { cond, icon, iconOutline } = mapWeatherCode(data.current.weather_code);

      const nowTime = new Date().getTime();
      let closestIndex = 0;
      let minDiff = Infinity;
      data.hourly.time.forEach((tStr: string, idx: number) => {
        const diff = Math.abs(new Date(tStr).getTime() - nowTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = idx;
        }
      });

      const hourly: HourlyForecast[] = [];
      for (let i = 0; i < 5; i++) {
        const idx = closestIndex + i;
        if (idx >= data.hourly.time.length) break;
        
        const t = new Date(data.hourly.time[idx]);
        let hour = t.getHours();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        hour = hour ? hour : 12;
        const timeStr = i === 0 ? "Now" : `${hour} ${ampm}`;
        
        const hCode = mapWeatherCode(data.hourly.weather_code[idx]);
        hourly.push({
          time: timeStr,
          temp: `${Math.round(data.hourly.temperature_2m[idx])}°`,
          icon: hCode.iconOutline,
        });
      }

        const sunriseDate = new Date(data.daily.sunrise[0]);
        let sHour = sunriseDate.getHours();
        const sAmpm = sHour >= 12 ? 'PM' : 'AM';
        sHour = sHour % 12;
        sHour = sHour ? sHour : 12;
        const sMins = sunriseDate.getMinutes().toString().padStart(2, '0');
        const sunriseStr = `${sHour}:${sMins} ${sAmpm}`;
        const uvIndexStr = Math.round(data.daily.uv_index_max[0]).toString();

        const daily: DailyForecast[] = [];
        const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
          const d = new Date(data.daily.time[i]);
          const dayStr = i === 0 ? "Today" : (daysOfWeek[d.getDay()]!);
          const dCode = mapWeatherCode(data.daily.weather_code[i]);
          
          daily.push({
            day: dayStr,
            temp: `${Math.round(data.daily.temperature_2m_max[i])}°`,
            icon: dCode.iconOutline,
          });
        }

      set({
        weather: {
          temp: Math.round(data.current.temperature_2m).toString(),
          condition: cond,
          icon,
          iconOutline,
          humidity: data.current.relative_humidity_2m.toString() + "%",
          wind: data.current.wind_speed_10m.toString() + " km/h",
          city,
          hourly,
          daily,
          uvIndex: uvIndexStr,
          sunrise: sunriseStr,
          travelTip: generateTravelTip(city, cond),
        }
      });
    } catch (err) {
      console.log("Failed to fetch weather for coords:", err);
    }
  },
    }),
    {
      name: "campusx-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        const { hydrated, accessToken, ...rest } = state;
        return rest;
      },
    }
  )
);



