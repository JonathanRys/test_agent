import { env } from "../config/env.js";
import {
  PEAK_WEATHER_CACHE_TTL_SECONDS,
  PEAK_WEATHER_FAILURE_TTL_SECONDS,
} from "../config/session.js";
import { cacheDel, cacheGet, cacheSet } from "./cache.js";
import type { UserProfile } from "./profile.js";
import type { CachedUserAgentContext } from "./userContext.js";

export type WeatherUnits = "imperial" | "metric";

export type PeakWeatherPoint = {
  id: number;
  lat: number;
  lon: number;
  kind?: "peak" | "trail";
};

export type PeakWeatherInfo = {
  temp: number;
  cond: string;
  wind: number;
  hi?: number;
  lo?: number;
  pop?: number | null;
  precipitation?: number | null;
};

export type PeakWeatherSnapshot = {
  units: WeatherUnits;
  fetchedAt: string;
  byPeak: Record<string, PeakWeatherInfo>;
  byTrail?: Record<string, PeakWeatherInfo>;
  // Set when the last fetch attempt failed or came back incomplete; readers
  // honor it as a short backoff window instead of re-fetching every turn.
  failedAt?: string;
};

// Open-Meteo returns WMO weather codes; map the common ones to compact,
// lowercase phrases so the injected weather string stays small.
const WMO_CONDITIONS: Record<number, string> = {
  0: "clear",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "freezing fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  56: "light freezing drizzle",
  57: "freezing drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  66: "light freezing rain",
  67: "freezing rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "light rain showers",
  81: "rain showers",
  82: "heavy rain showers",
  85: "light snow showers",
  86: "snow showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
  99: "severe thunderstorm with hail",
};

export function describeWeatherCode(code: number): string {
  return WMO_CONDITIONS[code] ?? "unknown conditions";
}

export function pickWeatherUnits(
  profile: UserProfile | null | undefined,
): WeatherUnits {
  return profile?.preferences?.units === "metric" ? "metric" : "imperial";
}

export function weatherContextKey(userId: number): string {
  return `user:${userId}:peak-weather`;
}

/** Pure URL builder so unit handling and batching are testable offline. */
export function buildWeatherRequestUrl(
  points: PeakWeatherPoint[],
  units: WeatherUnits,
): string {
  const params = new URLSearchParams({
    latitude: points.map((point) => point.lat.toFixed(4)).join(","),
    longitude: points.map((point) => point.lon.toFixed(4)).join(","),
    current: "temperature_2m,weather_code,wind_speed_10m",
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
    forecast_days: "1",
    temperature_unit: units === "imperial" ? "fahrenheit" : "celsius",
    wind_speed_unit: units === "imperial" ? "mph" : "kmh",
    precipitation_unit: units === "imperial" ? "inch" : "mm",
    timezone: "auto",
  });
  return `${env.WEATHER_API_BASE_URL}?${params.toString()}`;
}

/**
 * Open-Meteo returns a single object for one coordinate and an array for
 * multiple coordinates; results match request order. Missing fields are
 * tolerated so a partial payload still yields usable weather.
 */
export function parseWeatherResponse(
  json: unknown,
  points: PeakWeatherPoint[],
): Record<string, PeakWeatherInfo> {
  const results = Array.isArray(json) ? json : [json];
  const byPeak: Record<string, PeakWeatherInfo> = {};

  points.forEach((point, index) => {
    const entry = results[index] as
      | {
          current?: {
            temperature_2m?: number;
            weather_code?: number;
            wind_speed_10m?: number;
          };
          daily?: {
            temperature_2m_max?: (number | null)[];
            temperature_2m_min?: (number | null)[];
            precipitation_probability_max?: (number | null)[];
            precipitation_sum?: (number | null)[];
          };
        }
      | undefined;
    const current = entry?.current;
    if (
      !current ||
      typeof current.temperature_2m !== "number" ||
      typeof current.weather_code !== "number"
    ) {
      return;
    }

    const hi = entry.daily?.temperature_2m_max?.[0];
    const lo = entry.daily?.temperature_2m_min?.[0];
    const pop = entry.daily?.precipitation_probability_max?.[0];
    const precipitation = entry.daily?.precipitation_sum?.[0];

    const resultKey = point.kind === "trail" ? `trail:${point.id}` : String(point.id);
    byPeak[resultKey] = {
      temp: Math.round(current.temperature_2m),
      cond: describeWeatherCode(current.weather_code),
      wind: Math.round(current.wind_speed_10m ?? 0),
      ...(typeof hi === "number" ? { hi: Math.round(hi) } : {}),
      ...(typeof lo === "number" ? { lo: Math.round(lo) } : {}),
      ...(typeof pop === "number" ? { pop: Math.round(pop) } : { pop: null }),
      ...(typeof precipitation === "number"
        ? { precipitation: Math.max(0, precipitation) }
        : { precipitation: null }),
    };
  });

  return byPeak;
}

