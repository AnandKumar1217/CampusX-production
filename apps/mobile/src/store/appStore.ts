import { Platform } from "react-native";
import * as Location from "expo-location";
import type { TimetableEntry, EventItem, Listing, StudyGroup } from "@/types/domain";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { setupSocketInvalidations } from "@/services/socketEvents";
const { persist, createJSONStorage } = require("zustand/middleware") as typeof import("zustand/middleware");
import { type ChatMessage } from "@/services/ai";
import { connectSocket, disconnectSocket, getSocket } from "@/services/socket";
import { queryClient } from "@/query/queryClient";
import { api, queueCredentialOperation, resetApiSession, setApiSessionToken } from "@/services/api";
import { consumePendingRoute } from "@/navigation/PushRoutingManager";
import type { TimeSlot } from "@/types/domain";

import type { MainTabName } from "@/types/navigation";

const ONBOARDING_KEY = "campusx.onboarding.complete";
const ACCESS_TOKEN_KEY = "campusx.auth.access-token";
const REFRESH_TOKEN_KEY = "campusx.auth.refresh-token";
const USER_KEY = "campusx.auth.user";
const LEGACY_SGPA_KEY = "campusx.sgpas";
const LEGACY_STORE_KEY = "campusx-storage";
const PUSH_TOKEN_KEY = "campusx.push.token";
const PERSONAL_KEY_PREFIX = "campusx.personal.";

const DEFAULT_GRID_TIME_SLOTS: TimeSlot[] = [
  { id: "slot-0900", label: "09:00 - 10:00", start: "09:00" },
  { id: "slot-1015", label: "10:15 - 11:15", start: "10:15" },
  { id: "slot-1130", label: "11:30 - 12:30", start: "11:30" },
  { id: "slot-1230", label: "12:30 - 13:15", start: "12:30", break: true },
  { id: "slot-1315", label: "13:15 - 14:00", start: "13:15" },
  { id: "slot-1400", label: "14:00 - 15:00", start: "14:00" },
];

type PersonalState = Pick<AppState, "gridTimeSlots" | "savedListings" | "savedPosts" | "savedEvents" | "aiConversations">;
export const emptyPersonalState = (): PersonalState => ({
  gridTimeSlots: DEFAULT_GRID_TIME_SLOTS,
  savedListings: [],
  savedPosts: [],
  savedEvents: [],
  aiConversations: [],
});
const personalKey = (userId: string) => `${PERSONAL_KEY_PREFIX}${encodeURIComponent(userId)}`;
let sessionGeneration = 0;

async function loadPersonalState(userId: string): Promise<PersonalState> {
  try {
    const raw = await AsyncStorage.getItem(personalKey(userId));
    if (!raw) return emptyPersonalState();
    const saved = JSON.parse(raw) as Partial<PersonalState>;
    return {
      gridTimeSlots: saved.gridTimeSlots ?? DEFAULT_GRID_TIME_SLOTS,
      savedListings: saved.savedListings ?? [],
      savedPosts: saved.savedPosts ?? [],
      savedEvents: saved.savedEvents ?? [],
      aiConversations: saved.aiConversations ?? [],
    };
  } catch (error) {
    console.warn("Failed to load personal state", error);
    return emptyPersonalState();
  }
}

function savePersonalState(state: AppState) {
  if (!state.user?.id || !state.accessToken) return;
  const personal: PersonalState = {
    gridTimeSlots: state.gridTimeSlots,
    savedListings: state.savedListings,
    savedPosts: state.savedPosts,
    savedEvents: state.savedEvents,
    aiConversations: state.aiConversations,
  };
  AsyncStorage.setItem(personalKey(state.user.id), JSON.stringify(personal)).catch(console.error);
}

type User = {
  id: string;
  name: string;
  username: string;
  email?: string;
  avatarUrl?: string | null;
  avatar?: string | null;
  department?: string;
  academicYear?: string;
  college?: string;
  bio?: string;
  verified?: boolean;
  online?: boolean;
  lat?: number;
  lon?: number;
  qrToken?: string | null;
};



