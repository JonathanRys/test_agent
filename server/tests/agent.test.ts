import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { buildAgentSystemPrompt, createAgentContext } from "../agent/agent.js";
import { env } from "../config/env.js";
import {
  prioritizeHikesForFitness,
  rankUnfinishedListsByCompletions,
} from "../services/completion.js";
import {
  distanceBetweenMiles,
  rankNearbyMountains,
} from "../services/mountain.js";
import {
  shouldOfferMountainSearch,
  shouldOfferNearbyMountainSearch,
  shouldUseWebSearch,
} from "../agent/tools.js";

describe("agent route input validation", () => {
  it("requires a non-empty prompt", () => {
    const result = z
      .object({ prompt: z.string().min(1) })
      .safeParse({ prompt: "" });
    expect(result.success).toBe(false);
  });

  it("uses the configured model and operational guidance", () => {
    expect(env.OPENROUTER_MODEL).toBe("poolside/laguna-s-2.1:free");
    expect(env.OPENROUTER_FALLBACK_MODELS).toBe(
      "nvidia/nemotron-3.5-lightning:free,qwen/qwen3.8-27b:free,nvidia/nemotron-3-ultra-550b-a55b:free",
    );
    const prompt = buildAgentSystemPrompt();
    expect(prompt).toContain("stateless, configuration-driven, and observable");
    expect(prompt).toContain("memory");
  });

  it("stamps the current date at the top of the system prompt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T12:00:00"));
    try {
      const prompt = buildAgentSystemPrompt();
      expect(prompt.startsWith("Current date and time:")).toBe(true);
      expect(prompt).toContain(
        "Current date and time: Saturday, September 26, 2026",
      );
      // The date must survive context injection too — the early-return path
      // and the context path share the same stamped base prompt.
      const withContext = buildAgentSystemPrompt({
        profile: {
          id: 1,
          name: "Test Hiker",
          email: "hiker@example.test",
          preferences: {
            birthdate: null,
            fitnessLevel: "intermediate",
            homeLocation: null,
            units: "imperial",
            interests: [],
          },
        },
        unfinishedLists: [],
      });
      expect(withContext.startsWith("Current date and time:")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts with empty memory and the supported tools", () => {
    expect(createAgentContext()).toEqual({
      memory: [],
      tools: [
        "chat",
        "healthcheck",
        "get_hike_details",
        "get_user_adventures",
        "web_search",
        "weather",
        "road_closures",
        "trail_conditions",
      ],
    });
  });

  it("enables hosted web search for current outdoor conditions only", () => {
    expect(shouldUseWebSearch("What is the latest trail condition?")).toBe(true);
    expect(shouldUseWebSearch("What is the weather forecast?")).toBe(true);
    expect(shouldUseWebSearch("Explain what a switchback is.")).toBe(false);
  });

  it("offers database peak verification only for area-based recommendations", () => {
    expect(
      shouldOfferMountainSearch("Suggest a shorter hike in southern NH"),
    ).toBe(true);
    expect(
      shouldOfferMountainSearch(
        "Let's keep it in southern NH for a shorter drive and manageable terrain",
      ),
    ).toBe(true);
    expect(shouldOfferMountainSearch("Tell me about Mount Washington")).toBe(
      false,
    );
    expect(shouldOfferMountainSearch("Explain what a switchback is")).toBe(
      false,
    );
  });

  it("recognizes nearby hiking requests", () => {
    expect(
      shouldOfferNearbyMountainSearch(
        "Where to go hiking today that was near by?",
      ),
    ).toBe(true);
    expect(
      shouldOfferNearbyMountainSearch(
        "Where should I go hiking today? I'm looking for something close by.",
      ),
    ).toBe(true);
    expect(shouldOfferNearbyMountainSearch("Explain what a switchback is")).toBe(
      false,
    );
  });

  it("calculates straight-line miles for nearby mountain ranking", () => {
    expect(
      distanceBetweenMiles({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }),
    ).toBeCloseTo(69.1, 0);
  });

  it("ranks nearby peaks by driving distance when routes are available", () => {
    const peaks = [
      {
        id: 1,
        name: "Hale",
        lat: 44,
        lon: -71,
        distanceMiles: 65,
        drivingMiles: 103,
      },
      {
        id: 2,
        name: "Cannon",
        lat: 44,
        lon: -71,
        distanceMiles: 70,
        drivingMiles: 98,
      },
      {
        id: 3,
        name: "Monadnock",
        lat: 43,
        lon: -72,
        distanceMiles: 55,
        drivingMiles: 75,
      },
    ];

    expect(rankNearbyMountains(peaks, true).map((peak) => peak.name)).toEqual([
      "Monadnock",
      "Cannon",
      "Hale",
    ]);
    expect(rankNearbyMountains(peaks, false).map((peak) => peak.name)).toEqual([
      "Monadnock",
      "Hale",
      "Cannon",
    ]);
  });

  it("includes authenticated profile and list context in the system prompt", () => {
    const prompt = buildAgentSystemPrompt({
      profile: {
        id: 1,
        name: "Test Hiker",
        email: "hiker@example.test",
        preferences: {
          birthdate: null,
          fitnessLevel: "intermediate",
          homeLocation: "Somerville, MA",
          units: "imperial",
          interests: ["peakbagging"],
        },
      },
      unfinishedLists: [],
    });

    expect(prompt).toContain('"homeLocation": "Somerville, MA"');
    expect(prompt).toContain(
      "When the user has not prioritized another constraint such as proximity",
    );
  });

  it("tells recommendations to avoid completed peaks and match fitness", () => {
    const prompt = buildAgentSystemPrompt({
      profile: {
        id: 1,
        name: "Test Hiker",
        email: "hiker@example.test",
        preferences: {
          birthdate: null,
          fitnessLevel: "beginner",
          homeLocation: "Somerville, MA",
          units: "imperial",
          interests: [],
        },
      },
      unfinishedLists: [
        {
          id: 7,
          name: "Unfinished goal",
          abbreviation: "GOAL",
          type: "peakbagging",
          totalCount: 10,
          completedCount: 9,
          remainingCount: 1,
          complete: false,
          remainingHikes: [
            {
              kind: "peak",
              id: 42,
              name: "Already Hiked Peak",
              state: "NH",
              height: 3000,
              distance: 8,
              bushwhack: false,
              difficulty: "moderate" as never,
              range: null,
              routeDetails: null,
              lat: 44.2692,
              lon: -71.3021,
              weather: "38°F, partly cloudy, wind 12 mph",
            },
          ],
        },
      ],
    });

    expect(prompt).toContain(
      "use search_mountains once to verify peak names, IDs, stats, and list memberships",
    );
    expect(prompt).toContain(
      "For a nearby/local request, use find_nearby_mountains once",
    );
    expect(prompt).toContain("Clearly label off-list suggestions");
    expect(prompt).toContain(
      "proximity outranks list completion progress",
    );
    expect(prompt).toContain("Peak coordinates are not verified trailheads");
    expect(prompt).toContain("Do not invent a route name, mileage, or elevation gain");
    expect(prompt).toContain("prioritized to match the user's fitness level");
    expect(prompt).toContain(
      "prefer hikes with lower precipitation probability and lighter wind",
    );
    expect(prompt).toContain("Already Hiked Peak");
    // Injected per-peak weather must reach the prompt and be used directly
    // instead of arming a tool.
    expect(prompt).toContain("38°F, partly cloudy, wind 12 mph");
    expect(prompt).toContain("Use it directly for covered hikes");
  });

  it("prioritizes unfinished lists closest to completion", () => {
    const sorted = rankUnfinishedListsByCompletions([
      {
        id: 1,
        name: "Finished",
        abbreviation: "FIN",
        type: "peakbagging",
        totalCount: 2,
        completedCount: 2,
        remainingCount: 0,
        complete: true,
      },
      {
        id: 2,
        name: "Nearly done",
        abbreviation: "NEAR",
        type: "trace",
        totalCount: 10,
        completedCount: 8,
        remainingCount: 2,
        complete: false,
      },
      {
        id: 3,
        name: "More completions but less progress",
        abbreviation: "BIG",
        type: "peakbagging",
        totalCount: 100,
        completedCount: 50,
        remainingCount: 50,
        complete: false,
      },
    ]);

    expect(sorted.map((list: { id: number }) => list.id)).toEqual([2, 3]);
  });

  it("prioritizes unstarted-list hikes by the user's skill level", () => {
    const hikes = [
      {
        kind: "peak" as const,
        id: 1,
        name: "Strenuous",
        state: "NH",
        height: 5000,
        distance: 12,
        bushwhack: false,
        difficulty: { high: "Strenuous" } as never,
        range: null,
        routeDetails: null,
        lat: null,
        lon: null,
      },
      {
        kind: "peak" as const,
        id: 2,
        name: "Easy",
        state: "NH",
        height: 3000,
        distance: 3,
        bushwhack: false,
        difficulty: { high: "Easy" } as never,
        range: null,
        routeDetails: null,
        lat: null,
        lon: null,
      },
      {
        kind: "peak" as const,
        id: 3,
        name: "Moderate",
        state: "NH",
        height: 4000,
        distance: 7,
        bushwhack: false,
        difficulty: { high: "Moderate" } as never,
        range: null,
        routeDetails: null,
        lat: null,
        lon: null,
      },
    ];

    expect(
      prioritizeHikesForFitness(hikes, "beginner").map((hike) => hike.name),
    ).toEqual(["Easy", "Moderate", "Strenuous"]);
    expect(
      prioritizeHikesForFitness(hikes, "expert").map((hike) => hike.name),
    ).toEqual(["Moderate", "Strenuous", "Easy"]);
  });
});
