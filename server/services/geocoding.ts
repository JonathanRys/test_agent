import { cacheGet, cacheSet } from "./cache.js";

const GEOCODING_API_URL =
  "https://geocoding-api.open-meteo.com/v1/search";
const GEOCODING_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const GEOCODING_FAILURE_TTL_SECONDS = 5 * 60;

export type GeocodedLocation = {
  label: string;
  lat: number;
  lon: number;
};

type GeocodingCacheEntry = {
  location: GeocodedLocation | null;
};

function geocodingCacheKey(location: string): string {
  return `geocode:${location.trim().toLocaleLowerCase()}`;
}

export async function geocodeLocation(
  location: string,
): Promise<GeocodedLocation | null> {
  const normalized = location.trim();
  if (!normalized) return null;

  const key = geocodingCacheKey(normalized);
  const cached = await cacheGet<GeocodingCacheEntry>(key);
  if (cached) return cached.location;

  const params = new URLSearchParams({
    name: normalized,
    count: "1",
    language: "en",
    format: "json",
  });
  try {
    const signal =
      typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? AbortSignal.timeout(4000)
        : undefined;
    const response = await fetch(`${GEOCODING_API_URL}?${params}`, { signal });
    if (!response.ok) throw new Error(`geocoding api responded ${response.status}`);

    const payload = (await response.json()) as {
      results?: Array<{
        name?: string;
        admin1?: string;
        country?: string;
        latitude?: number;
        longitude?: number;
      }>;
    };
    const result = payload.results?.[0];
    if (
      !result ||
      typeof result.latitude !== "number" ||
      typeof result.longitude !== "number"
    ) {
      await cacheSet(key, { location: null }, GEOCODING_FAILURE_TTL_SECONDS);
      return null;
    }

    const geocoded: GeocodedLocation = {
      label: [result.name, result.admin1, result.country]
        .filter(Boolean)
        .join(", "),
      lat: result.latitude,
      lon: result.longitude,
    };
    await cacheSet(
      key,
      { location: geocoded },
      GEOCODING_CACHE_TTL_SECONDS,
    );
    return geocoded;
  } catch (error) {
    console.warn("geocoding.lookup.failed", { error: String(error) });
    await cacheSet(key, { location: null }, GEOCODING_FAILURE_TTL_SECONDS);
    return null;
  }
}