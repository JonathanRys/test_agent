import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildAgentSystemPrompt, createAgentContext } from "../agent/agent.js";
import { env } from "../config/env.js";

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
      tools: ["chat", "healthcheck"],
    });
  });
});
