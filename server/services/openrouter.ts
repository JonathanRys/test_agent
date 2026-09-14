import OpenAI from "openai";
import {
  buildAgentSystemPrompt,
  buildAgentSummaryPrompt,
  createAgentContext,
} from "../agent/agent.js";
import { env } from "../config/env.js";
import {
  getListCompletionStatus,
  getUserCompletedPeaks,
} from "./completion.js";
import { getUserProfile } from "./profile.js";
import {
  applicationTools,
  executeApplicationTool,
  shouldUseWebSearch,
} from "../agent/tools.js";

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
        getUserCompletedPeaks(userId),
      ]).then(([profile, listCompletions, completedPeaks]) => ({
        profile: profile ?? undefined,
        listCompletions,
        completedPeaks,
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

  const tools = [
    ...(shouldUseWebSearch(prompt) ? [webSearchTool] : []),
    ...(userId ? applicationTools : []),
  ];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const startedAt = Date.now();
    const response = await openrouter.chat.completions.create({
      model: env.OPENROUTER_MODEL,
      messages,
      tools,
      temperature: 0.7,
    });
    console.info("agent.model.request", {
      attempt: attempt + 1,
      durationMs: Date.now() - startedAt,
      toolRound: Boolean(response.choices[0]?.message?.tool_calls?.length),
    });
    const message = response.choices[0]?.message;

    if (!message?.tool_calls?.length) {
      return {
        role: "assistant",
        content: message?.content ?? "No response returned.",
      };
    }

    messages.push(message);
    const toolResults = await Promise.all(
      message.tool_calls.map(async (toolCall) => {
        if (toolCall.type !== "function") return null;

        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments) as Record<
            string,
            unknown
          >;
        } catch {
          args = {};
        }

        const toolStartedAt = Date.now();
        const result = userId
          ? await executeApplicationTool(toolCall.function.name, args, userId)
          : JSON.stringify({ ok: false, error: "Authentication required" });
        console.info("agent.tool.request", {
          name: toolCall.function.name,
          durationMs: Date.now() - toolStartedAt,
        });

        return {
          role: "tool" as const,
          tool_call_id: toolCall.id,
          content: result,
        };
      }),
    );
    messages.push(
      ...toolResults.filter(
        (result): result is NonNullable<typeof result> => result !== null,
      ),
    );
  }

  return {
    role: "assistant",
    content:
      "I could not finish retrieving that information. Please try again.",
  };
}

export async function generateAgentReplyStream(
  prompt: string,
  userId: number | undefined,
  onToken: (token: string) => void,
): Promise<string> {
  if (!env.OPENROUTER_API_KEY) {
    const content = `OpenRouter is not configured yet. Demo response for: ${prompt} | Active model: ${env.OPENROUTER_MODEL}`;
    onToken(content);
    return content;
  }

  const requestContext = userId
    ? await Promise.all([
        getUserProfile(userId),
        getListCompletionStatus(userId),
        getUserCompletedPeaks(userId),
      ]).then(([profile, listCompletions, completedPeaks]) => ({
        profile: profile ?? undefined,
        listCompletions,
        completedPeaks,
      }))
    : undefined;
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildAgentSystemPrompt(requestContext) },
    { role: "user", content: prompt },
  ];
  const tools = [
    ...(shouldUseWebSearch(prompt) ? [webSearchTool] : []),
    ...(userId ? applicationTools : []),
  ];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const startedAt = Date.now();
    const response = await openrouter.chat.completions.create({
      model: env.OPENROUTER_MODEL,
      messages,
      tools,
      temperature: 0.7,
      stream: tools.length === 0 || attempt === 2,
    });

    if (typeof (response as any)[Symbol.asyncIterator] === "function") {
      let content = "";
      for await (const chunk of response as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
        const token = chunk.choices[0]?.delta?.content ?? "";
        if (token) {
          content += token;
          onToken(token);
        }
      }
      console.info("agent.model.stream", {
        durationMs: Date.now() - startedAt,
        characters: content.length,
      });
      return content || "No response returned.";
    }

    const message = (
      response as unknown as OpenAI.Chat.Completions.ChatCompletion
    ).choices[0]?.message;
    if (!message?.tool_calls?.length) {
      const content = message?.content ?? "No response returned.";
      onToken(content);
      return content;
    }

    messages.push(message);
    const toolResults = await Promise.all(
      message.tool_calls.map(async (toolCall) => {
        if (toolCall.type !== "function") return null;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments) as Record<
            string,
            unknown
          >;
        } catch {
          // Let the tool return its normal validation error for malformed arguments.
        }
        const toolStartedAt = Date.now();
        const result = userId
          ? await executeApplicationTool(toolCall.function.name, args, userId)
          : JSON.stringify({ ok: false, error: "Authentication required" });
        console.info("agent.tool.request", {
          name: toolCall.function.name,
          durationMs: Date.now() - toolStartedAt,
        });
        return {
          role: "tool" as const,
          tool_call_id: toolCall.id,
          content: result,
        };
      }),
    );
    messages.push(
      ...toolResults.filter(
        (result): result is NonNullable<typeof result> => result !== null,
      ),
    );
  }

  const content =
    "I could not finish retrieving that information. Please try again.";
  onToken(content);
  return content;
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
