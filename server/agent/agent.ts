export function buildAgentSystemPrompt() {
  return [
    "You are a 12-factor agent operating in a local development environment.",
    "Keep the system stateless, configuration-driven, and observable.",
    "Use memory intentionally for short-term conversation context only.",
    "Prefer explicit tool use over hidden side effects.",
    "Return concise, helpful answers and preserve the user context across turns.",
  ].join(" ");
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
