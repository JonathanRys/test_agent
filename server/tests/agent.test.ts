import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildAgentSystemPrompt, createAgentContext } from "../agent/agent.js";
import { env } from "../config/env.js";
import { sortListCompletionStatus } from "../services/completion.js";
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

  it("starts with empty memory and the supported tools", () => {
    expect(createAgentContext()).toEqual({
      memory: [],
      tools: [
        "chat",
        "healthcheck",
        "user_profile",
        "list_completion_status",
        "search_mountains",
        "web_search",
        "weather",
        "road_closures",
        "trail_conditions",
      ],
    });
  });

  it("only enables web search for current-condition requests", () => {
    expect(shouldUseWebSearch("What is the latest trail condition?")).toBe(
      true,
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
      listCompletions: [],
    });

    expect(prompt).toContain('"homeLocation": "Somerville, MA"');
    expect(prompt).toContain("Prefer unfinished lists");
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
      completedPeaks: [
        {
          id: 42,
          name: "Already Hiked Peak",
          state: "NH",
          height: 3000,
          distance: 8,
          bushwhack: false,
          completedAt: new Date("2026-01-01"),
        },
      ],
    });

    expect(prompt).toContain(
      "Do not recommend a peak in the completed peaks list",
    );
    expect(prompt).toContain("beginner -> easy first");
    expect(prompt).toContain("Already Hiked Peak");
  });

  it("prioritizes unfinished lists with the most remaining objectives", () => {
    const sorted = sortListCompletionStatus([
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

    expect(sorted.map((list) => list.id)).toEqual([3, 2, 1]);
  });
});