// Batch size keeps the query string well under common URL limits; Open-Meteo
// supports comma-separated coordinates in a single request.
const WEATHER_BATCH_SIZE = 50;
const WEATHER_FETCH_TIMEOUT_MS = 4000;

function chunkPoints(points: PeakWeatherPoint[]): PeakWeatherPoint[][] {
  const chunks: PeakWeatherPoint[][] = [];
  for (let i = 0; i < points.length; i += WEATHER_BATCH_SIZE) {
    chunks.push(points.slice(i, i + WEATHER_BATCH_SIZE));
  }
  return chunks;
}

/**
 * Batched Open-Meteo fetch for peak coordinates. Resolves with whatever
 * succeeded (partial results are fine); throws only when NO batch succeeded
 * so callers can apply failure backoff.
 */
export async function fetchPeakWeather(
  points: PeakWeatherPoint[],
  units: WeatherUnits,
): Promise<Record<string, PeakWeatherInfo>> {
  if (points.length === 0) return {};

  const startedAt = Date.now();
  const settled = await Promise.allSettled(
    chunkPoints(points).map(async (chunk) => {
      const url = buildWeatherRequestUrl(chunk, units);
      // AbortSignal.timeout is guarded: jsdom's AbortSignal may not ship it.
      const signal =
        typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
          ? AbortSignal.timeout(WEATHER_FETCH_TIMEOUT_MS)
          : undefined;
      const response = await fetch(url, { signal });
      if (!response.ok) {
        throw new Error(`weather api responded ${response.status}`);
      }
      const json: unknown = await response.json();
      if (
        json &&
        typeof json === "object" &&
        (json as { error?: boolean }).error
      ) {
        throw new Error(
          (json as { reason?: string }).reason ?? "weather api error",
        );
      }
      return parseWeatherResponse(json, chunk);
    }),
  );

  const byPeak: Record<string, PeakWeatherInfo> = {};
  let failures = 0;
  for (const result of settled) {
    if (result.status === "fulfilled") {
      Object.assign(byPeak, result.value);
    } else {
      failures += 1;
      console.warn("weather.fetch.batch_failed", {
        error: String(result.reason),
      });
    }
  }

  if (failures === settled.length) {
    throw new Error("weather fetch failed for every batch");
  }

  console.info("weather.fetch", {
    peaks: points.length,
    batches: settled.length,
    failedBatches: failures,
    durationMs: Date.now() - startedAt,
  });
  return byPeak;
}

/**
 * Cache-aside weather for the given peaks in the per-user snapshot.
 * - Fresh snapshot covering every peak: served from cache, no fetch.
 * - Missing peaks (completions changed the set) or wrong units (the user
 *   switched preference): fetch only what is missing, merge, re-cache.
 * - Total failure: cache the snapshot with the SHORT backoff TTL so a down
 *   weather API costs at most one failed request per backoff window instead
 *   of slowing every agent turn.
 */
export async function getPeakWeatherSnapshot(
  userId: number,
  needed: PeakWeatherPoint[],
  units: WeatherUnits,
): Promise<PeakWeatherSnapshot> {
  const key = weatherContextKey(userId);
  const cached = await cacheGet<PeakWeatherSnapshot>(key);
  const usable = cached && cached.units === units ? cached : null;
  const infoForPoint = (point: PeakWeatherPoint) =>
    point.kind === "trail"
      ? usable?.byTrail?.[String(point.id)]
      : usable?.byPeak[String(point.id)];
  const missing = needed.filter((point) => !infoForPoint(point));
  // Serve from cache when it covers every peak, OR when the last attempt
  // failed — the short failure TTL is the backoff window; when it lapses the
  // snapshot disappears and the next read retries for real.
  if (usable && (missing.length === 0 || usable.failedAt)) return usable;

  const byPeak: Record<string, PeakWeatherInfo> = { ...(usable?.byPeak ?? {}) };
  const byTrail: Record<string, PeakWeatherInfo> = { ...(usable?.byTrail ?? {}) };
  let complete = false;
  try {
    const fetched = await fetchPeakWeather(missing, units);
    for (const [key, info] of Object.entries(fetched)) {
      if (key.startsWith("trail:")) byTrail[key.slice(6)] = info;
      else byPeak[key] = info;
    }
    complete = Object.keys(fetched).length === missing.length;
  } catch (error) {
    console.warn("weather.fetch.failed", { userId, error: String(error) });
  }

  const snapshot: PeakWeatherSnapshot = {
    units,
    fetchedAt: new Date().toISOString(),
    byPeak,
    byTrail,
    ...(complete ? {} : { failedAt: new Date().toISOString() }),
  };
  await cacheSet(
    key,
    snapshot,
    complete
      ? PEAK_WEATHER_CACHE_TTL_SECONDS
      : PEAK_WEATHER_FAILURE_TTL_SECONDS,
  );
  return snapshot;
}

