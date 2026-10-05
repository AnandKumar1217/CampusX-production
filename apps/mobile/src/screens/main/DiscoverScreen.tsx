import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useCallback, useEffect, useState, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View, Keyboard, BackHandler, Linking , TextInput, Text } from "react-native";
import MapView, { Marker, Callout } from "@/components/map/MapView";

import {
  CXAvatar,
  CXText,
} from "@/components/ui";

import { useRootNavigation } from "@/hooks/useRootNavigation";
import { useOpenChat } from "@/hooks/useOpenChat";
import { useFocusEffect } from "@react-navigation/native";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme";

const categories = [
  ["Map", "map-outline"],
  ["People", "people-outline"],
  ["Events", "ticket-outline"],
  ["Groups", "school-outline"],
  ["Places", "location-outline"],
] as const;

function getLocationFreshness(updatedAt: number) {
  const diffMin = (Date.now() - updatedAt) / 60000;
  if (diffMin <= 2) return "LIVE";
  if (diffMin <= 15) return "RECENT";
  return "STALE";
}

function formatTimeAgo(updatedAt: number) {
  const diffSec = Math.floor((Date.now() - updatedAt) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hr ago`;
  return `${Math.floor(diffHour / 24)} days ago`;
}

export function DiscoverScreen() {
  const navigation = useRootNavigation();
  const { openChat, isMessaging } = useOpenChat();
  const [region, setRegion] = useState({
    latitude: 12.9676,
    longitude: 77.7154,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [mapMarkers, setMapMarkers] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<any | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeMode, setActiveMode] = useState<"places" | "friends">("places");
  const friends = useAppStore(state => state.friends);
  const friendLocations = useAppStore(state => state.friendLocations);
  const activeOnlineFriends = Object.values(friendLocations); // Shows everyone sharing location, offline or online
  const user = useAppStore(state => state.user);
  const locationCoords = useAppStore(state => state.locationCoords);
  const setLocationCoords = useAppStore(state => state.setLocationCoords);
  const cameraRef = useRef<any>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const stateRef = useRef({ searchQuery, isSearchFocused, selectedPlace, mapMarkers, activeMode });
  stateRef.current = { searchQuery, isSearchFocused, selectedPlace, mapMarkers, activeMode };

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        const { searchQuery, isSearchFocused, selectedPlace, mapMarkers, activeMode } = stateRef.current;
        if (activeMode === "friends") {
          setActiveMode("places");
          return true; // intercept default back behavior
        }
        if (searchQuery || isSearchFocused || selectedPlace || selectedFriend || mapMarkers.length > 0) {
          setSearchQuery("");
          setSearchResults([]);
          setIsSearchFocused(false);
          setSelectedPlace(null);
          setSelectedFriend(null);
          setMapMarkers([]);
          return true; // intercept default back behavior
        }
        return false;
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const addToRecent = (query: string) => {
    if (!query) return;
    setRecentSearches((prev: any) => {
      const filtered = prev.filter((q: any) => q !== query);
      return [query, ...filtered].slice(0, 5); // Keep last 5
    });
  };

  const formatPlace = (place: any) => {
    const coords = place?.geometry?.coordinates || [region.longitude, region.latitude];
    const props = place?.properties || {};
    return {
      ...place,
      lat: coords[1],
      lon: coords[0],
      display_name: props.name || props.street || props.city || "Unknown Place",
      formatted_address: [props.street, props.city, props.state].filter(Boolean).join(", ")
    };
  };

  // Helper to calculate distance in kilometers between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const p = 0.017453292519943295; // Math.PI / 180
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p) / 2 + 
              c(lat1 * p) * c(lat2 * p) * 
              (1 - c((lon2 - lon1) * p)) / 2;
    return 12742 * Math.asin(Math.sqrt(a)); // 12742 = 2 * R (Earth radius 6371 km)
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      
      if (activeMode === "friends") {
        const queryLower = searchQuery.toLowerCase();
        const matchedFriends = friends.filter(f => 
          f.online && f.lat && f.lon && f.name.toLowerCase().includes(queryLower)
        );
        setSearchResults(matchedFriends);
        return;
      }

      // Use Photon API for better POI autocomplete heavily biased to user's location
      fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&lat=${region.latitude}&lon=${region.longitude}&limit=8`, {
        headers: {
          "User-Agent": "CampusXApp/1.0"
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.features) {
            // Strictly sort by shortest distance first based on user's current region
            const sortedResults = data.features.sort((a: any, b: any) => {
              const coordsA = a?.geometry?.coordinates || [region.longitude, region.latitude];
              const coordsB = b?.geometry?.coordinates || [region.longitude, region.latitude];
              const distA = calculateDistance(region.latitude, region.longitude, coordsA[1], coordsA[0]);
              const distB = calculateDistance(region.latitude, region.longitude, coordsB[1], coordsB[0]);
              return distA - distB;
            });
            setSearchResults(sortedResults);
          }
        })
        .catch(err => {
          console.log("Search error:", err);
          setSearchResults([]);
        });
    }, 400); // 400ms debounce

    return () => clearTimeout(handler);
  }, [searchQuery, region.latitude, region.longitude, activeMode, friends]);

  const handleSelectPlace = (place: any) => {
    const formatted = formatPlace(place);
    setSelectedPlace(formatted);
    addToRecent(formatted.display_name);
    setRegion({
      latitude: formatted.lat,
      longitude: formatted.lon,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    });
    cameraRef.current?.easeTo({
      center: [formatted.lon, formatted.lat],
      zoom: 15,
      duration: 600
    });
    setSearchQuery(formatted.display_name);
    setIsSearchFocused(false);
  };
  
  const executeMapSearch = (query: string) => {
    if (!query.trim()) return;
    setSearchQuery(query);
    addToRecent(query);
    
    if (activeMode === "friends") {
      const queryLower = query.toLowerCase();
      const matched = friends.filter(f => f.name.toLowerCase().includes(queryLower));
      const firstOnline = matched.find(f => f.online && f.lat && f.lon);
      if (firstOnline) {
        setRegion((prev: any) => ({
          ...prev,
          latitude: firstOnline.lat!,
          longitude: firstOnline.lon!,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }));
        cameraRef.current?.easeTo({
          center: [firstOnline.lon!, firstOnline.lat!],
          zoom: 15,
          duration: 600
        });
        setIsSearchFocused(false);
      }
      return;
    }

    fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${region.latitude}&lon=${region.longitude}&limit=15`, {
      headers: { "User-Agent": "CampusXApp/1.0" }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.features && data.features.length > 0) {
          const formatted = data.features.map(formatPlace);
          setMapMarkers(formatted);
          setIsSearchFocused(false);
          setSearchResults([]);
          
          // Center the map on the first result so they aren't lost
          const first = formatted[0];
          setRegion((prev: any) => ({
            ...prev,
            latitude: first.lat,
            longitude: first.lon,
            latitudeDelta: 0.02, // Zoom out slightly to show multiple pins
            longitudeDelta: 0.02,
          }));
          cameraRef.current?.easeTo({
            center: [first.lon, first.lat],
            zoom: 14,
            duration: 600
          });
        } else {
          // If no results, just close search
          setIsSearchFocused(false);
        }
      })
      .catch(console.log);
  };

  const handleCategorySearch = (category: string) => {
    executeMapSearch(category);
  };
  useFocusEffect(
    useCallback(() => {
      void Location.requestForegroundPermissionsAsync().then(
        async ({ status }) => {
          if (status !== "granted") return;
          try {
            // Immediately clear the UI so it visually resets with zero latency
            setSelectedPlace(null);
            setSelectedFriend(null);
            setMapMarkers([]);
            setSearchQuery("");
            setSearchResults([]);
            setIsSearchFocused(false);

            // Fetch last known location for instant camera centering
            let location = await Location.getLastKnownPositionAsync();
            
            if (!location) {
              // Fallback to slower GPS fetch only if we have zero cached location history
              location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });
            }
            
            if (location) {
              setLocationCoords({ lat: location.coords.latitude, lon: location.coords.longitude });
              setRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              });
              cameraRef.current?.easeTo({
                center: [location.coords.longitude, location.coords.latitude],
                zoom: 15,
                duration: 600
              });
            }
          } catch (error) {
            console.log("Location error:", error);
          }
        },
      );
    }, [])
  );
  return (
    <View style={styles.container}>
      <MapView
        cameraRef={cameraRef}
        style={StyleSheet.absoluteFill}
        region={region}
        toolbarEnabled={false}
        rotateEnabled={true}
        pitchEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
        zoomControlEnabled={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        onPoiClick={(e: any) => {
          if (activeMode !== "places") return;
          const { coordinate, name } = e.nativeEvent;
          setSelectedPlace({
            lat: coordinate.latitude,
            lon: coordinate.longitude,
            display_name: name,
            formatted_address: "Point of Interest",
          });
          setSearchQuery(name);
          setRegion((prev: any) => ({ ...prev, latitude: coordinate.latitude, longitude: coordinate.longitude }));
          cameraRef.current?.easeTo({ center: [coordinate.longitude, coordinate.latitude], zoom: 15, duration: 600 });
        }}
        onPress={(e: any) => {
          Keyboard.dismiss();
          if (activeMode !== "places") return;
          const { coordinate, name } = e.nativeEvent;
          if (coordinate) {
            setSelectedPlace({
              lat: coordinate.latitude,
              lon: coordinate.longitude,
              display_name: name || "Finding location...",
              formatted_address: "Selected location on map",
            });
            setRegion((prev: any) => ({ ...prev, latitude: coordinate.latitude, longitude: coordinate.longitude }));
            cameraRef.current?.easeTo({ center: [coordinate.longitude, coordinate.latitude], zoom: 15, duration: 600 });

            if (!name) {
              fetch(`https://photon.komoot.io/reverse?lon=${coordinate.longitude}&lat=${coordinate.latitude}`)
                .then(res => res.json())
                .then(data => {
                  if (data && data.features && data.features.length > 0) {
                    const props = data.features[0].properties;
                    const placeName = props.name || props.street || props.locality || props.city || "Unknown Place";
                    const address = [props.locality, props.city, props.state].filter(Boolean).join(", ");
                    setSelectedPlace((prev: any) => prev ? {
                      ...prev,
                      display_name: placeName,
                      formatted_address: address || "Selected location on map"
                    } : null);
                  } else {
                    setSelectedPlace((prev: any) => prev ? { ...prev, display_name: "Selected location" } : null);
                  }
                })
                .catch(() => {
                  setSelectedPlace((prev: any) => prev ? { ...prev, display_name: "Selected location" } : null);
                });
            }
          }
        }}
      >
        {activeMode === "places" && mapMarkers.map((marker, index) => (
          <Marker
            key={`search-${index}`}
            coordinate={{ latitude: marker.lat, longitude: marker.lon }}
            title={marker.display_name}
            anchor="bottom"
            onPress={() => {
              setSelectedPlace(marker);
              setSearchQuery(marker.display_name);
            }}
          >
            <View style={{ alignItems: "center", justifyContent: "center", width: 36, height: 36 }}>
              <Ionicons name="location" size={36} color="#EA4335" style={{ textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 } as any} />
            </View>
          </Marker>
        ))}
        {activeMode === "places" && selectedPlace && (
          <Marker
            coordinate={{
              latitude: selectedPlace.lat,
              longitude: selectedPlace.lon,
            }}
            title={selectedPlace.display_name}
            anchor="bottom"
          >
            <View style={{ alignItems: "center", justifyContent: "center", width: 48, height: 48 }}>
              <Ionicons name="location" size={48} color="#EA4335" style={{ textShadowColor: 'rgba(0, 0, 0, 0.4)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 4 } as any} />
            </View>
          </Marker>
        )}
        
        {/* User's Current Location Marker */}
        {locationCoords && (
          <Marker
            coordinate={{ latitude: locationCoords.lat, longitude: locationCoords.lon }}
            title="You"
            anchor="center"
          >
            <View style={{ alignItems: "center", justifyContent: "center", width: 60, height: 60 }}>
              <View style={{ position: "absolute", width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(99, 56, 242, 0.2)" }} />
              <View style={{ position: "absolute", width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(99, 56, 242, 0.4)" }} />
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#6338F2", borderWidth: 3, borderColor: "white", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4 }} />
            </View>
          </Marker>
        )}

        {/* Friends Mode Markers */}
        {activeMode === "friends" && activeOnlineFriends.map((friend) => {
          if (!friend.lat || !friend.lon) return null;
          
          const friendObj = friends.find(f => f.id === friend.userId);
          const displayName = friendObj?.name || friend.name || "User";
          const avatar = friendObj?.avatar || friendObj?.avatarUrl || friend.avatarUrl;
          const isSelected = selectedFriend?.userId === friend.userId;

          return (
            <Marker
              key={`friend-${friend.userId}`}
              coordinate={{ latitude: friend.lat, longitude: friend.lon }}
              onPress={() => {
                setSelectedFriend({ ...friend, friendObj, displayName, avatar });
                cameraRef.current?.easeTo({ center: [friend.lon!, friend.lat!], zoom: 16, duration: 600 });
              }}
              style={{ zIndex: isSelected ? 100 : 1 }}
            >
              <View style={{ alignItems: "center" }}>
                {/* Real Image with white border and CampusX purple outer ring */}
                <View style={{
                  padding: 2,
                  borderRadius: 30,
                  backgroundColor: colors.white,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary : colors.primaryLight,
                  shadowColor: colors.primary,
                  shadowOpacity: isSelected ? 0.6 : 0.3,
                  shadowRadius: isSelected ? 10 : 5,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: isSelected ? 10 : 5,
                  transform: [{ scale: isSelected ? 1.2 : 1 }]
                }}>
                  {avatar ? (
                    <CXAvatar source={avatar} size={40} name={displayName} />
                  ) : (
                    <View style={{ width: 40, height: 40, backgroundColor: colors.surface, borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="person" size={24} color={colors.textMuted} />
                    </View>
                  )}
                  {/* Status indicator dot */}
                  <View style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: friend.status === "active" ? colors.success : colors.warning,
                    borderWidth: 2,
                    borderColor: colors.white
                  }} />
                </View>
                {/* Name Tag */}
                <View style={{ backgroundColor: isSelected ? colors.primary : "rgba(0,0,0,0.65)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 6 }}>
                  <CXText variant="small" color={colors.white} style={{ fontSize: 11, fontWeight: "600" }}>
                    {displayName.split(" ")[0]}
                  </CXText>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Mode Switcher */}
      {!isSearchFocused && (
        <View style={styles.modeSwitcherContainer}>
          <Pressable 
            style={[styles.modeSwitcherBtn, activeMode === "friends" && { backgroundColor: colors.primary }]}
            onPress={() => {
              setActiveMode((prev: any) => prev === "places" ? "friends" : "places");
              setSelectedPlace(null);
              setSelectedFriend(null);
              setSearchQuery("");
              setMapMarkers([]);
              setSearchResults([]);
              Keyboard.dismiss();
            }}
          >
            <Ionicons name={activeMode === "places" ? "people" : "location"} size={18} color={activeMode === "friends" ? colors.white : colors.primary} />
            <Text style={{ 
              color: activeMode === "friends" ? colors.white : colors.primary, 
              fontWeight: "bold", 
              fontSize: 13,
              marginLeft: 6
            }}>
              {activeMode === "places" ? "Track Friends" : "Explore Map"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Map Controls (Bottom Right) */}
      <View style={[styles.mapControls, (selectedPlace || selectedFriend) && { bottom: 180 }, isSearchFocused && { display: "none" }, activeMode === "friends" && !selectedFriend && { bottom: 220 }]}>
        <Pressable style={styles.fab} onPress={async () => {
          try {
            if (locationCoords) {
              cameraRef.current?.easeTo({
                center: [locationCoords.lon, locationCoords.lat],
                zoom: 15,
                duration: 600
              });
              return;
            }

            let location = await Location.getLastKnownPositionAsync();
            if (!location) {
              location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            }
            if (location) {
              setLocationCoords({ lat: location.coords.latitude, lon: location.coords.longitude });
              setRegion((prev: any) => ({ 
                ...prev, 
                latitude: location.coords.latitude, 
                longitude: location.coords.longitude 
              }));
              cameraRef.current?.easeTo({
                center: [location.coords.longitude, location.coords.latitude],
                zoom: 15,
                duration: 600
              });
            }
          } catch(e) {
            console.log("Recenter Error:", e);
          }
        }}>
          <Ionicons name="locate" size={24} color="#5F6368" />
        </Pressable>
      </View>

      {/* Floating / Fullscreen Search Container */}
      <View style={[styles.searchContainer, isSearchFocused && styles.searchContainerFocused, activeMode === "friends" && !isSearchFocused && { display: "none" }]}>
        <View style={[styles.searchBar, isSearchFocused && styles.searchBarFocused]}>
          {isSearchFocused ? (
            <Pressable onPress={() => { setIsSearchFocused(false); setSearchQuery(""); }} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.ink} />
            </Pressable>
          ) : (
            <Ionicons name="menu" size={24} color={colors.ink} />
          )}
          
          <TextInput
            style={styles.searchInput}
            placeholder={activeMode === "friends" ? "Search friends" : "Search places"}
            placeholderTextColor={colors.textFaint}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (!text.trim()) {
                setSelectedPlace(null);
                setMapMarkers([]);
                setSearchResults([]);
              }
            }}
            onFocus={() => {
              setIsSearchFocused(true);
              setSelectedPlace(null);
              setSelectedFriend(null);
              setMapMarkers([]);
              setSearchQuery("");
              setSearchResults([]);
            }}
            autoFocus={isSearchFocused}
            onSubmitEditing={() => executeMapSearch(searchQuery)}
            returnKeyType="search"
          />
          
          {searchQuery ? (
            <Pressable onPress={() => { 
              setSearchQuery(""); 
              setSearchResults([]);
              setSelectedPlace(null);
              setSelectedFriend(null);
              setMapMarkers([]);
            }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {!isSearchFocused && activeMode === "places" && (
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <View style={{ backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.pill, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="location" size={14} color={colors.primary} />
              <CXText variant="caption" color={colors.ink} style={{ fontWeight: '500' }}>
                Tap anywhere on the map to find a place
              </CXText>
            </View>
          </View>
        )}

        {/* Search Mode Content */}
        {isSearchFocused && (
          <View style={styles.searchModeContent}>
            {activeMode === "friends" ? (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {friends
                  .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((item, index) => {
                    const liveLoc = friendLocations[item.id];
                    const freshness = liveLoc ? getLocationFreshness(liveLoc.updatedAt) : null;
                    const isLive = freshness === "LIVE" || freshness === "RECENT";
                    return (
                      <Pressable 
                        key={`friend-search-${item.id}`} 
                        style={[styles.searchResultItem, { gap: 12, opacity: freshness ? 1 : 0.5 }]} 
                        onPress={() => {
                          if (freshness && liveLoc?.lat && liveLoc?.lon) {
                            setRegion((prev: any) => ({ ...prev, latitude: liveLoc.lat, longitude: liveLoc.lon, latitudeDelta: 0.02, longitudeDelta: 0.02 }));
                            cameraRef.current?.easeTo({ center: [liveLoc.lon, liveLoc.lat], zoom: 15, duration: 600 });
                            setIsSearchFocused(false);
                          }
                        }}
                      >
                        <CXAvatar source={item.avatar || item.avatarUrl || undefined} size={32} name={item.name} />
                        <View style={styles.flex}>
                          <CXText variant="bodyStrong">{item.name}</CXText>
                          <CXText variant="caption" color={isLive ? colors.primary : colors.textMuted}>
                            {freshness ? `${freshness} - ${formatTimeAgo(liveLoc?.updatedAt || 0)}` : "Location Hidden"}
                          </CXText>
                        </View>
                        {freshness && <Ionicons name="navigate-circle" size={24} color={isLive ? colors.primary : colors.textMuted} />}
                      </Pressable>
                    );
                  })}
              </ScrollView>
            ) : (
              <>
                {!searchQuery && (
                  <>
                    {recentSearches.length > 0 && (
                      <View style={styles.recentSearchesContainer}>
                        {recentSearches.map((query, index) => (
                          <Pressable key={index} style={styles.recentSearchItem} onPress={() => executeMapSearch(query)}>
                            <Ionicons name="time-outline" size={20} color={colors.textMuted} />
                            <CXText variant="body" numberOfLines={1}>{query}</CXText>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </>
                )}

                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {searchResults.map((item, index) => {
                    const name = item?.properties?.name || item?.properties?.street || "Unknown Place";
                    const details = [item?.properties?.street, item?.properties?.city, item?.properties?.state].filter(Boolean).join(", ");
                    
                    return (
                      <Pressable 
                        key={`place-${index}`} 
                        style={[
                          styles.searchResultItem,
                          index === searchResults.length - 1 && { borderBottomWidth: 0 }
                        ]} 
                        onPress={() => handleSelectPlace(item)}
                      >
                        <View style={styles.searchResultIcon}>
                          <Ionicons name="location" size={18} color={colors.textMuted} />
                        </View>
                        <View style={styles.flex}>
                          <CXText variant="bodyStrong" numberOfLines={1}>
                            {name}
                          </CXText>
                          <CXText variant="caption" color={colors.textMuted} numberOfLines={1}>
                            {details || "Location"}
                          </CXText>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>
        )}
      </View>
      
      {/* Selected Place Bottom Sheet/Card */}
      {selectedPlace && !isSearchFocused && activeMode === "places" && (
        <View style={styles.bottomCard}>
          <View style={styles.bottomCardHeader}>
            <View style={styles.flex}>
              <CXText variant="h3" numberOfLines={2}>
                {selectedPlace.display_name}
              </CXText>
              <CXText variant="caption" color={colors.textMuted} numberOfLines={2}>
                {selectedPlace.formatted_address || "Location on Map"}
              </CXText>
            </View>
            <Pressable 
              onPress={() => {
                setSelectedPlace(null);
                setSearchQuery("");
                setMapMarkers([]);
                setSearchResults([]);
                setIsSearchFocused(false);
              }} 
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          
          <View style={styles.actionRow}>
            <Pressable 
              style={styles.primaryAction}
              onPress={() => {
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.lat},${selectedPlace.lon}`);
              }}
            >
              <Ionicons name="navigate" size={20} color={colors.white} />
              <CXText variant="bodyStrong" color={colors.white}>Directions</CXText>
            </Pressable>
          </View>
        </View>
      )}

      {/* Selected Friend Bottom Sheet/Card */}
      {selectedFriend && !isSearchFocused && activeMode === "friends" && (
        <View style={styles.bottomCard}>
          <View style={styles.bottomCardHeader}>
            <View style={[styles.flex, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
              {selectedFriend.avatar ? (
                <CXAvatar source={selectedFriend.avatar} size={48} name={selectedFriend.displayName} />
              ) : (
                <View style={{ width: 48, height: 48, backgroundColor: colors.surface, borderRadius: 24, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="person" size={24} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.flex}>
                <CXText variant="h3" numberOfLines={1}>
                  {selectedFriend.displayName}
                </CXText>
                <CXText variant="caption" color={colors.textMuted} numberOfLines={1}>
                  {selectedFriend.friendObj?.username ? `@${selectedFriend.friendObj.username} • ` : ""}
                  {selectedFriend.status === "active" ? "Live" : "Recently active"}
                </CXText>
              </View>
            </View>
            <Pressable 
              onPress={() => setSelectedFriend(null)} 
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          
          <View style={[styles.actionRow, { flexDirection: "row", gap: spacing.md }]}>
            <Pressable 
              style={[styles.primaryAction, { flex: 1 }]}
              onPress={() => {
                navigation.navigate("UserProfile", { userId: selectedFriend.userId });
              }}
            >
              <Ionicons name="person" size={20} color={colors.white} />
              <CXText variant="bodyStrong" color={colors.white}>View Profile</CXText>
            </Pressable>
            <Pressable 
              style={[styles.secondaryAction, { flex: 1, justifyContent: "center" }]}
              disabled={isMessaging}
              onPress={() => {
                if (user) {
                  void openChat(selectedFriend.userId, selectedFriend.displayName);
                }
              }}
            >
              <Ionicons name="chatbubble" size={20} color={colors.primary} />
              <CXText variant="bodyStrong" color={colors.primary}>Message</CXText>
            </Pressable>
          </View>
        </View>
      )}

      {/* Friends Mode Bottom Sheet */}
      {activeMode === "friends" && (
        <View style={styles.friendsBottomCard}>
          <View style={styles.friendsBottomCardHeader}>
            <View>
              <CXText variant="h3">Tracking Friends</CXText>
              <CXText variant="body" color={colors.primary}>
                {activeOnlineFriends.length} sharing location
              </CXText>
            </View>
            <Pressable onPress={() => setIsSearchFocused(true)}>
              <Ionicons name="search" size={24} color={colors.ink} />
            </Pressable>
          </View>
          {activeOnlineFriends.length === 0 ? (
            <View style={{ padding: spacing.md, alignItems: "center", justifyContent: "center" }}>
              <CXText color={colors.textMuted} align="center">
                No friends are sharing their location right now.
              </CXText>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.md }}>
              {activeOnlineFriends.map((friend) => {
                const friendObj = friends.find(f => f.id === friend.userId);
                const displayName = friendObj?.name || friend.name || "User";
                const avatar = friendObj?.avatar || friendObj?.avatarUrl || friend.avatarUrl;
                
                const freshness = getLocationFreshness(friend.updatedAt);
                let freshnessStatus = formatTimeAgo(friend.updatedAt);
                const isLive = freshness === "LIVE" || freshness === "RECENT";
                const dotColor = freshness === "LIVE" ? colors.success : freshness === "RECENT" ? colors.warning : colors.textMuted;

                return (
                  <Pressable 
                    key={friend.userId} 
                    style={{
                      alignItems: "center",
                      width: 76,
                    }}
                    onPress={() => {
                      if (friend.lat && friend.lon) {
                        setRegion((prev: any) => ({
                          ...prev,
                          latitude: friend.lat!,
                          longitude: friend.lon!,
                        }));
                        cameraRef.current?.easeTo({ center: [friend.lon!, friend.lat!], zoom: 16, duration: 600 });
                      }
                    }}
                  >
                    {avatar ? (
                      <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: dotColor, alignItems: "center", justifyContent: "center" }}>
                        <CXAvatar source={avatar} size={50} name={displayName} />
                      </View>
                    ) : (
                      <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: dotColor, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="person" size={24} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={{ alignItems: "center", marginTop: spacing.xs }}>
                      <CXText variant="caption" numberOfLines={1} align="center">{displayName.split(" ")[0]}</CXText>
                      <CXText color={dotColor} align="center" numberOfLines={1} style={{ fontSize: 9 }}>
                        {freshnessStatus}
                      </CXText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  searchContainer: {
    position: "absolute",
    top: 50, // Back to top
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  searchContainerFocused: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    zIndex: 100,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 52,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  searchBarFocused: {
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingTop: 50,
    height: 102,
  },
  backBtn: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  searchModeContent: {
    flex: 1,
    backgroundColor: colors.background,
  },
  recentSearchesContainer: {
    paddingTop: spacing.sm,
  },
  recentSearchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: spacing.md,
  },
  categoriesWrapper: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.white,
  },
  categoryChips: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.white,
    gap: spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: colors.ink,
  },
  searchResults: {
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    maxHeight: 250,
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: spacing.md,
  },
  searchResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomCard: {
    position: "absolute",
    bottom: 20,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 10,
  },
  bottomCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  closeBtn: {
    padding: 4,
    backgroundColor: colors.surfaceLavender,
    borderRadius: radius.pill,
    marginLeft: spacing.md,
  },
  actionRow: {
    marginTop: spacing.sm,
  },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    gap: spacing.sm,
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceLavender,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    gap: spacing.xs,
  },
  mapControls: {
    position: "absolute",
    bottom: 40,
    right: spacing.md,
    zIndex: 5,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  friendMarkerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    overflow: "hidden",
  },
  friendCallout: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: spacing.xs,
    minWidth: 120,
  },
  modeSwitcherContainer: {
    position: "absolute",
    top: 115, // Under the search bar
    right: spacing.md, // On the right side
    zIndex: 20,
  },
  fabSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modeSwitcherBtn: {
    flexDirection: "row",
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  friendsBottomCard: {
    position: "absolute",
    bottom: 20,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingVertical: spacing.md, // Made smaller and tighter
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 10,
  },
  friendsBottomCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  friendsListRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  friendListItem: {
    alignItems: "center",
    position: "relative",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 20,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  }
});

