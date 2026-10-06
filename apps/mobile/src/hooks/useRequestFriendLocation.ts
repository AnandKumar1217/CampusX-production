import { useState, useCallback, useRef, useEffect } from "react";
import { ToastAndroid, Platform, Alert } from "react-native";
import { api } from "../services/api";
import { useAppStore } from "../store/appStore";

export function useRequestFriendLocation() {
  const [refreshingFriends, setRefreshingFriends] = useState<Record<string, boolean>>({});
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});
  const setFriendLocation = useAppStore(state => state.setFriendLocation);
  const friendLocations = useAppStore(state => state.friendLocations);

  const showToast = (msg: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      // Fallback for iOS
      Alert.alert("", msg);
    }
  };

  const requestFriendLocation = useCallback(async (friendId: string) => {
    // A. Cached location stays visible immediately (it's already in the store)
    
    setRefreshingFriends(prev => ({ ...prev, [friendId]: true }));
    showToast("Refreshing location...");

    try {
      // B. Call POST /location/friends/:friendId/refresh
      const res = await api.post(`/location/friends/${friendId}/refresh`);
      
      const { status, requestId, lastKnown } = res.data?.data || {};

      // C. If result.status === "sharing_off"
      if (status === "sharing_off") {
        setRefreshingFriends(prev => ({ ...prev, [friendId]: false }));
        
        const existing = useAppStore.getState().friendLocations[friendId];
        if (existing) {
          setFriendLocation(friendId, { ...existing, sharingEnabled: false });
          showToast("Live location is turned off. Showing last shared location.");
        } else {
          showToast("Location unavailable.");
        }
        return;
      }

      // D. If result.status === "requested"
      if (status === "requested" || status === "cooldown") {
        // preserve marker, show refreshing
        // timeout after 10 seconds
        if (timeoutRefs.current[friendId]) {
          clearTimeout(timeoutRefs.current[friendId]);
        }

        timeoutRefs.current[friendId] = setTimeout(() => {
          setRefreshingFriends(prev => {
            const next = { ...prev };
            delete next[friendId];
            return next;
          });
          showToast("Couldn't refresh live location. Showing last shared location.");
        }, 10000);
      }

    } catch (err: any) {
      setRefreshingFriends(prev => ({ ...prev, [friendId]: false }));
      if (err.response?.status === 429) {
        showToast("Already requested recently. Please wait.");
      } else {
        showToast("Couldn't refresh live location. Showing last shared location.");
      }
    }
  }, [setFriendLocation]);

  // E. Handle successful update from socket
  
  useEffect(() => {
    const now = Date.now();
    let changed = false;
    const nextRefreshing = { ...refreshingFriends };

    for (const friendId in nextRefreshing) {
      if (nextRefreshing[friendId]) {
        const loc = friendLocations[friendId];
        if (loc && (now - loc.updatedAt) < 5000) {
          // Fresh update arrived
          if (timeoutRefs.current[friendId]) {
            clearTimeout(timeoutRefs.current[friendId]);
            delete timeoutRefs.current[friendId];
          }
          delete nextRefreshing[friendId];
          changed = true;
          showToast("Live location updated!");
        }
      }
    }
    
    if (changed) {
      setRefreshingFriends(nextRefreshing);
    }
  }, [friendLocations]);
  return { requestFriendLocation, refreshingFriends, timeoutRefs };
}