/** Unique peak coordinates from the injected remaining hikes (peaks only). */
export function collectRemainingPeakPoints(
  context: CachedUserAgentContext,
): PeakWeatherPoint[] {
  const byId = new Map<string, PeakWeatherPoint>();
  for (const list of context.unfinishedLists) {
    for (const hike of list.remainingHikes) {
      const key = `${hike.kind}:${hike.id}`;
      if (byId.has(key)) continue;
      const lat = hike.kind === "peak" ? hike.lat : hike.startLat;
      const lon = hike.kind === "peak" ? hike.lon : hike.startLon;
      if (
        typeof lat !== "number" ||
        typeof lon !== "number" ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        continue;
      }
      byId.set(key, {
        id: hike.id,
        lat,
        lon,
        ...(hike.kind === "trail" ? { kind: "trail" as const } : {}),
      });
    }
  }
  return [...byId.values()];
}

/** One compact line the model can quote directly in prose. */
export function formatPeakWeather(
  info: PeakWeatherInfo,
  units: WeatherUnits,
): string {
  const degrees = units === "imperial" ? "°F" : "°C";
  const windUnit = units === "imperial" ? "mph" : "km/h";
  const parts = [
    `${Math.round(info.temp)}${degrees}`,
    info.cond,
    `wind ${Math.round(info.wind)} ${windUnit}`,
  ];
  if (typeof info.hi === "number" && typeof info.lo === "number") {
    parts.push(`today ${Math.round(info.hi)}/${Math.round(info.lo)}${degrees}`);
  }
  if (typeof info.pop === "number") {
    parts.push(`${Math.round(info.pop)}% precip`);
  }
  if (typeof info.precipitation === "number") {
    const amount =
      units === "imperial"
        ? `${info.precipitation.toFixed(2)} in total`
        : `${info.precipitation.toFixed(1)} mm total`;
    parts.push(amount);
  }
  return parts.join(", ");
}

/** Pure merge: attaches formatted weather onto matching remaining peaks. */
export function attachWeather(
  context: CachedUserAgentContext,
  snapshot: PeakWeatherSnapshot,
  units: WeatherUnits,
): CachedUserAgentContext {
  if (
    Object.keys(snapshot.byPeak).length === 0 &&
    Object.keys(snapshot.byTrail ?? {}).length === 0
  ) {
    return context;
  }

  return {
    ...context,
    unfinishedLists: context.unfinishedLists.map((list) => ({
      ...list,
      remainingHikes: list.remainingHikes.map((hike) => {
        const info =
          hike.kind === "peak"
            ? snapshot.byPeak[String(hike.id)]
            : snapshot.byTrail?.[String(hike.id)];
        if (!info) return hike;
        return { ...hike, weather: formatPeakWeather(info, units) };
      }),
    })),
  };
}

/**
 * Best-effort weather injection for the agent read path. NEVER throws: any
 * cache or fetch failure degrades to the context without weather.
 */
export async function withPeakWeather(
  userId: number,
  context: CachedUserAgentContext,
): Promise<CachedUserAgentContext> {
  try {
    const units = pickWeatherUnits(context.profile);
    const points = collectRemainingPeakPoints(context);
    if (points.length === 0) return context;
    const snapshot = await getPeakWeatherSnapshot(userId, points, units);
    return attachWeather(context, snapshot, units);
  } catch (error) {
    console.warn("weather.attach.failed", { userId, error: String(error) });
    return context;
  }
}

/** Logout/reset: drop the weather snapshot alongside the agent context. */
export async function dropPeakWeatherCache(userId: number): Promise<void> {
  try {
    await cacheDel(weatherContextKey(userId));
  } catch (error) {
    console.error("Failed to drop peak weather cache:", error);
  }
}
