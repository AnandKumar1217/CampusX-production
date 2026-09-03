import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useCallback, useEffect, useState, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View, Keyboard, BackHandler, Linking } from "react-native";
import MapView, { Marker, Callout } from "@/components/map/MapView";

import {
  CXAvatar,
  CXText,
} from "@/components/ui";
import { TextInput, Text } from "react-native";
import { useRootNavigation } from "@/hooks/useRootNavigation";
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

export function DiscoverScreen() {
  const navigation = useRootNavigation();
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeMode, setActiveMode] = useState<"places" | "friends">("places");
  const friends = useAppStore(state => state.friends);

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
        if (searchQuery || isSearchFocused || selectedPlace || mapMarkers.length > 0) {
          setSearchQuery("");
          setSearchResults([]);
          setIsSearchFocused(false);
          setSelectedPlace(null);
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
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q !== query);
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
  }, [searchQuery, region.latitude, region.longitude]);

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
    setSearchQuery(formatted.display_name);
    setIsSearchFocused(false);
  };
  
  const executeMapSearch = (query: string) => {
    if (!query.trim()) return;
    setSearchQuery(query);
    addToRecent(query);
    
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
          setRegion(prev => ({
            ...prev,
            latitude: first.lat,
            longitude: first.lon,
            latitudeDelta: 0.02, // Zoom out slightly to show multiple pins
            longitudeDelta: 0.02,
          }));
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
              setRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
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
        style={StyleSheet.absoluteFill}
        region={region}
        toolbarEnabled={false}
        rotateEnabled={true}
        pitchEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
        zoomControlEnabled={false}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        onPoiClick={(e) => {
          if (activeMode !== "places") return;
          const { coordinate, name } = e.nativeEvent;
          setSelectedPlace({
            lat: coordinate.latitude,
            lon: coordinate.longitude,
            display_name: name,
            formatted_address: "Point of Interest",
          });
          setSearchQuery(name);
          // Center the map on the tapped POI
          setRegion(prev => ({
            ...prev,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
          }));
        }}
        onPress={(e) => {
          // If the user taps the map and it's NOT a POI, we can clear the selection.
          // Note: depending on the platform, onPress might fire alongside onPoiClick, 
          // but we will just rely on onPoiClick to set it. We'll leave onPress empty 
          // or use it to dismiss the keyboard if needed, but let's avoid conflicting with POIs.
          Keyboard.dismiss();
        }}
      >
        {activeMode === "places" && mapMarkers.map((marker, index) => (
          <Marker
            key={`search-${index}`}
            coordinate={{ latitude: marker.lat, longitude: marker.lon }}
            title={marker.display_name}
            pinColor={colors.primary}
            onPress={() => {
              setSelectedPlace(marker);
              setSearchQuery(marker.display_name);
            }}
          />
        ))}
        {activeMode === "places" && selectedPlace && (
          <Marker
            coordinate={{
              latitude: selectedPlace.lat,
              longitude: selectedPlace.lon,
            }}
            title={selectedPlace.display_name}
            pinColor={colors.primary}
          />
        )}
        
        {/* Friends Mode Markers */}
        {activeMode === "friends" && friends.filter(p => p.online).map((friend) => {
          if (!friend.lat || !friend.lon) return null;
          return (
            <Marker
              key={`friend-${friend.id}`}
              coordinate={{ latitude: friend.lat, longitude: friend.lon }}
              onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${friend.lat},${friend.lon}`)}
            >
              <View style={{ alignItems: "center" }}>
                <View style={{ backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginBottom: 4 }}>
                  <CXText variant="caption" style={{ fontSize: 10, fontWeight: "bold" }}>{friend.name.split(" ")[0]}</CXText>
                </View>
                <View style={[styles.friendMarkerContainer, { elevation: 5, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4 }]}>
                  {friend.avatar ? (
                    <CXAvatar source={typeof friend.avatar === 'string' ? { uri: friend.avatar } : friend.avatar} size={36} name={friend.name} />
                  ) : (
                    <Ionicons name="person" size={16} color={colors.white} />
                  )}
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Small Floating Toggle Button */}
      <View style={styles.modeSwitcherContainer}>
        <Pressable 
          style={styles.fabSmall} 
          onPress={() => setActiveMode(prev => prev === "places" ? "friends" : "places")}
        >
          <Ionicons 
            name={activeMode === "places" ? "people" : "location"} 
            size={22} 
            color={colors.primary} 
          />
        </Pressable>
      </View>

      {/* Map Controls (Bottom Right) */}
      <View style={[styles.mapControls, selectedPlace && { bottom: 180 }, isSearchFocused && { display: "none" }, activeMode === "friends" && { bottom: 220 }]}>
        <Pressable style={styles.fab} onPress={() => {
          Location.getCurrentPositionAsync({}).then(loc => {
            setRegion(prev => ({ ...prev, latitude: loc.coords.latitude, longitude: loc.coords.longitude }));
          }).catch(console.log);
        }}>
          <Ionicons name="navigate" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Floating / Fullscreen Search Container */}
      {activeMode === "places" && (
        <View style={[styles.searchContainer, isSearchFocused && styles.searchContainerFocused]}>
        <View style={[styles.searchBar, isSearchFocused && styles.searchBarFocused]}>
          {isSearchFocused ? (
            <Pressable onPress={() => { setIsSearchFocused(false); setSearchQuery(""); }} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ) : (
            <Ionicons name="menu" size={24} color={colors.text} />
          )}
          
          <TextInput
            style={styles.searchInput}
            placeholder="Search here"
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
              setMapMarkers([]);
            }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* Search Mode Content */}
        {isSearchFocused && (
          <View style={styles.searchModeContent}>
            {!searchQuery ? (
              <>
                <View style={styles.categoriesWrapper}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
                    {[
                      { name: "Restaurants", icon: "restaurant" },
                      { name: "Coffee", icon: "cafe" },
                      { name: "Groceries", icon: "cart" },
                      { name: "Parks", icon: "leaf" },
                      { name: "ATMs", icon: "cash" },
                    ].map(cat => (
                      <Pressable key={cat.name} style={styles.categoryChip} onPress={() => handleCategorySearch(cat.name)}>
                        <Ionicons name={cat.icon as any} size={16} color={colors.text} />
                        <CXText variant="bodyStrong">{cat.name}</CXText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                
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
            ) : null}

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {searchResults.map((place, index) => {
                const name = place?.properties?.name || place?.properties?.street || "Unknown Place";
                const details = [place?.properties?.street, place?.properties?.city, place?.properties?.state].filter(Boolean).join(", ");
                
                return (
                  <Pressable 
                    key={index} 
                    style={[
                      styles.searchResultItem,
                      index === searchResults.length - 1 && { borderBottomWidth: 0 }
                    ]} 
                    onPress={() => handleSelectPlace(place)}
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
          </View>
        )}
      </View>
      )}

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

      {/* Friends Mode Bottom Sheet */}
      {activeMode === "friends" && (
        <View style={styles.friendsBottomCard}>
          <View style={styles.friendsBottomCardHeader}>
            <CXText variant="h3">Online Friends</CXText>
            <CXText variant="body" color={colors.primary}>
              {friends.filter(p => p.online).length} nearby
            </CXText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsListRow}>
            {friends.filter(p => p.online).map((friend) => (
              <Pressable 
                key={friend.id} 
                style={styles.friendListItem}
                onPress={() => {
                  if (friend.lat && friend.lon) {
                    setRegion(prev => ({
                      ...prev,
                      latitude: friend.lat!,
                      longitude: friend.lon!,
                    }));
                  }
                }}
              >
                {friend.avatar ? (
                  <CXAvatar source={typeof friend.avatar === 'string' ? { uri: friend.avatar } : friend.avatar} size={56} name={friend.name} />
                ) : (
                  <View style={[styles.friendMarkerContainer, { width: 56, height: 56, borderRadius: 28 }]}>
                    <Ionicons name="person" size={24} color={colors.white} />
                  </View>
                )}
                <View style={styles.onlineIndicator} />
                <CXText variant="caption" numberOfLines={1} style={{ marginTop: spacing.xs, width: 60, textAlign: "center" }}>
                  {friend.name?.split(" ")[0] || "User"}
                </CXText>
              </Pressable>
            ))}
          </ScrollView>
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
    color: colors.text,
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
    marginBottom: spacing.md,
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

