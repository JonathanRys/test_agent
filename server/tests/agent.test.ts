import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildAgentSystemPrompt, createAgentContext } from "../agent/agent.js";
import { env } from "../config/env.js";
import { sortListCompletionStatus } from "../services/completion.js";

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
        "web_search",
        "weather",
        "road_closures",
        "trail_conditions",
      ],
    });
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
