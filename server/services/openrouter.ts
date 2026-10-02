import OpenAI from "openai";
import {
  buildAgentSystemPrompt,
  buildAgentSummaryPrompt,
  createAgentContext,
} from "../agent/agent.js";
import {
  collectMountainCardReferences,
  linkMountainCards,
  type MountainCardReference,
} from "../agent/mountainLinks.js";
import { env } from "../config/env.js";
import {
  applicationTools,
  executeApplicationTool,
  mountainSearchTool,
  nearbyMountainSearchTool,
  shouldOfferDetailTools,
  shouldOfferMountainSearch,
  shouldOfferNearbyMountainSearch,
  shouldUseWebSearch,
  stripPseudoToolMarkup,
} from "../agent/tools.js";
import { getUserAgentContext } from "./userContext.js";

export const openrouter = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY ?? "demo-key",
  baseURL: env.OPENROUTER_BASE_URL,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "test_agent",
  },
  // Fail fast: the route streams to the client, so a hung upstream call must
  // not hold the SSE connection open indefinitely.
  timeout: 30_000,
  maxRetries: 0,
});

const MODEL_FALLBACKS = [
  env.OPENROUTER_MODEL,
  ...String(env.OPENROUTER_FALLBACK_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean),
].filter((model, index, all) => all.indexOf(model) === index);

function isRetryableRateLimit(error: unknown): boolean {
  if (error instanceof OpenAI.RateLimitError) return true;
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : NaN;
  return status === 429;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// Single OpenRouter call with retry-then-fallback for 429s from the shared
// free-model pool. We keep the retry budget tiny (2 attempts, ~1s total) so a
// rate-limited turn degrades to a retryable "busy" message instead of hanging
// the stream for a minute. Callers should surface a RateLimitError via
// throwRateLimitResponse() rather than swallowing it as normal content.
async function createChatCompletion(
  body: Omit<
    OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    "model"
  >,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  let lastError: unknown = null;
  for (const model of MODEL_FALLBACKS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return (await openrouter.chat.completions.create({
          ...body,
          model,
        })) as OpenAI.Chat.Completions.ChatCompletion;
      } catch (error) {
        lastError = error;
        if (!isRetryableRateLimit(error)) throw error;
        console.warn("agent.model.rate_limited", {
          model,
          attempt: attempt + 1,
        });
        // Brief backoff (300ms, then 700ms) before retrying the same model.
        await sleep(attempt === 0 ? 300 : 700);
      }
    }
    console.warn("agent.model.fallback", { from: model });
  }
  throw lastError;
}

// Populated by createSummaryCompletion below; declared first so references
// inside that function never hit the temporal dead zone.
let lastSummaryError: unknown = null;

