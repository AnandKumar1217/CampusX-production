import * as Location from "expo-location";
import { api } from "./api";

export type HourlyForecast = {
  time: string;
  temp: string;
  icon: string;
};

export type DailyForecast = {
  day: string;
  temp: string;
  icon: string;
  rainProb?: string;
  lowHigh?: string;
};

export type WeatherData = {
  temp: string;
  feelsLike: string;
  condition: string;
  icon: string;
  iconOutline: string;
  humidity: string;
  wind: string;
  city: string;
  region?: string;
  country?: string;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  sunrise: string;
  sunset: string;
  uvIndex?: string;
  travelTip: {
    title: string;
    desc: string;
    icon: string;
  };
};

export const generateTravelTip = (c: string, w: string) => {
  c = c.toLowerCase();
  w = w.toLowerCase();
  if (w.includes("rain") || w.includes("storm") || w.includes("drizzle")) {
    return {
      title: "Expect wet conditions",
      desc: "Don't forget to carry an umbrella and wear waterproof shoes.",
      icon: "umbrella-outline"
    };
  }
  if (w.includes("snow")) {
    return {
      title: "Bundle up",
      desc: "It's freezing outside! Wear heavy layers and a warm coat.",
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

export const mapWeatherCode = (code: number, isDay: number = 1) => {
  let cond = "Sunny";
  let icon = isDay ? "sunny" : "moon";
  let iconOutline = isDay ? "sunny-outline" : "moon-outline";

  if (code === 0) {
    cond = "Clear";
    icon = isDay ? "sunny" : "moon";
    iconOutline = isDay ? "sunny-outline" : "moon-outline";
  } else if (code === 1 || code === 2) {
    cond = "Partly Cloudy";
    icon = isDay ? "partly-sunny" : "cloudy-night";
    iconOutline = isDay ? "partly-sunny-outline" : "cloudy-night-outline";
  } else if (code === 3) {
    cond = "Cloudy";
    icon = "cloud";
    iconOutline = "cloud-outline";
  } else if (code === 45 || code === 48) {
    cond = "Fog";
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

export const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const formatDistance = (km: number) => {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${Math.round(km)} km`;
};

// Returns a safe ISO string based on the given timestamp so we don't accidentally offset it using local device timezone.
// Open-Meteo returns time strings like "2024-03-22T00:00". We want to parse its hour precisely as written.
export const parseProviderTimeStr = (timeStr: string) => {
  // If timeStr is already an ISO string without timezone (e.g. "2024-03-22T15:00"),
  // creating a new Date() might assume UTC or Local depending on the JS engine.
  // We'll manually parse it to extract the hour to be perfectly safe from device TZ shifting.
  const match = timeStr.match(/T(\d{2}):(\d{2})/);
  if (match) {
    return { hour: parseInt(match[1]!, 10), minute: parseInt(match[2]!, 10) };
  }
  // Fallback
  const d = new Date(timeStr);
  return { hour: d.getHours(), minute: d.getMinutes() };
};

export const fetchWeatherForLocation = async (lat: number, lon: number, cityName: string, region?: string, country?: string): Promise<WeatherData> => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,is_day,precipitation_probability&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch weather");
  const data = await res.json();

  const isDay = data.current.is_day;
  const { cond, icon, iconOutline } = mapWeatherCode(data.current.weather_code, isDay);

  // Hourly parsing
  const hourly: HourlyForecast[] = [];
  const currentProviderTime = data.current.time; // e.g. "2024-03-22T15:15"

  // Find closest hour
  let closestIndex = 0;
  for (let i = 0; i < data.hourly.time.length; i++) {
    if (data.hourly.time[i] >= currentProviderTime) {
      closestIndex = i;
      break;
    }
  }

  for (let i = 0; i < 24; i++) {
    const idx = closestIndex + i;
    if (idx >= data.hourly.time.length) break;

    const timeParsed = parseProviderTimeStr(data.hourly.time[idx]);
    let h = timeParsed.hour;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;

    const timeStr = i === 0 ? "Now" : `${h} ${ampm}`;
    const hCode = mapWeatherCode(data.hourly.weather_code[idx], data.hourly.is_day[idx]);

    hourly.push({
      time: timeStr,
      temp: `${Math.round(data.hourly.temperature_2m[idx])}°`,
      icon: hCode.iconOutline,
    });
  }

  // Daily parsing
  const daily: DailyForecast[] = [];
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
    const tStr = data.daily.time[i]; // "2024-03-22"
    // To safely get day of week from YYYY-MM-DD
    const parts = tStr.split("-");
    const d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
    const dayStr = i === 0 ? "Today" : daysOfWeek[d.getDay()]!;

    const dCode = mapWeatherCode(data.daily.weather_code[i], 1);

    daily.push({
      day: dayStr,
      temp: `${Math.round(data.daily.temperature_2m_max[i])}°`,
      icon: dCode.iconOutline,
      lowHigh: `H:${Math.round(data.daily.temperature_2m_max[i])}° L:${Math.round(data.daily.temperature_2m_min[i])}°`,
      rainProb: data.daily.precipitation_probability_max?.[i] ? `${data.daily.precipitation_probability_max[i]}%` : undefined
    });
  }

  // Sunrise/Sunset
  const srParsed = parseProviderTimeStr(data.daily.sunrise[0] || "");
  let srH = srParsed.hour;
  const srAmpm = srH >= 12 ? 'PM' : 'AM';
  srH = srH % 12;
  srH = srH ? srH : 12;
  const sunriseStr = `${srH}:${srParsed.minute.toString().padStart(2, '0')} ${srAmpm}`;

  const ssParsed = parseProviderTimeStr(data.daily.sunset[0] || "");
  let ssH = ssParsed.hour;
  const ssAmpm = ssH >= 12 ? 'PM' : 'AM';
  ssH = ssH % 12;
  ssH = ssH ? ssH : 12;
  const sunsetStr = `${ssH}:${ssParsed.minute.toString().padStart(2, '0')} ${ssAmpm}`;

  return {
    temp: Math.round(data.current.temperature_2m).toString(),
    feelsLike: Math.round(data.current.apparent_temperature).toString(),
    condition: cond,
    icon,
    iconOutline,
    humidity: data.current.relative_humidity_2m.toString() + "%",
    wind: data.current.wind_speed_10m.toString() + " km/h",
    city: cityName,
    region,
    country,
    hourly,
    daily,
    sunrise: sunriseStr,
    sunset: sunsetStr,
    travelTip: generateTravelTip(cityName, cond),
  };
};

export const isWeatherCityResult = (f: any) => {
  const p = f.properties;
  if (!p) return false;

  // Explicitly reject specific granular POIs/villages even if Photon categorizes them broadly
  const rejectedStrict = ["village", "hamlet", "isolated_dwelling", "neighbourhood", "quarter", "locality", "bus_stop", "station"];
  if (rejectedStrict.includes(p.osm_value)) return false;

  // Explicitly allow city/town/municipality
  if (p.osm_key === "place" && ["city", "town", "municipality"].includes(p.osm_value)) return true;

  // Allow major suburbs that represent distinct towns (e.g. Mangalagiri or Manhattan)
  if (p.osm_key === "place" && ["suburb"].includes(p.osm_value) && p.type === "district") return true;

  // Allow administrative boundaries that represent cities
  if (p.osm_key === "boundary" && p.osm_value === "administrative" && p.type === "city") return true;

  // Allow fallback if Photon explicitly classifies it as a city and it hasn't been rejected
  if (p.type === "city") return true;

  return false;
};

export const searchCities = async (query: string, currentLat?: number, currentLon?: number, signal?: AbortSignal) => {
  if (query.trim().length < 2) return [];

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=8&language=en&format=json`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Open-Meteo geocoding error: ${res.status}`);
    const data = await res.json();

    let results = data.results || [];

    // Prioritize populated places (PPL*) over administrative regions (ADM*)
    const sortedResults = results.sort((a: any, b: any) => {
      const aIsPlace = a.feature_code?.startsWith('PPL') ? 1 : 0;
      const bIsPlace = b.feature_code?.startsWith('PPL') ? 1 : 0;
      if (aIsPlace !== bIsPlace) return bIsPlace - aIsPlace;
      return 0;
    });

    const uniqueResults: any[] = [];
    const seen = new Set();

    for (const r of sortedResults) {
      // Create a unique key using id or exact coordinates
      const key = r.id ? r.id.toString() : `${Number(r.latitude).toFixed(3)},${Number(r.longitude).toFixed(3)}`;
      if (!seen.has(key)) {
        seen.add(key);

        const parts = [];
        if (r.admin1) parts.push(r.admin1);
        if (r.country) parts.push(r.country);
        const displayName = parts.join(", ");

        uniqueResults.push({
          id: r.id || `${r.latitude},${r.longitude}`,
          name: r.name,
          region: r.admin1,
          country: r.country,
          latitude: r.latitude,
          longitude: r.longitude,
          timezone: r.timezone,
          displayName,
          label: displayName
        });
      }
    }

    // Calculate exact Haversine distance
    uniqueResults.forEach((r: any) => {
      if (currentLat !== undefined && currentLon !== undefined) {
        r.distanceKm = calculateDistanceKm(currentLat, currentLon, r.latitude, r.longitude);
      }
    });

    // Sort by distance ascending if available
    if (currentLat !== undefined && currentLon !== undefined) {
      uniqueResults.sort((a: any, b: any) => (a.distanceKm || 0) - (b.distanceKm || 0));
    }

    return uniqueResults;
  } catch (error: any) {
    if (error.name === "AbortError") {
      // Ignored for stale/aborted requests
    } else {
      console.warn("Weather search error:", error);
    }
    return [];
  }
};
