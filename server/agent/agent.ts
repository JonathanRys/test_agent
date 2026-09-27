import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import type { CachedUserAgentContext } from "../services/userContext.js";

type Prompt = {
  name: string;
  path: string;
};

export type AgentMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AgentContext = {
  memory: string[];
  tools: string[];
};

export type AgentRequestContext = CachedUserAgentContext;

const prompts: Prompt[] = [
  {
    name: "systemPrompt",
    path: "system.txt",
  },
  {
    name: "summaryPrompt",
    path: "summarize.txt",
  },
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cachedPrompts = prompts.reduce(
  (acc, cur) => {
    acc[cur.name] = fs.readFileSync(
      path.join(__dirname, "../prompts/", cur.path),
      "utf8",
    );
    return acc;
  },
  {} as Record<string, string>,
);

// The prompt file is cached once at startup, so "today" must be stamped at
// request time — a long-running server (tsx watch) would otherwise tell the
// model yesterday's date forever. Local server time is used deliberately:
// "hike today" answers should match the user's calendar day, not UTC.
function currentDateContext(now: Date = new Date()): string {
  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `Current date and time: ${date}, ${time} (${timeZone}).`;
}

export function buildAgentSystemPrompt(context?: AgentRequestContext) {
  const prompt = `${currentDateContext()}\n\n${cachedPrompts["systemPrompt"]}`;
  if (!context?.profile && !context?.unfinishedLists?.length) return prompt;

  return `${prompt}

Unfinished lists and remaining hikes (THIS IS ALL THE HIKING DATA YOU NEED):
- THIS CONTEXT IS COMPLETE. Do not call any function tool to get more hiking data. No exceptions.
- Recommend ONLY hikes listed in remainingHikes below. Do not recommend a peak or trail that is missing from remainingHikes as a new objective unless the user asks to explore other lists. Each entry already has routeDetails, distance, difficulty, elevation, range/state.
- Prefer remaining hikes on unfinished lists where the user already has the most completions (sorted for you).
- If the user asks for specifics, quote routeDetails/distance/difficulty from the injected data. Never call get_hike_details to "enrich" a recommendation list.
- get_hike_details / get_user_adventures exist ONLY for a direct user request about ONE specific hike or their history. Max 1 tool call per turn. Never call tools in parallel or in a loop.
- NEVER emit <tool_call>, <arg_key>, <arg_value>, or any pseudo-XML tool syntax in your visible reply. To use a tool, emit a real function tool call only; otherwise answer in plain text. If you already answered from injected context, do not append tool markup.
- Use completedCount, remainingCount, and totalCount when talking about list progress.
- Match recommendations to the user's fitness level: beginner -> easy first, intermediate -> easy or moderate, expert -> moderate or hard.
- Difficulty is an estimate from available peak data, not a substitute for current trail conditions, route reports, or weather.
- Remaining peaks with coordinates include an injected weather line (e.g. "38°F, partly cloudy, wind 12 mph, today 45/30°F, 20% precip"), refreshed every ~15 minutes. When present, use it directly to answer weather questions about those peaks and factor it into "hike today" recommendations — do NOT call any tool for weather and do NOT ask the user to check forecast sites for peaks that have weather data. Peaks without a weather field have no location data: answer as best you can and point the user to the forecast reference links in the system prompt instead.

Current authenticated user context:
${JSON.stringify(context, null, 2)}`;
}

export function buildAgentSummaryPrompt(
  userMessage: string,
  assistantMessage: string,
) {
  const template = Handlebars.compile(cachedPrompts["summaryPrompt"]);
  return template({ userMessage, assistantMessage });
}

export function createAgentContext(): AgentContext {
  return {
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
  };
}
