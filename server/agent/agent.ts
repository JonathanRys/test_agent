import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";

// Get the equivalent of __dirname in native Node.js ESM / tsx
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildAgentSystemPrompt() {
  // Read the text file synchronously as a string
  const systemPrompt = fs.readFileSync(
    path.join(__dirname, "../prompts/system.txt"),
    "utf8",
  );
  return systemPrompt;
}

export function buildAgentSummaryPrompt(
  userMessage: string,
  assistantMessage: string,
) {
  // Read the text file synchronously as a string
  const summaryPrompt = fs.readFileSync(
    path.join(__dirname, "../prompts/summarize.txt"),
    "utf8",
  );
  const template = Handlebars.compile(summaryPrompt);
  return template({ userMessage, assistantMessage });
}

export type AgentMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AgentContext = {
  memory: string[];
  tools: string[];
};

export function createAgentContext(): AgentContext {
  return {
    memory: [],
    tools: ["chat", "healthcheck"],
  };
}
