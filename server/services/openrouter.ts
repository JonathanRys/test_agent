import OpenAI from "openai";
import {
  DEFAULT_MODEL,
  buildAgentSystemPrompt,
  createAgentContext,
} from "../agent/agent.js";
import { env } from "../config/env.js";

export const openrouter = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY ?? "demo-key",
  baseURL: env.OPENROUTER_BASE_URL,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "test_agent",
  },
});

export async function generateAgentReply(prompt: string) {
  const context = createAgentContext();

  if (!env.OPENROUTER_API_KEY) {
    return {
      role: "assistant",
      content: `OpenRouter is not configured yet. Demo response for: ${prompt} | Active model: ${DEFAULT_MODEL} | Tools: ${context.tools.join(", ")}`,
    };
  }

  const response = await openrouter.chat.completions.create({
    model: env.OPENROUTER_MODEL || DEFAULT_MODEL,
    messages: [
      {
        role: "system",
        content: buildAgentSystemPrompt(),
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });

  return {
    role: "assistant",
    content: response.choices[0]?.message?.content ?? "No response returned.",
  };
}