// Fire-and-forget background summarization: never blocks the SSE response
// path, retries transient 429s once, and gives up silently. Summaries are
// best-effort session memory, not worth a second stuck request per turn.
async function createSummaryCompletion(
  body: Omit<
    OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    "model"
  >,
): Promise<OpenAI.Chat.Completions.ChatCompletion | null> {
  for (const model of [env.OPENROUTER_CONTEXT_SUMMARY_MODEL, ...MODEL_FALLBACKS]) {
    try {
      return (await openrouter.chat.completions.create({
        ...body,
        model,
      })) as OpenAI.Chat.Completions.ChatCompletion;
    } catch (error) {
      if (!isRetryableRateLimit(error)) {
        console.warn("agent.summary.failed", {
          model,
          message: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
      console.warn("agent.summary.rate_limited", { model });
      await sleep(500);
      try {
        return (await openrouter.chat.completions.create({
          ...body,
          model,
        })) as OpenAI.Chat.Completions.ChatCompletion;
      } catch (retryError) {
        console.warn("agent.summary.retry_failed", { model });
        lastSummaryError = retryError;
      }
    }
  }
  return null;
}

function throwRateLimitResponse(): never {
  const error = new OpenAI.RateLimitError(
    429,
    { error: { message: "Upstream hike advisor is busy, please retry.", code: 429 } } as never,
    "The hike advisor is busy right now (shared model pool is rate-limited). Please wait a moment and try again.",
    {},
  );
  throw error;
}

export async function generateAgentReply(
  prompt: string,
  userId?: number,
  rawPrompt = prompt,
) {
  const context = createAgentContext();
  const requestContext = userId
    ? await getUserAgentContext(userId)
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
  const mountainCards = new Map<number, string>();
  for (const list of requestContext?.unfinishedLists ?? []) {
    for (const hike of list.remainingHikes) {
      if (hike.kind === "peak") {
        mountainCards.set(hike.id, hike.name);
      }
    }
  }

  const tools = [
    ...(userId && shouldOfferNearbyMountainSearch(rawPrompt)
      ? [nearbyMountainSearchTool as OpenAI.Chat.Completions.ChatCompletionTool]
      : []),
    ...(userId && shouldOfferMountainSearch(rawPrompt)
      ? [mountainSearchTool as OpenAI.Chat.Completions.ChatCompletionTool]
      : []),
    // Default: NO function tools — answer from injected remainingHikes.
    // Only expose detail/history tools when explicitly requested, and the
    // runtime enforces max 1 tool call below to stop fan-out 429s.
    ...(userId && shouldOfferDetailTools(rawPrompt) ? applicationTools : []),
  ];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const startedAt = Date.now();
    const toolsForAttempt = attempt === 0 ? tools : [];
    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await createChatCompletion({
        messages,
        tools: toolsForAttempt,
        ...webSearchPluginOptions(rawPrompt),
        temperature: 0.7,
        // Single-call tool budget: one model->tool->model round-trip max.
        tool_choice: toolsForAttempt.length > 0 ? "auto" : "none",
      });
    } catch (error) {
      if (isRetryableRateLimit(error)) throwRateLimitResponse();
      throw error;
    }
    console.info("agent.model.request", {
      attempt: attempt + 1,
      durationMs: Date.now() - startedAt,
      toolRound: Boolean(response.choices[0]?.message?.tool_calls?.length),
    });
    const message = response.choices[0]?.message;

    if (!message?.tool_calls?.length) {
      return {
        role: "assistant",
        content:
          linkMountainCards(
            stripPseudoToolMarkup(message?.content ?? ""),
            mountainCardReferences(mountainCards),
          ) || "No response returned.",
      };
    }

    // Enforce a single-tool-call budget per turn: execute only the first
    // function call and ignore the rest. This is the direct fix for the
    // observed 8x parallel get_mountain/get_trail fan-out causing 429s.
    // The second (final) attempt then streams the answer with tools disabled.
    const firstCall = message.tool_calls.find(
      (call) => call.type === "function",
    );
    messages.push(message);
    if (!firstCall || firstCall.type !== "function") {
      return {
        role: "assistant",
        content: stripPseudoToolMarkup(message?.content ?? "") || "No response returned.",
      };
    }
    let firstArgs: Record<string, unknown>;
    try {
      firstArgs = JSON.parse(firstCall.function.arguments) as Record<
        string,
        unknown
      >;
    } catch {
      firstArgs = {};
    }
    const toolStartedAt = Date.now();
    const firstResult = userId
      ? await executeApplicationTool(firstCall.function.name, firstArgs, userId)
      : JSON.stringify({ ok: false, error: "Authentication required" });
    rememberMountainCards(mountainCards, firstResult);
    console.info("agent.tool.request", {
      name: firstCall.function.name,
      durationMs: Date.now() - toolStartedAt,
      suppressedParallelCalls: message.tool_calls.length - 1,
    });
    messages.push({
      role: "tool" as const,
      tool_call_id: firstCall.id,
      content: firstResult,
    });
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
  rawPrompt = prompt,
): Promise<string> {
  if (!env.OPENROUTER_API_KEY) {
    const content = `OpenRouter is not configured yet. Demo response for: ${prompt} | Active model: ${env.OPENROUTER_MODEL}`;
    onToken(content);
    return content;
  }

  const requestContext = userId
    ? await getUserAgentContext(userId)
    : undefined;
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildAgentSystemPrompt(requestContext) },
    { role: "user", content: prompt },
  ];
  const mountainCards = new Map<number, string>();
  for (const list of requestContext?.unfinishedLists ?? []) {
    for (const hike of list.remainingHikes) {
      if (hike.kind === "peak") {
        mountainCards.set(hike.id, hike.name);
      }
    }
  }
  const tools = [
    ...(userId && shouldOfferNearbyMountainSearch(rawPrompt)
      ? [nearbyMountainSearchTool as OpenAI.Chat.Completions.ChatCompletionTool]
      : []),
    ...(userId && shouldOfferMountainSearch(rawPrompt)
      ? [mountainSearchTool as OpenAI.Chat.Completions.ChatCompletionTool]
      : []),
    // Default: NO function tools — answer from injected remainingHikes.
    // Only expose detail/history tools when explicitly requested, and the
    // runtime enforces max 1 tool call below to stop fan-out 429s.
    ...(userId && shouldOfferDetailTools(rawPrompt) ? applicationTools : []),
  ];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const startedAt = Date.now();
    // Non-streaming single call: SSE "streaming" is simulated below by
    // chunking the final text. This halves OpenRouter calls per turn (the old
    // code made one streaming call for tool detection PLUS a second call for
    // the answer) and makes 429 retry/backoff actually work — the stream API
    // fails lazily mid-iteration, after headers are already sent.
    const toolsForAttempt = attempt === 0 ? tools : [];
    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await createChatCompletion({
        messages,
        tools: toolsForAttempt,
        ...webSearchPluginOptions(rawPrompt),
        temperature: 0.7,
        tool_choice: toolsForAttempt.length > 0 ? "auto" : "none",
      });
    } catch (error) {
      if (isRetryableRateLimit(error)) throwRateLimitResponse();
      throw error;
    }

    const message = response.choices[0]?.message;
    const content = linkMountainCards(
      stripPseudoToolMarkup(message?.content ?? ""),
      mountainCardReferences(mountainCards),
    );
    if (!message?.tool_calls?.length) {
      console.info("agent.model.request", {
        durationMs: Date.now() - startedAt,
        toolRound: false,
        characters: content.length,
      });
      // Simulate streaming so the client still renders progressively.
      const finalContent = content || "No response returned.";
      for (const chunk of finalContent.match(/[\s\S]{1,120}/g) ?? []) {
        onToken(chunk);
        await sleep(0);
      }
      return finalContent;
    }

    // Single-tool-call budget (same 429 guard as generateAgentReply):
    // execute only the first function call per turn.
    const firstCall = message.tool_calls.find(
      (call) => call.type === "function",
    );
    messages.push(message);
    if (!firstCall || firstCall.type !== "function") {
      const content =
        linkMountainCards(
          stripPseudoToolMarkup(message?.content ?? ""),
          mountainCardReferences(mountainCards),
        ) || "No response returned.";
      onToken(content);
      return content;
    }
    let firstArgs: Record<string, unknown> = {};
    try {
      firstArgs = JSON.parse(firstCall.function.arguments) as Record<
        string,
        unknown
      >;
    } catch {
      // Let the tool return its normal validation error for malformed arguments.
    }
    const toolStartedAt = Date.now();
    const firstResult = userId
      ? await executeApplicationTool(firstCall.function.name, firstArgs, userId)
      : JSON.stringify({ ok: false, error: "Authentication required" });
    rememberMountainCards(mountainCards, firstResult);
    console.info("agent.tool.request", {
      name: firstCall.function.name,
      durationMs: Date.now() - toolStartedAt,
      suppressedParallelCalls: message.tool_calls.length - 1,
    });
    messages.push({
      role: "tool" as const,
      tool_call_id: firstCall.id,
      content: firstResult,
    });
  }

  const content =
    "I could not finish retrieving that information. Please try again.";
  onToken(content);
  return content;
}

function webSearchPluginOptions(prompt: string): Record<string, unknown> {
  return shouldUseWebSearch(prompt) ? { plugins: [{ id: "web" }] } : {};
}

function rememberMountainCards(
  mountainCards: Map<number, string>,
  serializedToolResult: string,
): void {
  for (const mountain of collectMountainCardReferences(serializedToolResult)) {
    mountainCards.set(mountain.id, mountain.name);
  }
}

function mountainCardReferences(
  mountainCards: Map<number, string>,
): MountainCardReference[] {
  return [...mountainCards].map(([id, name]) => ({ id, name }));
}

export async function generateMessageSummary(
  userMessage: string,
  assistantMessage: string,
) {
  if (!env.OPENROUTER_API_KEY) {
    return {
      role: "assistant",
      content: `OpenRouter is not configured yet. Demo summary for: ${userMessage} | Active model: ${env.OPENROUTER_CONTEXT_SUMMARY_MODEL}`,
    };
  }

  const response = await createSummaryCompletion({
    messages: [
      {
        role: "system",
        content: buildAgentSummaryPrompt(userMessage, assistantMessage),
      },
    ],
    temperature: 0.7,
  });

  return response?.choices[0]?.message?.content ?? null;
}
