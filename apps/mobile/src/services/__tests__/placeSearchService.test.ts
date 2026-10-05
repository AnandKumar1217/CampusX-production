import { placeSearchService, formatDistance, calculateDistance } from "../placeSearchService";

import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

describe("placeSearchService Deduplication and Modes", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    placeSearchService.cancelSearch();
  });

  const createPhotonFeature = (
    name: string,
    lat: number,
    lon: number,
    osm_type?: string,
    osm_id?: number
  ) => ({
    geometry: { coordinates: [lon, lat] },
    properties: { name, osm_type, osm_id, city: "Bengaluru" },
  });

  it("1. same osm_id + different osm_type -> unique keys", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          createPhotonFeature("Place 1", 12.0, 77.0, "N", 123),
          createPhotonFeature("Place 2", 12.0, 77.0, "W", 123),
        ],
      }),
    });

    const results = await placeSearchService.searchPlaces("test");
    expect(results.length).toBe(2);
    expect((results[0] as any).providerKey).toBe("photon:N:123:12:77");
    expect((results[1] as any).providerKey).toBe("photon:W:123:12:77");
  });

  it("2. missing osm_id -> deterministic unique fallback", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          createPhotonFeature("Unknown 1", 12.123, 77.456),
          createPhotonFeature("Unknown 2", 12.999, 77.888),
        ],
      }),
    });

    const results = await placeSearchService.searchPlaces("test");
    expect(results.length).toBe(2);
    expect((results[0] as any).providerKey).toBe("photon:N:null:12.123:77.456:Unknown 1");
    expect((results[1] as any).providerKey).toBe("photon:N:null:12.999:77.888:Unknown 2");
  });

  it("3. duplicate identical feature -> deduplicated", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          createPhotonFeature("Same Place", 12.0, 77.0, "N", 456),
          createPhotonFeature("Same Place", 12.0, 77.0, "N", 456),
        ],
      }),
    });

    const results = await placeSearchService.searchPlaces("test");
    expect(results.length).toBe(1);
    expect((results[0] as any).providerKey).toBe("photon:N:456:12:77");
  });

  it("4. same place name + different coordinates -> both retained", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          createPhotonFeature("Starbucks", 12.1, 77.1, "N", 1),
          createPhotonFeature("Starbucks", 12.5, 77.5, "N", 2),
        ],
      }),
    });

    const results = await placeSearchService.searchPlaces("test");
    expect(results.length).toBe(2);
    expect((results[0] as any).providerKey).toBe("photon:N:1:12.1:77.1");
    expect((results[1] as any).providerKey).toBe("photon:N:2:12.5:77.5");
  });

  it("5. React providerKey never empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          createPhotonFeature("", 0, 0),
        ],
      }),
    });

    const results = await placeSearchService.searchPlaces("test");
    expect(results.length).toBe(1);
    expect((results[0] as any).providerKey).toBe("photon:N:null:0:0:Bengaluru"); // name fallback to city
    expect((results[0] as any).providerKey).toBeTruthy();
  });

  // --- DISTANCE SEARCH TESTS ---

  it("6. submitted search uses fresh request with bbox", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ features: [] as any[] }),
    });

    await placeSearchService.searchPlaces("test", 12.9716, 77.5946, undefined, undefined, "submit");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0]![0];
    expect(url).toContain("bbox=");
    expect(url).toContain("limit=50");
  });

  it("7. typeahead sorts nearest-first and does NOT enforce 10km cutoff", async () => {
    // Current center: 12.9716, 77.5946
    // 13km: 13.0886, 77.5946
    // 2km: 12.9896, 77.5946
    // 5km: 13.0166, 77.5946
    // 1km: 12.9806, 77.5946
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          createPhotonFeature("13km", 13.0886, 77.5946, "N", 1),
          createPhotonFeature("2km", 12.9896, 77.5946, "N", 2),
          createPhotonFeature("5km", 13.0166, 77.5946, "N", 3),
          createPhotonFeature("1km", 12.9806, 77.5946, "N", 4),
        ],
      }),
    });

    const results = await placeSearchService.searchPlaces("test", 12.9716, 77.5946, undefined, undefined, "autocomplete");

    // Check cutoff (13km is NOT filtered out in autocomplete)
    expect(results.length).toBe(4);

    // Check sort order
    expect((results[0] as any).name).toBe("1km");
    expect((results[1] as any).name).toBe("2km");
    expect((results[2] as any).name).toBe("5km");
    expect((results[3] as any).name).toBe("13km");
  });

  it("7b. equal-distance results deterministic by name", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          createPhotonFeature("Zebra Coffee", 12.9806, 77.5946, "N", 1),
          createPhotonFeature("Apple Coffee", 12.9806, 77.5946, "N", 2),
          createPhotonFeature("Mango Coffee", 12.9806, 77.5946, "N", 3),
        ],
      }),
    });

    const results = await placeSearchService.searchPlaces("test", 12.9716, 77.5946, undefined, undefined, "autocomplete");

    expect(results.length).toBe(3);
    expect((results[0] as any).name).toBe("Apple Coffee");
    expect((results[1] as any).name).toBe("Mango Coffee");
    expect((results[2] as any).name).toBe("Zebra Coffee");
  });

  it("8. result 2 km away included, 9.9 km included, 10.1 excluded, sorted ascending", async () => {
    // Current center: 12.9716, 77.5946
    // 2km: 12.9896, 77.5946 (~2km)
    // 9.9km: 13.0607, 77.5946 (~9.9km)
    // 10.1km: 13.0625, 77.5946 (~10.1km)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          createPhotonFeature("10.1km", 13.0625, 77.5946, "N", 3), // Should be excluded
          createPhotonFeature("2km", 12.9896, 77.5946, "N", 1),
          createPhotonFeature("9.9km", 13.0607, 77.5946, "N", 2),
        ],
      }),
    });

    const results = await placeSearchService.searchPlaces("test", 12.9716, 77.5946, undefined, undefined, "submit");
    expect(results.length).toBe(2);
    expect((results[0] as any).name).toBe("2km");
    expect((results[1] as any).name).toBe("9.9km");

    // Sort is correct
    expect((results[0] as any).distanceKm!).toBeLessThan((results[1] as any).distanceKm!);
  });

  it("9. empty query not submitted", async () => {
    const results = await placeSearchService.searchPlaces(" ", 12.9, 77.5, undefined, undefined, "submit");
    expect(results.length).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("10. no current location -> map-center fallback (works gracefully when lat/lon undefined)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [createPhotonFeature("Somewhere", 0, 0, "N", 1)],
      }),
    });

    // We simulate no current location by passing undefined (like map center fallback in component if region fails)
    const results = await placeSearchService.searchPlaces("test", undefined, undefined, undefined, undefined, "submit");
    expect(results.length).toBe(1);
    expect((results[0] as any).distanceKm).toBe(0); // Cannot calculate distance
    const url = mockFetch.mock.calls[0]![0];
    expect(url).not.toContain("bbox=");
    expect(url).not.toContain("lat=");
  });

  it("11. currentLocation available + map center different -> uses currentLocation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [createPhotonFeature("Somewhere", 12.0, 77.0, "N", 1)],
      }),
    });

    const userLat = 12.9716;
    const userLon = 77.5946;
    const mapLat = 40.7128;
    const mapLon = -74.0060;

    await placeSearchService.searchPlaces("test", userLat, userLon, mapLat, mapLon, "submit");
    const url = mockFetch.mock.calls[0]![0];

    // Radius ~10km converted to approx bounding box degrees (~0.09)
    // 12.9716 - 0.094 = 12.877
    // So it should contain values close to userLat/userLon, NOT mapLat/mapLon
    expect(url).toContain("bbox=");
    expect(url).not.toContain("40.71"); // Ensure mapLat is not used in the URL
    expect(url).not.toContain("-74.0"); // Ensure mapLon is not used in the URL
  });
});
