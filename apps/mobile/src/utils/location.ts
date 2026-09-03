export type Coordinates = { lat: number; lng: number };

/**
 * Calculates the Haversine distance between two coordinates in kilometers.
 */
export function getDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Searches for a location using Nominatim (OpenStreetMap) API.
 */
export async function searchLocation(query: string) {
  if (!query || query.length < 3) return [];
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=json&limit=5`,
      {
        headers: {
          "User-Agent": "CampusXApp/1.0",
        },
      }
    );
    
    const data = await response.json();
    return data.map((item: any) => ({
      name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch (error) {
    console.error("Location search failed:", error);
    return [];
  }
}