export type FriendLiveLocation = {
  userId: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  lat: number;
  lon: number;
  updatedAt: number;
  status?: string;
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
  unreadNotifications: number;
  setUnreadNotifications: (count: number) => void;
  incrementUnreadNotifications: () => void;
  decrementUnreadNotifications: () => void;
  hydrate: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  fetchUnreadNotifications: () => Promise<void>;
  finishOnboarding: () => Promise<void>;
  setSession: (accessToken: string, refreshToken: string, user: User) => Promise<void>;
  clearSession: () => Promise<void>;
  savedDestinations: { city: string; temp: string }[];
  toggleSavedDestination: (city: string, temp: string) => void;

  gridTimeSlots: TimeSlot[];
  setGridTimeSlots: (slots: TimeSlot[]) => void;
  addTimeSlot: (slot: TimeSlot) => void;
  deleteTimeSlot: (id: string) => void;
  listings: any[];
  studyGroups: any[];
  posts: any[];
  weather: any;
  events: EventItem[];
  addEvent: (event: EventItem) => void;
  updateEvent: (id: string, partial: Partial<EventItem>) => void;

  savedPosts: string[];
  toggleSavedPost: (id: string) => void;
  savedListings: string[];
  toggleSavedListing: (id: string) => void;
  savedEvents: string[];
  toggleSavedEvent: (id: string) => void;

  friends: User[];
  fetchFriends: () => Promise<void>;
  addFriend: (user: User) => void;
  removeFriend: (id: string) => void;
  aiConversations: { id: string; title: string; messages: ChatMessage[]; updatedAt: number }[];
  saveAIConversation: (id: string, title: string, messages: ChatMessage[]) => void;
  deleteAIConversation: (id: string) => void;
  clearAIConversations: () => void;
  locationSharingEnabled: boolean;
  setLocationSharingEnabled: (enabled: boolean) => void;
  locationCoords: {lat: number, lon: number} | null;
  setLocationCoords: (coords: {lat: number, lon: number} | null) => void;
  friendLocations: Record<string, FriendLiveLocation>;
  setFriendLocation: (userId: string, data: Partial<FriendLiveLocation> & { lat: number; lon: number; updatedAt: number }) => void;
  removeFriendLocation: (userId: string) => void;
  updateFriendIdentity: (userId: string, name?: string, avatarUrl?: string, username?: string) => void;
  fetchInitialFriendLocations: () => Promise<void>;
  fetchLocationSettings: () => Promise<void>;
  boundSocketInstance: any;

  setupSocketListeners: () => void;
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
      return { user: updated };
    });
  },
  sgpas: {},
  updateSgpa: async (semester, sgpa) => {
    set((state) => {
      const newSgpas = { ...state.sgpas, [semester]: sgpa };
      const api = require("../services/api").api;
      api.patch("/users/me", { sgpas: newSgpas }).catch(console.error);
      return { sgpas: newSgpas };
    });
  },
  activeTab: "Home",
  setActiveTab: (activeTab) => set({ activeTab }),
  unreadNotifications: 0,
  setUnreadNotifications: (count) => set({ unreadNotifications: count }),
  incrementUnreadNotifications: () => set((state) => ({ unreadNotifications: state.unreadNotifications + 1 })),
  decrementUnreadNotifications: () => set((state) => ({ unreadNotifications: Math.max(0, state.unreadNotifications - 1) })),
  hydrate: async () => {
    const generation = ++sessionGeneration;
    try {
      const [onboarding, accessToken] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_KEY),
        Platform.OS !== "web" 
          ? SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
          : AsyncStorage.getItem(ACCESS_TOKEN_KEY),
      ]);
      if (generation !== sessionGeneration) return;
      setApiSessionToken(accessToken);
      set({
        hydrated: true,
        onboardingComplete: onboarding === "true",
        accessToken,
        user: null,
        ...emptyPersonalState(),
      });
      // A cached profile is not proof of the account represented by the token.
      // Splash verifies /users/me before showing any private state.
      await Promise.all([
        AsyncStorage.removeItem(LEGACY_SGPA_KEY),
        AsyncStorage.removeItem(USER_KEY),
        AsyncStorage.removeItem(LEGACY_STORE_KEY),
      ]);
    } catch (e) {
      console.log("Failed to load state", e);
      if (generation === sessionGeneration) { setApiSessionToken(null); set({ hydrated: true, accessToken: null, user: null, ...emptyPersonalState() }); }
    }
  },
  fetchCurrentUser: async () => {
    const generation = sessionGeneration;
    const token = get().accessToken;
    if (!token) return;
    try {
      const { api } = require("../services/api");
      const res = await api.get("/users/me");
      if (generation !== sessionGeneration || !get().accessToken) return;
      if (res.data?.data?._id || res.data?.data?.id) {
        const canonicalUser = { ...res.data.data, id: String(res.data.data.id ?? res.data.data._id) } as User;
        const personal = await loadPersonalState(canonicalUser.id);
        if (generation !== sessionGeneration || !get().accessToken) return;
        set({ user: canonicalUser, sgpas: (canonicalUser as any).sgpas || {}, ...personal });
        connectSocket(get().accessToken!);
        get().setupSocketListeners();
        get().fetchFriends().catch(console.error);
        get().fetchInitialFriendLocations().catch(console.error);
        get().fetchLocationSettings().catch(console.error);
        get().fetchUnreadNotifications().catch(console.error);
      }
      else { throw new Error("Authenticated profile has no user ID"); }
    } catch (e) {
      console.log("Failed to fetch current user", e);
      throw e;
    }
  },
  fetchUnreadNotifications: async () => {
    const generation = sessionGeneration;
    const userId = get().user?.id;
    if (!userId) return;
    try {
      const { api } = require("../services/api");
      const res = await api.get("/notifications");
      if (generation === sessionGeneration && get().user?.id === userId && res.data?.data) {
        get().setUnreadNotifications(res.data.data.unread || 0);
      }
    } catch (e) {
      console.log("Failed to fetch notifications", e);
    }
  },
  savedDestinations: [],
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
  gridTimeSlots: DEFAULT_GRID_TIME_SLOTS,
  events: [],
  listings: [],
  studyGroups: [],
  posts: [],
  weather: null,
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  updateEvent: (id, partial) => set((state) => ({
    events: state.events.map((e) => e.id === id ? { ...e, ...partial } : e)
  })),

  setGridTimeSlots: (slots) => { set({ gridTimeSlots: slots }); savePersonalState(get()); },
  addTimeSlot: (slot) => {
    set((state) => {
      const slots = [...state.gridTimeSlots, slot].sort((a, b) => a.start.localeCompare(b.start));
      return { gridTimeSlots: slots };
    });
    savePersonalState(get());
  },
  deleteTimeSlot: (id) => {
    set((state) => {
      const slots = state.gridTimeSlots.filter(s => s.id !== id);
      return { gridTimeSlots: slots };
    });
    savePersonalState(get());
  },

  friends: [],
  fetchFriends: async () => {
    const generation = sessionGeneration;
    const userId = get().user?.id;
    if (!userId) return;
    try {
      const { api } = require("../services/api");
      const res = await api.get("/friends");
      if (generation === sessionGeneration && get().user?.id === userId && res.data?.data) {
        set({ friends: res.data.data.map((u: any) => ({ ...u, id: u._id || u.id })) });
      }
    } catch (e) {
      console.log("Failed to fetch friends", e);
    }
  },
  addFriend: (user) => set((state) => {
    if (state.friends.some(f => f.id === user.id)) return state;
    return { friends: [...state.friends, { ...user, isFriend: true }] };
  }),
  removeFriend: async (id) => {
    const userId = get().user?.id;
    try {
      const { api } = require("../services/api");
      await api.delete(`/friends/${id}`);
      if (get().user?.id === userId) {
        set((state) => ({ friends: state.friends.filter((u) => u.id !== id) }));
      }
    } catch (e) {
      console.error("Failed to remove friend", e);
    }
  },
    saveAIConversation: (id: string, title, messages) => {
      set((state) => {
        const existingIndex = state.aiConversations.findIndex((c) => c.id === id);
        if (existingIndex >= 0) {
          const updated = [...state.aiConversations];
          updated[existingIndex] = { ...updated[existingIndex], title, messages, updatedAt: Date.now(), id };
          return { aiConversations: updated.sort((a, b) => b.updatedAt - a.updatedAt) };
        }
        return {
          aiConversations: [
            { id, title, messages, updatedAt: Date.now() },
            ...state.aiConversations,
          ],
        };
      });
      savePersonalState(get());
    },
    deleteAIConversation: (id) => {
      set((state) => ({
        aiConversations: state.aiConversations.filter((c) => c.id !== id),
      }));
      savePersonalState(get());
    },
    clearAIConversations: () => { set({ aiConversations: [] }); savePersonalState(get()); },

  savedListings: [],
  toggleSavedListing: (id) => {
    set((state) => {
      const isSaved = state.savedListings.includes(id);
      return {
        savedListings: isSaved
          ? state.savedListings.filter((savedId) => savedId !== id)
          : [...state.savedListings, id],
      };
    });
    savePersonalState(get());
  },
  savedPosts: [],
  toggleSavedPost: (id) => {
    set((state) => {
      const isSaved = state.savedPosts.includes(id);
      return { savedPosts: isSaved ? state.savedPosts.filter((savedId) => savedId !== id) : [...state.savedPosts, id] };
    });
    savePersonalState(get());
  },
    savedEvents: [],
    aiConversations: [],
    toggleSavedEvent: (id) => {
      set((state) => {
        const isSaved = state.savedEvents.includes(id);
        return { savedEvents: isSaved ? state.savedEvents.filter((savedId) => savedId !== id) : [...state.savedEvents, id] };
      });
      savePersonalState(get());
    },
  finishOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    set({ onboardingComplete: true });
  },
  setSession: async (accessToken, refreshToken, user) => {
    const generation = ++sessionGeneration;
    resetApiSession();
    disconnectSocket();
    consumePendingRoute();
    Notifications.dismissAllNotificationsAsync().catch(console.warn);
    set({ accessToken: null, user: null, activeTab: "Home", friends: [], friendLocations: {}, locationSharingEnabled: false, unreadNotifications: 0, boundSocketInstance: null, events: [], savedDestinations: [], ...emptyPersonalState() });
    await queryClient.cancelQueries();
    queryClient.clear();
    if (generation !== sessionGeneration) return;
    const canonicalUser = { ...user, id: String(user.id ?? (user as any)._id) } as User;
    await queueCredentialOperation(async () => {
      if (generation !== sessionGeneration) return;
      if (Platform.OS !== "web") {
        await Promise.all([
          SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
          SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
        ]);
      } else {
        await Promise.all([
          AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken),
          AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
        ]);
      }
    });
    if (generation !== sessionGeneration) return;
    const personal = await loadPersonalState(canonicalUser.id);
    if (generation !== sessionGeneration) return;
    setApiSessionToken(accessToken);
    set({ accessToken, user: canonicalUser, ...personal });
    if (accessToken) {
      connectSocket(accessToken);
      get().setupSocketListeners();
      get().fetchFriends().catch(console.error);
      get().fetchInitialFriendLocations().catch(console.error);
      get().fetchLocationSettings().catch(console.error);
      get().fetchUnreadNotifications().catch(console.error);
    }
  },
  clearSession: async () => {
    const previousAccessToken = get().accessToken;
    const generation = ++sessionGeneration;
    resetApiSession();
    disconnectSocket();
    consumePendingRoute();
    Notifications.dismissAllNotificationsAsync().catch(console.warn);
    set({ accessToken: null, user: null, activeTab: "Home", friends: [], friendLocations: {}, locationSharingEnabled: false, unreadNotifications: 0, boundSocketInstance: null, events: [], savedDestinations: [], ...emptyPersonalState() });
    const deleteCredentials = queueCredentialOperation(async () => {
      if (Platform.OS !== "web") {
        await Promise.all([
          SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
          SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
          AsyncStorage.removeItem(USER_KEY),
          AsyncStorage.removeItem(LEGACY_SGPA_KEY),
          AsyncStorage.removeItem(LEGACY_STORE_KEY),
        ]);
      } else {
        await Promise.all([
          AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
          AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
          AsyncStorage.removeItem(USER_KEY),
          AsyncStorage.removeItem(LEGACY_SGPA_KEY),
          AsyncStorage.removeItem(LEGACY_STORE_KEY),
        ]);
      }
    });
    await queryClient.cancelQueries();
    queryClient.clear();
    if (previousAccessToken) {
      try {
        const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
        if (pushToken) {
          await axios.post(`${api.defaults.baseURL}/push/unregister`, { token: pushToken }, {
            headers: { Authorization: `Bearer ${previousAccessToken}` },
            timeout: 3000,
          });
          if (generation === sessionGeneration) await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
        }
      } catch (error) {
        console.warn("Failed to unregister push token on logout", error);
      }
    }
    await deleteCredentials;
  },
  locationSharingEnabled: false,
  setLocationSharingEnabled: (enabled) => set({ locationSharingEnabled: enabled }),
  locationCoords: null,
  setLocationCoords: (coords) => set({ locationCoords: coords }),
  friendLocations: {},
  boundSocketInstance: null,
  setFriendLocation: (userId, data) => set((state) => {
    const existing = state.friendLocations[userId];
    const friend = state.friends?.find(f => f.id === userId);
    // Safely merge identity
    const name = data.name || existing?.name || friend?.name || "Friend";
    const avatarUrl = data.avatarUrl || existing?.avatarUrl || friend?.avatarUrl || friend?.avatar;

    return {
      friendLocations: {
        ...state.friendLocations,
        [userId]: {
          ...existing,
          ...data,
          userId,
          name,
          avatarUrl,
        } as FriendLiveLocation
      }
    };
  }),
  removeFriendLocation: (userId) => set((state) => {
    const updated = { ...state.friendLocations };
    delete updated[userId];
    return { friendLocations: updated };
  }),
  updateFriendIdentity: (userId, name, avatarUrl, username) => set((state) => {
    const friendLocations = { ...state.friendLocations };
    const existingLoc = friendLocations[userId];
    if (existingLoc) {
      friendLocations[userId] = {
        ...existingLoc,
        name: name ?? existingLoc.name,
        avatarUrl: avatarUrl ?? existingLoc.avatarUrl,
        username: username ?? (existingLoc as any).username
      };
    }

    const friends = state.friends.map(f => {
      if (f.id === userId) {
        return { ...f, name: name ?? f.name, avatarUrl: avatarUrl ?? f.avatarUrl, username: username ?? (f as any).username };
      }
      return f;
    });

    const user = state.user?.id === userId ? {
      ...state.user,
      name: name ?? state.user.name,
      avatarUrl: avatarUrl ?? state.user.avatarUrl,
      username: username ?? state.user.username,
    } : state.user;

    return { friendLocations, friends, user };
  }),
  fetchInitialFriendLocations: async () => {
    const generation = sessionGeneration;
    const userId = get().user?.id;
    if (!userId) return;
    try {
      const { api } = require("../services/api");
      const res = await api.get("/location/friends");
      const locations = res.data?.data;
      if (generation === sessionGeneration && get().user?.id === userId && Array.isArray(locations)) {
        set((state) => {
          const next = { ...state.friendLocations };
          locations.forEach((loc: any) => {
            const updatedAt = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
            if (loc.user) {
              const existing = next[loc.user.id];
              // Only overwrite if the fetched location is newer than what we already have
              if (!existing || updatedAt >= (existing.updatedAt || 0)) {
                next[loc.user.id] = {
                  userId: loc.user.id,
                  name: loc.user.name,
                  avatarUrl: loc.user.avatar || loc.user.avatarUrl,
                  lat: loc.latitude,
                  lon: loc.longitude,
                  updatedAt,
                  status: loc.status,
                };
              }
            }
          });
          return { friendLocations: next };
        });
      }
    } catch (e) {
      console.log("Failed to fetch initial friend locations", e);
    }
  },
  fetchLocationSettings: async () => {
    const generation = sessionGeneration;
    const userId = get().user?.id;
    if (!userId) return;
    try {
      const { api } = require("../services/api");
      const res = await api.get("/location/settings");
      if (generation === sessionGeneration && get().user?.id === userId && res.data?.data) {
        set({ locationSharingEnabled: res.data.data.enabled });
      }
    } catch (e) {
      console.log("Failed to fetch location settings", e);
    }
  },
  setupSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;
    if (get().boundSocketInstance === socket) return;
    set({ boundSocketInstance: socket });
    // Remove existing listeners to avoid duplicates










    setupSocketInvalidations(socket, {
      removeFriendLocation: get().removeFriendLocation,
      updateFriendIdentity: get().updateFriendIdentity,
      fetchInitialFriendLocations: get().fetchInitialFriendLocations,
    });

    socket.on("location:friend_updated", (payload: any) => {
      if (!payload.user?.id) return;
      get().setFriendLocation(payload.user.id, {
        name: payload.user.name,
        avatarUrl: payload.user.avatar || payload.user.avatarUrl,
        lat: payload.latitude,
        lon: payload.longitude,
        updatedAt: payload.updatedAt ? new Date(payload.updatedAt).getTime() : Date.now(),
        status: "active",
      });
    });

    socket.on("location:friend_unavailable", (payload: any) => {
      get().removeFriendLocation(payload.userId);
    });

    socket.on("notification:new", () => {
      const userId = get().user?.id;
      if (!userId) return;
      void get().fetchUnreadNotifications();
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    });

    const refreshFriends = () => { void get().fetchFriends(); };
    socket.on("friend:accepted", refreshFriends);
    socket.on("friend:removed", refreshFriends);
    socket.on("connect", () => {
      void get().fetchFriends();
      void get().fetchInitialFriendLocations();
      void get().fetchUnreadNotifications();
      const reconcile = new Set(["feed", "events", "listings", "savedListings", "savedEvents", "groups", "myGroups", "group", "trips", "trip", "chats", "notifications", "profile-summary"]);
      queryClient.invalidateQueries({ predicate: (query) => reconcile.has(String(query.queryKey[0])) });
    });
    socket.on("notification:read", () => {
      get().fetchUnreadNotifications();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
  },

    }),
    {
      name: "campusx-storage",
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      // Version 1 included the cached user and private arrays in one device-wide key.
      // Drop that record; personal data is now stored under an authenticated user key.
      migrate: () => ({}),
      partialize: (state) => ({
        sgpas: state.sgpas,
      }),
    }
  )
);
