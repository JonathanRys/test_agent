import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";

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

export function buildAgentSystemPrompt() {
  return cachedPrompts["systemPrompt"];
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
    tools: ["chat", "healthcheck"],
  };
}
