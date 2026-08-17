import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildAgentSystemPrompt } from "../agent/agent.js";
import { env } from "../config/env.js";

describe("agent route input validation", () => {
  it("requires a non-empty prompt", () => {
    const result = z
      .object({ prompt: z.string().min(1) })
      .safeParse({ prompt: "" });
    expect(result.success).toBe(false);
  });

  it("uses the free OpenRouter model and 12-factor guidance", () => {
    expect(env.OPENROUTER_MODEL).toBe("poolside/laguna-s-2.1:free");
    const prompt = buildAgentSystemPrompt();
    expect(prompt).toContain("12-factor");
    expect(prompt).toContain("memory");
  });
});
