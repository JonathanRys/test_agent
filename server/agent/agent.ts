import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import type { ListCompletionStatus } from "../services/completion.js";
import type { CompletedPeak } from "../services/completion.js";
import type { UserProfile } from "../services/profile.js";

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

export type AgentRequestContext = {
  profile?: UserProfile;
  listCompletions?: ListCompletionStatus[];
  completedPeaks?: CompletedPeak[];
};

// prompts live in ../prompts
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

// Get the equivalent of __dirname in native Node.js ESM / tsx
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

export function buildAgentSystemPrompt(context?: AgentRequestContext) {
  const prompt = cachedPrompts["systemPrompt"];
  if (!context?.profile && !context?.listCompletions && !context?.completedPeaks)
    return prompt;

  return `${prompt}

Completed peaks and recommendation guidance:
- Do not recommend a peak in the completed peaks list as a new objective unless the user asks about revisiting it.
- Match recommendations to the user's fitness level: beginner -> easy first, intermediate -> easy or moderate, expert -> moderate or hard.
- Difficulty is an estimate from available peak data, not a substitute for current trail conditions, route reports, or weather.
- Prefer uncompleted peaks with a difficulty appropriate for the user's profile, and explain the match briefly.

Use the user's profile when personalizing recommendations. Prefer unfinished lists when suggesting goals or destinations, and mention completion progress when it is relevant.

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
      "user_profile",
      "list_completion_status",
      "search_mountains",
      "web_search",
      "weather",
      "road_closures",
      "trail_conditions",
    ],
  };
}
