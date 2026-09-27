import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Mock } from "vitest";
import { resetMemoryCacheForTests } from "../services/cache.js";
import type { CachedUserAgentContext } from "../services/userContext.js";
import {
  attachWeather,
  buildWeatherRequestUrl,
  collectRemainingPeakPoints,
  describeWeatherCode,
  fetchPeakWeather,
  formatPeakWeather,
  getPeakWeatherSnapshot,
  parseWeatherResponse,
  pickWeatherUnits,
  weatherContextKey,
  withPeakWeather,
  type PeakWeatherPoint,
  type PeakWeatherSnapshot,
} from "../services/weather.js";

function makeContext(): CachedUserAgentContext {
  return {
    unfinishedLists: [
      {
        id: 7,
        name: "Unfinished goal",
        abbreviation: "GOAL",
        type: "peakbagging",
        totalCount: 3,
        completedCount: 1,
        remainingCount: 2,
        complete: false,
        remainingHikes: [
          {
            kind: "peak",
            id: 42,
            name: "Located Peak",
            state: "NH",
            height: 4000,
            distance: 8,
            bushwhack: false,
            difficulty: "moderate" as never,
            range: "Presidential",
            routeDetails: null,
            lat: 44.2692,
            lon: -71.3021,
          },
          {
            kind: "peak",
            id: 43,
            name: "Coordinateless Peak",
            state: "NH",
            height: 3500,
            distance: 5,
            bushwhack: false,
            difficulty: "easy" as never,
            range: null,
            routeDetails: null,
            lat: null,
            lon: null,
          },
          {
            kind: "trail",
            id: 9,
            name: "Some Trail",
            state: "NH",
            distance: 3,
            elevationGain: 900,
            elevationLoss: -900,
            routeDetails: null,
          },
        ],
      },
    ],
  };
}

const BASE = "https://api.open-meteo.com/v1/forecast";

// tests/setup.ts stubs globalThis.fetch with its fetchMock before each file;
// capture it from the global instead of importing across the server rootDir.
const fetchMock = globalThis.fetch as unknown as Mock;

// Shaped like a real Open-Meteo multi-location response: one entry per point,
// in request order, with rounded-to-1 values so assertions stay obvious.
function openMeteoPayload(count: number): unknown[] {
  return Array.from({ length: count }, () => ({
    current: {
      temperature_2m: 10.6,
      weather_code: 2,
      wind_speed_10m: 5.4,
    },
    daily: {
      temperature_2m_max: [12.2],
      temperature_2m_min: [4.4],
      precipitation_probability_max: [31],
    },
  }));
}
describe("weather service pure helpers", () => {
  it("maps WMO weather codes to readable conditions", () => {
    expect(describeWeatherCode(0)).toBe("clear");
    expect(describeWeatherCode(3)).toBe("overcast");
    expect(describeWeatherCode(71)).toBe("light snow");
    expect(describeWeatherCode(95)).toBe("thunderstorm");
    expect(describeWeatherCode(1234)).toBe("unknown conditions");
  });

  it("derives units from the user profile, defaulting to imperial", () => {
    expect(pickWeatherUnits(undefined)).toBe("imperial");
    expect(pickWeatherUnits(null)).toBe("imperial");
    expect(
      pickWeatherUnits({
        id: 1,
        name: "T",
        email: "t@example.test",
        preferences: {
          birthdate: null,
          fitnessLevel: null,
          homeLocation: null,
          units: "metric",
          interests: [],
        },
      }),
    ).toBe("metric");
  });

  it("names the per-user weather cache key distinctly from the context key", () => {
    expect(weatherContextKey(42)).toBe("user:42:peak-weather");
    expect(weatherContextKey(42)).not.toBe("user:42:agent-context");
  });

  it("builds a batched Open-Meteo url in the requested units", () => {
    const points: PeakWeatherPoint[] = [
      { id: 1, lat: 44.2692, lon: -71.3021 },
      { id: 2, lat: 44.1, lon: -71.35 },
    ];
    const imperial = new URL(buildWeatherRequestUrl(points, "imperial"));
    expect(imperial.origin + imperial.pathname).toBe(BASE);
    expect(imperial.searchParams.get("latitude")).toBe("44.2692,44.1000");
    expect(imperial.searchParams.get("longitude")).toBe("-71.3021,-71.3500");
    expect(imperial.searchParams.get("temperature_unit")).toBe("fahrenheit");
    expect(imperial.searchParams.get("wind_speed_unit")).toBe("mph");

    const metric = new URL(buildWeatherRequestUrl(points, "metric"));
    expect(metric.searchParams.get("temperature_unit")).toBe("celsius");
    expect(metric.searchParams.get("wind_speed_unit")).toBe("kmh");
  });
});


