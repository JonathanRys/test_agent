import OpenAI from "openai";
import {
  buildAgentSystemPrompt,
  buildAgentSummaryPrompt,
  createAgentContext,
} from "../agent/agent.js";
import { env } from "../config/env.js";
import { getListCompletionStatus } from "./completion.js";
import { getUserProfile } from "./profile.js";
import { applicationTools, executeApplicationTool } from "../agent/tools.js";

export const openrouter = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY ?? "demo-key",
  baseURL: env.OPENROUTER_BASE_URL,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "test_agent",
  },
});

const webSearchTool = {
  type: "openrouter:web_search",
  max_total_results: 5,
} as unknown as OpenAI.Chat.Completions.ChatCompletionTool;

export async function generateAgentReply(prompt: string, userId?: number) {
  const context = createAgentContext();
  const requestContext = userId
    ? await Promise.all([
        getUserProfile(userId),
        getListCompletionStatus(userId),
      ]).then(([profile, listCompletions]) => ({
        profile: profile ?? undefined,
        listCompletions,
      }))
    : undefined;

  if (!env.OPENROUTER_API_KEY) {
    return {
      role: "assistant",
      content: `OpenRouter is not configured yet. Demo response for: ${prompt} | Active model: ${env.OPENROUTER_MODEL} | Tools: ${context.tools.join(", ")}`,
    };
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildAgentSystemPrompt(requestContext),
    },
    { role: "user", content: prompt },
  ];

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await openrouter.chat.completions.create({
      model: env.OPENROUTER_MODEL,
      messages,
      tools: [webSearchTool, ...(userId ? applicationTools : [])],
      temperature: 0.7,
    });
    const message = response.choices[0]?.message;

    if (!message?.tool_calls?.length) {
      return {
        role: "assistant",
        content: message?.content ?? "No response returned.",
      };
    }

    messages.push(message);
    for (const toolCall of message.tool_calls) {
      if (toolCall.type !== "function") continue;

      let args: Record<string, unknown>;
      try {
        args = JSON.parse(toolCall.function.arguments) as Record<
          string,
          unknown
        >;
      } catch {
        args = {};
      }

      const result = userId
        ? await executeApplicationTool(toolCall.function.name, args, userId)
        : JSON.stringify({ ok: false, error: "Authentication required" });

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }

  return {
    role: "assistant",
    content:
      "I could not finish retrieving that information. Please try again.",
  };
}

export async function generateMessageSummary(
  userMessage: string,
  assistantMessage: string,
) {
  if (!env.OPENROUTER_API_KEY) {
    return {
      role: "assistant",
      content: `OpenRouter is not configured yet. Demo response for: ${prompt} | Active model: ${env.OPENROUTER_CONTEXT_SUMMARY_MODEL}}`,
    };
  }

  const response = await openrouter.chat.completions.create({
    model: env.OPENROUTER_CONTEXT_SUMMARY_MODEL,
    messages: [
      {
        role: "system",
        content: buildAgentSummaryPrompt(userMessage, assistantMessage),
      },
    ],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content ?? null;
}
