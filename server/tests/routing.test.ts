import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Mock } from "vitest";
import { resetMemoryCacheForTests } from "../services/cache.js";
import {
  buildRouteTableUrl,
  getDrivingDistances,
} from "../services/routing.js";

const fetchMock = globalThis.fetch as unknown as Mock;

describe("driving distance routing", () => {
  beforeEach(() => {
    resetMemoryCacheForTests();
    fetchMock.mockReset();
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it("builds one OSRM table request for an origin and multiple peaks", () => {
    const url = new URL(
      buildRouteTableUrl(
        { lat: 42, lon: -71 },
        [
          { id: 1, lat: 44, lon: -71.5 },
          { id: 2, lat: 43, lon: -72 },
        ],
      ),
    );

    expect(url.origin).toBe("https://router.project-osrm.org");
    expect(url.pathname).toBe("/table/v1/driving/-71,42;-71.5,44;-72,43");
    expect(url.searchParams.get("sources")).toBe("0");
    expect(url.searchParams.get("destinations")).toBe("1;2");
    expect(url.searchParams.get("annotations")).toBe("distance,duration");
  });

  it("returns route miles/minutes and reuses the cached matrix", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        code: "Ok",
        distances: [1609.344, 3218.688],
        durations: [600, 1200],
      }),
    );
    const origin = { lat: 42, lon: -71 };
    const destinations = [
      { id: 981101, lat: 44, lon: -71.5 },
      { id: 981102, lat: 43, lon: -72 },
    ];

    const first = await getDrivingDistances(origin, destinations);
    const second = await getDrivingDistances(origin, destinations);

    expect(first).toEqual({
      "981101": { miles: 1, minutes: 10 },
      "981102": { miles: 2, minutes: 20 },
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}