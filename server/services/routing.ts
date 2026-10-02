import { env } from "../config/env.js";
import { cacheGet, cacheSet } from "./cache.js";

const ROUTE_CACHE_TTL_SECONDS = 6 * 60 * 60;
const ROUTE_FAILURE_TTL_SECONDS = 2 * 60;
const ROUTE_TIMEOUT_MS = 5000;

export type RoutePoint = {
  id: number;
  lat: number;
  lon: number;
};

export type DrivingDistance = {
  miles: number;
  minutes: number;
};

type RouteCacheEntry = {
  distances: Record<string, DrivingDistance>;
};

export function buildRouteTableUrl(
  origin: Pick<RoutePoint, "lat" | "lon">,
  destinations: RoutePoint[],
  baseUrl = env.ROUTING_API_BASE_URL,
): string {
  const coordinates = [origin, ...destinations]
    .map(({ lat, lon }) => `${lon},${lat}`)
    .join(";");
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/${coordinates}`);
  url.searchParams.set("sources", "0");
  url.searchParams.set(
    "destinations",
    destinations.map((_, index) => String(index + 1)).join(";"),
  );
  url.searchParams.set("annotations", "distance,duration");
  return url.toString();
}

function routeCacheKey(
  origin: Pick<RoutePoint, "lat" | "lon">,
  destinations: RoutePoint[],
): string {
  const originKey = `${origin.lat.toFixed(3)},${origin.lon.toFixed(3)}`;
  const destinationKey = destinations
    .map(({ id }) => id)
    .sort((left, right) => left - right)
    .join(",");
  return `routes:driving:${originKey}:${destinationKey}`;
}

export async function getDrivingDistances(
  origin: Pick<RoutePoint, "lat" | "lon">,
  destinations: RoutePoint[],
): Promise<Record<string, DrivingDistance>> {
  if (destinations.length === 0) return {};

  const key = routeCacheKey(origin, destinations);
  const cached = await cacheGet<RouteCacheEntry>(key);
  if (cached) return cached.distances;

  try {
    const signal =
      typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? AbortSignal.timeout(ROUTE_TIMEOUT_MS)
        : undefined;
    const response = await fetch(buildRouteTableUrl(origin, destinations), {
      signal,
    });
    if (!response.ok) throw new Error(`routing api responded ${response.status}`);

    const payload = (await response.json()) as {
      code?: string;
      distances?: Array<number | null>;
      durations?: Array<number | null>;
    };
    if (payload.code !== "Ok" || !payload.distances || !payload.durations) {
      throw new Error(`routing api returned ${payload.code ?? "invalid data"}`);
    }

    const routes: Record<string, DrivingDistance> = {};
    destinations.forEach((destination, index) => {
      const meters = payload.distances?.[index];
      const seconds = payload.durations?.[index];
      if (typeof meters !== "number" || typeof seconds !== "number") return;
      routes[String(destination.id)] = {
        miles: meters / 1609.344,
        minutes: seconds / 60,
      };
    });
    await cacheSet(
      key,
      { distances: routes },
      Object.keys(routes).length === destinations.length
        ? ROUTE_CACHE_TTL_SECONDS
        : ROUTE_FAILURE_TTL_SECONDS,
    );
    return routes;
  } catch (error) {
    console.warn("routing.table.failed", { error: String(error) });
    await cacheSet(key, { distances: {} }, ROUTE_FAILURE_TTL_SECONDS);
    return {};
  }
}