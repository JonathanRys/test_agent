import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { buildAgentSystemPrompt, createAgentContext } from "../agent/agent.js";
import { env } from "../config/env.js";
import { rankUnfinishedListsByCompletions } from "../services/completion.js";
import { shouldUseWebSearch } from "../agent/tools.js";

describe("agent route input validation", () => {
  it("requires a non-empty prompt", () => {
    const result = z
      .object({ prompt: z.string().min(1) })
      .safeParse({ prompt: "" });
    expect(result.success).toBe(false);
  });

  it("uses the configured model and operational guidance", () => {
    expect(env.OPENROUTER_MODEL).toBe("poolside/laguna-s-2.1:free");
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

  it("never offers web_search as a function tool (anti-429 guard)", () => {
    // Web search was removed as an executable tool; condition sources are
    // plain reference links in the system prompt. This prevents the model
    // from emitting web_search tool calls that trigger upstream 429s.
    expect(shouldUseWebSearch("What is the latest trail condition?")).toBe(
      false,
    );
    expect(shouldUseWebSearch("Explain what a switchback is.")).toBe(false);
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
    expect(prompt).toContain("Prefer remaining hikes on unfinished lists");
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
      "Do not recommend a peak or trail that is missing from remainingHikes",
    );
    expect(prompt).toContain("beginner -> easy first");
    expect(prompt).toContain("Already Hiked Peak");
    // Injected per-peak weather must reach the prompt and be used directly
    // instead of arming a tool.
    expect(prompt).toContain("38°F, partly cloudy, wind 12 mph");
    expect(prompt).toContain("do NOT call any tool for weather");
  });

  it("prioritizes unfinished lists with the most completions", () => {
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
        name: "Big goal",
        abbreviation: "BIG",
        type: "peakbagging",
        totalCount: 10,
        completedCount: 3,
        remainingCount: 7,
        complete: false,
      },
    ]);

    expect(sorted.map((list: { id: number }) => list.id)).toEqual([2, 3]);
  });
});