describe("weather parsing and formatting", () => {
  it("parses single-object and array Open-Meteo responses by position", () => {
    const points: PeakWeatherPoint[] = [
      { id: 1, lat: 44.2, lon: -71.3 },
      { id: 2, lat: 43.9, lon: -72.1 },
    ];
    const single = parseWeatherResponse(openMeteoPayload(1), [points[0]]);
    expect(single["1"]).toEqual({
      temp: 11,
      cond: "partly cloudy",
      wind: 5,
      hi: 12,
      lo: 4,
      pop: 31,
    });

    const many = parseWeatherResponse(openMeteoPayload(2), points);
    expect(many["1"]?.temp).toBe(11);
    expect(many["2"]?.cond).toBe("partly cloudy");

    // Entries without usable current data are skipped, not fatal.
    const partial = parseWeatherResponse(
      [{ error: true }, openMeteoPayload(1)[0]],
      points,
    );
    expect(partial["1"]).toBeUndefined();
    expect(partial["2"]?.temp).toBe(11);
  });

  it("formats a compact weather line in the user's units", () => {
    expect(
      formatPeakWeather(
        { temp: 38, cond: "partly cloudy", wind: 12, hi: 45, lo: 30, pop: 20 },
        "imperial",
      ),
    ).toBe("38°F, partly cloudy, wind 12 mph, today 45/30°F, 20% precip");
    expect(
      formatPeakWeather({ temp: 3, cond: "snow", wind: 9 }, "metric"),
    ).toBe("3°C, snow, wind 9 km/h");
  });

  it("collects only unique peaks that have coordinates", () => {
    const points = collectRemainingPeakPoints(makeContext());
    expect(points).toEqual([{ id: 42, lat: 44.2692, lon: -71.3021 }]);
  });

  it("attaches weather to matching peaks only without mutating the input", () => {
    const context = makeContext();
    const snapshot: PeakWeatherSnapshot = {
      units: "imperial",
      fetchedAt: new Date().toISOString(),
      byPeak: { "42": { temp: 38, cond: "clear", wind: 5 } },
    };
    const merged = attachWeather(context, snapshot, "imperial");
    const hikes = merged.unfinishedLists[0]!.remainingHikes;
    expect(hikes[0]).toMatchObject({
      name: "Located Peak",
      weather: "38°F, clear, wind 5 mph",
    });

describe("weather fetch, cache, and backoff", () => {
  beforeEach(() => {
    resetMemoryCacheForTests();
    fetchMock.mockReset();
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it("batches large point sets into multiple Open-Meteo requests", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const count = url.searchParams.get("latitude")!.split(",").length;
      return jsonResponse(openMeteoPayload(count));
    });

    const points: PeakWeatherPoint[] = Array.from(
      { length: 60 },
      (_, index) => ({ id: index + 1, lat: 44 + index * 0.01, lon: -71 }),
    );
    const result = await fetchPeakWeather(points, "imperial");

    expect(fetchMock.mock.calls.length).toBe(2);
    expect(Object.keys(result)).toHaveLength(60);
  });

  it("throws only when every batch fails", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ error: true, reason: "upstream down" }, 503),
    );

    await expect(
      fetchPeakWeather([{ id: 1, lat: 44.2, lon: -71.3 }], "imperial"),
    ).rejects.toThrow();
  });

  it("serves repeat reads from cache without a second fetch", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(openMeteoPayload(1)));
    const points = collectRemainingPeakPoints(makeContext());

    const first = await getPeakWeatherSnapshot(9901, points, "imperial");
    expect(first.byPeak["42"]?.temp).toBe(11);
    expect(first.failedAt).toBeUndefined();
    const callsAfterFirst = fetchMock.mock.calls.length;

    const second = await getPeakWeatherSnapshot(9901, points, "imperial");
    expect(second.byPeak["42"]).toEqual(first.byPeak["42"]);
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("backs off instead of re-fetching after a failed attempt", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ error: true, reason: "boom" }, 400),
    );
    const points = collectRemainingPeakPoints(makeContext());

    const first = await getPeakWeatherSnapshot(9902, points, "imperial");
    expect(first.byPeak).toEqual({});
    expect(first.failedAt).toBeDefined();
    expect(fetchMock.mock.calls.length).toBe(1);

    const second = await getPeakWeatherSnapshot(9902, points, "imperial");
    expect(fetchMock.mock.calls.length).toBe(1);
    expect(second.failedAt).toBeDefined();
  });

  it("re-fetches when the user switches unit preference", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(openMeteoPayload(1)));
    const points = collectRemainingPeakPoints(makeContext());

    await getPeakWeatherSnapshot(9903, points, "imperial");
    expect(fetchMock.mock.calls.length).toBe(1);

    await getPeakWeatherSnapshot(9903, points, "metric");
    expect(fetchMock.mock.calls.length).toBe(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "temperature_unit=celsius",
    );

    await getPeakWeatherSnapshot(9903, points, "metric");
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it("withPeakWeather degrades to the raw context when fetch fails", async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error("network down");
    });

    const result = await withPeakWeather(9904, makeContext());
    const hikes = result.unfinishedLists[0]!.remainingHikes;
    expect(hikes[0]).not.toHaveProperty("weather");
    expect(hikes[0]).toMatchObject({ name: "Located Peak" });
  });

  it("withPeakWeather attaches a formatted weather line", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(openMeteoPayload(1)));

    const result = await withPeakWeather(9905, makeContext());
    expect(result.unfinishedLists[0]!.remainingHikes[0]).toMatchObject({
      weather: "11°F, partly cloudy, wind 5 mph, today 12/4°F, 31% precip",
    });
  });
});

    expect(hikes[1]).not.toHaveProperty("weather");
    expect(hikes[2]).not.toHaveProperty("weather");
    expect(
      context.unfinishedLists[0]!.remainingHikes[0],
    ).not.toHaveProperty("weather");
  });
});


function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
