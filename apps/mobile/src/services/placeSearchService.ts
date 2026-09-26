export interface PlaceSearchResult {
  id: string;
  providerKey: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  distanceFormatted?: string;
  distanceKm?: number;
  rating?: number;
  userRatingCount?: number;
  openNow?: boolean;
}

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const p = 0.017453292519943295; // Math.PI / 180
  const c = Math.cos;
  const a =
    0.5 -
    c((lat2 - lat1) * p) / 2 +
    (c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))) / 2;
  return 12742 * Math.asin(Math.sqrt(a));
};

export const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

class PlaceSearchService {
  private abortController: AbortController | null = null;

  async searchPlaces(
    query: string,
    userLat?: number,
    userLon?: number,
    mapLat?: number,
    mapLon?: number,
    mode: "autocomplete" | "submit" = "autocomplete"
  ): Promise<PlaceSearchResult[]> {
    if (!query || !query.trim() || query.length < 2) return [];

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const limit = mode === "submit" ? 50 : 15;
      let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}`;

      const targetLat = (userLat !== undefined && userLon !== undefined) ? userLat : mapLat;
      const targetLon = (userLat !== undefined && userLon !== undefined) ? userLon : mapLon;

      if (targetLat !== undefined && targetLon !== undefined) {
        if (mode === "submit") {
          // BBox approximately 10km around current center
          const radiusKm = 10.5; // Slightly larger to allow exact haversine crop
          const latDelta = radiusKm / 111;
          const lonDelta = radiusKm / (111 * Math.cos(targetLat * (Math.PI / 180)));

          const minLon = targetLon - lonDelta;
          const minLat = targetLat - latDelta;
          const maxLon = targetLon + lonDelta;
          const maxLat = targetLat + latDelta;

          url += `&bbox=${minLon},${minLat},${maxLon},${maxLat}`;
        } else {
          // Autocomplete location bias
          url += `&lat=${targetLat}&lon=${targetLon}`;
        }
      }

      const res = await fetch(url, { signal: this.abortController.signal });
      if (!res.ok) {
        throw new Error("Photon API Error");
      }

      const data = await res.json();
      const features = data.features || [];

      let parsedResults: PlaceSearchResult[] = features.map((f: any) => {
        const p = f.properties;
        const coords = f.geometry.coordinates; // [lon, lat]
        const lat = coords[1];
        const lon = coords[0];

        let distanceKm = 0;
        let distanceFormatted;
        if (targetLat !== undefined && targetLon !== undefined) {
          distanceKm = calculateDistance(targetLat, targetLon, lat, lon);
          distanceFormatted = formatDistance(distanceKm);
        }

        const addressParts = [];
        if (p.street) addressParts.push(p.street);
        if (p.city) addressParts.push(p.city);
        if (p.state) addressParts.push(p.state);

        const name = p.name || p.street || p.city || "Unknown";
        const category = p.osm_value || p.osm_key || "";

        // Deterministic unique key
        let providerKey = `photon:N:null:${lat}:${lon}:${name}`;
        if (p.osm_id && p.osm_type) {
          providerKey = `photon:${p.osm_type}:${p.osm_id}:${lat}:${lon}`;
        }

        return {
          id: providerKey,
          providerKey,
          name,
          latitude: lat,
          longitude: lon,
          address: addressParts.join(", "),
          category,
          city: p.city,
          state: p.state,
          country: p.country,
          distanceKm,
          distanceFormatted,
        };
      });

      // Deduplicate results
      const seen = new Set<string>();
      parsedResults = parsedResults.filter((r) => {
        // Identity: If we have an exact osm type+id match at roughly same coords, dedup.
        // If not, dedup by name + rounded lat + rounded lon.
        const coordKey = `${Math.round(r.latitude * 1000)},${Math.round(r.longitude * 1000)}`;
        const dedupKey = `${r.name.toLowerCase()}|${coordKey}`;

        if (seen.has(r.providerKey) || seen.has(dedupKey)) {
          return false;
        }
        seen.add(r.providerKey);
        seen.add(dedupKey);
        return true;
      });

      // Apply mode-specific filters
      if (mode === "submit" && targetLat !== undefined && targetLon !== undefined) {
        parsedResults = parsedResults.filter(r => r.distanceKm !== undefined && r.distanceKm <= 10);
      }

      // Sort by distance ascending, then by name ascending
      if (targetLat !== undefined && targetLon !== undefined) {
        parsedResults.sort((a, b) => {
          const distA = a.distanceKm || 0;
          const distB = b.distanceKm || 0;
          if (Math.abs(distA - distB) < 0.001) {
            return a.name.localeCompare(b.name);
          }
          return distA - distB;
        });
      }

      return parsedResults;
    } catch (err: any) {
      if (err.name === "AbortError") {
        return [];
      }
      console.log("Places search failed:", err);
      throw err;
    }
  }

  cancelSearch() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

export const placeSearchService = new PlaceSearchService();
