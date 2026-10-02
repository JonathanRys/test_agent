import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Mock } from "vitest";
import { resetMemoryCacheForTests } from "../services/cache.js";
import { geocodeLocation } from "../services/geocoding.js";

const fetchMock = globalThis.fetch as unknown as Mock;

describe("home-location geocoding cache", () => {
  beforeEach(() => {
    resetMemoryCacheForTests();
    fetchMock.mockReset();
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it("geocodes once and reuses the cached coordinates", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          {
            name: "Somerville",
            admin1: "Massachusetts",
            country: "United States",
            latitude: 42.3876,
            longitude: -71.0995,
          },
        ],
      }),
    );
    const query = `Somerville cache test ${Date.now()}`;

    const first = await geocodeLocation(query);
    const second = await geocodeLocation(query);

    expect(first).toEqual({
      label: "Somerville, Massachusetts, United States",
      lat: 42.3876,
      lon: -71.0995,
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("briefly caches locations with no geocoding result", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }));
    const query = `Unknown place ${Date.now()}`;

    expect(await geocodeLocation(query)).toBeNull();
    expect(await geocodeLocation(query)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}