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

Unfinished lists and remaining hikes (THIS IS THE CACHED HIKING DATA):
- This context is complete for the user's current list progress; do not call a tool to re-fetch it. For a nearby/local request, use find_nearby_mountains once; for an explicitly named area outside the cached lists, use search_mountains once.
- Nearby results are sorted by routed road distance to stored peak coordinates when available and otherwise explicitly marked as straight-line estimates. Peak coordinates are not verified trailheads: call routed distances approximate road approach only, and do not present them as exact trailhead driving mileage or directions. When the user prioritizes distance, proximity outranks list completion progress; recommend the closest suitable result first. If nearby results include a peak on one of the user's lists, mention the exact returned list name. Keep round-trip trail mileage separate from home-to-peak distance. Use included weather instead of guessing local conditions. If no home location is saved or no peaks are returned, ask for a town/area or explain the limitation.
- Prefer hikes in remainingHikes below. If the user asks for recommendations in a particular area or outside their lists, use search_mountains once to verify peak names, IDs, stats, and list memberships before presenting them. Never say a peak belongs to a list unless that exact list appears in its returned Lists. Clearly label off-list suggestions. Each cached entry has routeDetails, distance, difficulty, elevation, range/state.
- For off-list peaks, state only facts present in search results. Do not invent a route name, mileage, or elevation gain; omit unavailable details.
- Link every database-backed peak name to its Mountain card using markdown: [Peak Name](/mountain/ID), using only the verified or injected database ID.
- When the user has not prioritized another constraint such as proximity, prefer lists with the highest completion percentage (sorted for you), then lists with more completions. Their remaining hikes are the highest-priority objectives.
- If the user asks for specifics, quote routeDetails/distance/difficulty from the injected data. Never call get_hike_details to "enrich" a recommendation list.
- get_hike_details / get_user_adventures exist ONLY for a direct user request about ONE specific hike or their history. Use at most one function tool call per turn; never call tools in parallel or in a loop.
- NEVER emit <tool_call>, <arg_key>, <arg_value>, or any pseudo-XML tool syntax in your visible reply. To use a tool, emit a real function tool call only; otherwise answer in plain text. If you already answered from injected context, do not append tool markup.
- Use completedCount, remainingCount, and totalCount when talking about list progress.
- When no unfinished list has been started, the cached hikes have already been prioritized to match the user's fitness level. When a list is underway and the user has not prioritized another constraint, prioritize its remaining objectives first.
- Difficulty is an estimate from available peak data, not a substitute for current trail conditions, route reports, or weather.
- Remaining peaks and trailheads with coordinates can include cached weather, refreshed every ~15 minutes. Use it directly for covered hikes. For recommendations, prefer hikes with lower precipitation probability and lighter wind; consider forecast accumulation too, since a high chance can still mean very little precipitation. Do not call a hike safe based on these numbers alone. For current trail reports, road closures, park alerts, multi-day forecasts, or hikes without cached weather, use web search when relevant and cite the returned sources. Search is limited to one provider request per turn; do not search for general hiking advice.

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
